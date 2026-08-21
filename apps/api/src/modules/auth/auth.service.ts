import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { RoleCode } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../../database/prisma.service';
import { PermissionsService } from '../permissions/permissions.service';
import { RegisterDto } from './dto/register.dto';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly db: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditLogsService,
    private readonly permissions: PermissionsService,
  ) {}

  async register(input: RegisterDto, ipAddress?: string) {
    const email = input.email.toLowerCase().trim();
    const existing = await this.db.user.findUnique({ where: { email } });
    if (existing) {
      throw new BadRequestException('Email is already registered.');
    }

    const donorRole = await this.db.role.findUnique({ where: { code: RoleCode.DONOR } });
    if (!donorRole) {
      throw new NotFoundException('DONOR role not found. Run seed script.');
    }

    const user = await this.db.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email,
          passwordHash: await argon2.hash(input.password),
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          phone: input.phone?.trim(),
          status: 'PENDING_VERIFICATION',
          emailVerified: false,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          status: true,
        },
      });

      await tx.donorProfile.create({
        data: { userId: newUser.id },
      });

      return newUser;
    });

    await this.audit.log({
      actorId: user.id,
      action: 'USER_REGISTERED',
      entityType: 'User',
      entityId: user.id,
      ipAddress,
    });

    return { data: user };
  }

  async login(email: string, password: string, ipAddress?: string) {
    const user = await this.db.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: {
        memberships: {
          where: { status: 'ACTIVE' },
          include: { role: true },
        },
      },
    });

    if (!user || !(await argon2.verify(user.passwordHash, password))) {
      await this.audit.log({
        action: 'LOGIN_FAILED',
        entityType: 'User',
        metadata: { email, reason: 'invalid_credentials' },
        ipAddress,
      });
      throw new UnauthorizedException('Email or password is incorrect.');
    }

    if (user.status === 'SUSPENDED') {
      await this.audit.log({
        actorId: user.id,
        action: 'LOGIN_FAILED',
        entityType: 'User',
        entityId: user.id,
        metadata: { reason: 'account_suspended' },
        ipAddress,
      });
      throw new ForbiddenException('Your account has been suspended. Contact support.');
    }

    if (user.status === 'DEACTIVATED') {
      await this.audit.log({
        actorId: user.id,
        action: 'LOGIN_FAILED',
        entityType: 'User',
        entityId: user.id,
        metadata: { reason: 'account_deactivated' },
        ipAddress,
      });
      throw new ForbiddenException('Your account has been deactivated.');
    }

    if (user.status === 'PENDING_VERIFICATION' && !user.emailVerified) {
      await this.audit.log({
        actorId: user.id,
        action: 'LOGIN_FAILED',
        entityType: 'User',
        entityId: user.id,
        metadata: { reason: 'email_not_verified' },
        ipAddress,
      });
      throw new ForbiddenException('Please verify your email before signing in.');
    }

    const roles = user.memberships.map((m) => m.role.code) as RoleCode[];
    const permissions = await this.permissions.getUserPermissions(user.id);

    await this.db.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.createTokenPair(user.id, roles, permissions);

    await this.audit.log({
      actorId: user.id,
      action: 'LOGIN_SUCCESS',
      entityType: 'User',
      entityId: user.id,
      ipAddress,
    });

    return {
      data: {
        ...tokens,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          displayName: user.displayName,
          status: user.status,
          roles,
          permissions,
        },
      },
    };
  }

  async refresh(rawRefreshToken: string, ipAddress?: string) {
    const tokenHash = this.hashRefreshToken(rawRefreshToken);
    const stored = await this.db.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: { memberships: { where: { status: 'ACTIVE' }, include: { role: true } } },
        },
      },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expired. Please sign in again.');
    }

    if (stored.user.status === 'SUSPENDED' || stored.user.status === 'DEACTIVATED') {
      throw new ForbiddenException('Your account is not active.');
    }

    const roles = stored.user.memberships.map((m) => m.role.code) as RoleCode[];
    const permissions = await this.permissions.getUserPermissions(stored.user.id);

    await this.db.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date(), lastUsedAt: new Date() },
    });

    await this.audit.log({
      actorId: stored.user.id,
      action: 'TOKEN_REFRESHED',
      entityType: 'RefreshToken',
      entityId: stored.id,
      ipAddress,
    });

    const tokens = await this.createTokenPair(stored.user.id, roles, permissions);

    return {
      data: {
        ...tokens,
        user: {
          id: stored.user.id,
          email: stored.user.email,
          firstName: stored.user.firstName,
          lastName: stored.user.lastName,
          displayName: stored.user.displayName,
          status: stored.user.status,
          roles,
          permissions,
        },
      },
    };
  }

  async logout(rawRefreshToken: string, userId?: string, ipAddress?: string) {
    const tokenHash = this.hashRefreshToken(rawRefreshToken);
    const stored = await this.db.refreshToken.findUnique({ where: { tokenHash } });
    if (stored && !stored.revokedAt) {
      await this.db.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      });

      await this.audit.log({
        actorId: userId,
        action: 'LOGOUT',
        entityType: 'RefreshToken',
        entityId: stored.id,
        ipAddress,
      });
    }
    return { data: { success: true } };
  }

  async me(userId: string) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          where: { status: 'ACTIVE' },
          include: { role: true, organization: { select: { id: true, name: true, type: true } } },
        },
        donorProfile: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const permissions = await this.permissions.getUserPermissions(userId);

    return {
      data: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        status: user.status,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        lastLoginAt: user.lastLoginAt,
        roles: user.memberships.map((m) => m.role.code),
        organizations: user.memberships.map((m) => ({
          membershipId: m.id,
          organizationId: m.organization.id,
          name: m.organization.name,
          type: m.organization.type,
          role: m.role.code,
          status: m.status,
        })),
        donorProfile: user.donorProfile
          ? {
              id: user.donorProfile.id,
              bloodType: user.donorProfile.bloodType,
              rhFactor: user.donorProfile.rhFactor,
              city: user.donorProfile.city,
              donorStatus: user.donorProfile.donorStatus,
              verificationStatus: user.donorProfile.verificationStatus,
              dateOfBirth: user.donorProfile.dateOfBirth,
            }
          : null,
        permissions,
      },
    };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    ipAddress?: string,
  ) {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    if (!(await argon2.verify(user.passwordHash, currentPassword))) {
      await this.audit.log({
        actorId: userId,
        action: 'PASSWORD_CHANGE_FAILED',
        entityType: 'User',
        entityId: userId,
        metadata: { reason: 'invalid_current_password' },
        ipAddress,
      });
      throw new UnauthorizedException('Current password is incorrect.');
    }

    await this.db.user.update({
      where: { id: userId },
      data: { passwordHash: await argon2.hash(newPassword) },
    });

    await this.db.refreshToken.updateMany({
      where: { userId },
      data: { revokedAt: new Date() },
    });

    await this.audit.log({
      actorId: userId,
      action: 'PASSWORD_CHANGED',
      entityType: 'User',
      entityId: userId,
      ipAddress,
    });

    return { data: { success: true } };
  }

  async getSessions(userId: string) {
    const sessions = await this.db.session.findMany({
      where: { userId, revokedAt: null },
      orderBy: { lastUsedAt: 'desc' },
    });

    return {
      data: sessions.map((s) => ({
        id: s.id,
        deviceName: s.deviceName,
        deviceType: s.deviceType,
        ipAddress: s.ipAddress,
        lastUsedAt: s.lastUsedAt,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
      })),
    };
  }

  async revokeSession(sessionId: string, userId: string, ipAddress?: string) {
    const session = await this.db.session.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.userId !== userId) {
      throw new NotFoundException('Session not found.');
    }

    await this.db.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });

    await this.audit.log({
      actorId: userId,
      action: 'SESSION_REVOKED',
      entityType: 'Session',
      entityId: sessionId,
      ipAddress,
    });

    return { data: { success: true } };
  }

  async revokeAllSessions(userId: string, ipAddress?: string) {
    await this.db.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.db.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.audit.log({
      actorId: userId,
      action: 'ALL_SESSIONS_REVOKED',
      entityType: 'User',
      entityId: userId,
      ipAddress,
    });

    return { data: { success: true } };
  }

  private async createTokenPair(
    userId: string,
    roles: RoleCode[],
    permissions: string[],
  ): Promise<TokenPair> {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, roles, permissions },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m') as any,
      },
    );

    const rawRefresh = randomBytes(48).toString('hex');
    const expiresIn = this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '30d');
    const expiresAt = new Date(Date.now() + this.parseDuration(expiresIn as string));

    await this.db.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashRefreshToken(rawRefresh),
        expiresAt,
      },
    });

    return { accessToken, refreshToken: rawRefresh };
  }

  private hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private parseDuration(value: string): number {
    const match = value.match(/^(\d+)([dhm])$/i);
    if (!match) return 30 * 24 * 60 * 60 * 1000;
    const amount = Number(match[1]!);
    const unit = match[2]!.toLowerCase();
    const multipliers: Record<string, number> = {
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };
    const multiplier = multipliers[unit] ?? multipliers['d']!;
    return amount * multiplier;
  }
}
