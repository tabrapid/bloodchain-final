import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OrganizationStatus, OrganizationType, RoleCode } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHmac, randomBytes } from 'node:crypto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../../database/prisma.service';
import { EmailService } from '../email/email.service';
import { PermissionsService } from '../permissions/permissions.service';
import { RegisterDto } from './dto/register.dto';
import { RegisterOrganizationDto } from './dto/register-organization.dto';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditLogsService,
    private readonly permissions: PermissionsService,
    private readonly email: EmailService,
    private readonly platformSettings: PlatformSettingsService,
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

      // Every role grant runs through an OrganizationMembership, so donors —
      // who have no real affiliated hospital/blood center — need somewhere
      // to point that required FK. Use a singleton SYSTEM-type org rather
      // than a fake HOSPITAL, so donor accounts never show up as a bogus
      // "hospital" in admin/discovery listings that filter or count by type.
      let donorOrg = await tx.organization.findFirst({
        where: { type: OrganizationType.SYSTEM },
      });
      if (!donorOrg) {
        donorOrg = await tx.organization.create({
          data: {
            type: OrganizationType.SYSTEM,
            name: 'Donor Accounts (System)',
            status: 'ACTIVE',
          },
        });
      }

      await tx.organizationMembership.create({
        data: {
          userId: newUser.id,
          organizationId: donorOrg.id,
          roleId: donorRole.id,
          status: 'ACTIVE',
        },
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

    try {
      const rawToken = await this.createEmailVerificationToken(user.id);
      const { verifyUrl, deepLink } = this.buildVerificationLinks(rawToken);
      await this.email.sendVerificationEmail(user.email, user.firstName, verifyUrl, deepLink);
    } catch (error) {
      // Registration must still succeed even if the verification email fails
      // to send — the user can always request a new one via resend-verification.
      this.logger.error(
        `Failed to send verification email to ${user.email}: ${(error as Error).message}`,
      );
    }

    return { data: user };
  }

  async registerOrganization(input: RegisterOrganizationDto, ipAddress?: string) {
    const email = input.adminEmail.toLowerCase().trim();
    const existing = await this.db.user.findUnique({ where: { email } });
    if (existing) {
      throw new BadRequestException('Email is already registered.');
    }

    const adminRoleCode =
      input.organizationType === OrganizationType.HOSPITAL
        ? RoleCode.HOSPITAL_ADMIN
        : RoleCode.BLOOD_CENTER_ADMIN;
    const adminRole = await this.db.role.findUnique({ where: { code: adminRoleCode } });
    if (!adminRole) {
      throw new NotFoundException(`${adminRoleCode} role not found. Run seed script.`);
    }

    const { user, organization } = await this.db.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          type: input.organizationType,
          name: input.organizationName.trim(),
          legalName: input.legalName?.trim(),
          email: input.organizationEmail?.toLowerCase().trim(),
          phone: input.organizationPhone?.trim(),
          address: input.address?.trim(),
          latitude: input.latitude,
          longitude: input.longitude,
          status: OrganizationStatus.PENDING_APPROVAL,
          ...(input.organizationType === OrganizationType.HOSPITAL
            ? { hospital: { create: {} } }
            : { bloodCenter: { create: {} } }),
        },
      });

      const newUser = await tx.user.create({
        data: {
          email,
          passwordHash: await argon2.hash(input.adminPassword),
          firstName: input.adminFirstName.trim(),
          lastName: input.adminLastName.trim(),
          phone: input.adminPhone?.trim(),
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

      await tx.organizationMembership.create({
        data: {
          userId: newUser.id,
          organizationId: organization.id,
          roleId: adminRole.id,
          status: 'ACTIVE',
        },
      });

      return { user: newUser, organization };
    });

    await this.audit.log({
      actorId: user.id,
      action: 'ORGANIZATION_REGISTERED',
      entityType: 'Organization',
      entityId: organization.id,
      organizationId: organization.id,
      metadata: { organizationType: organization.type, organizationName: organization.name },
      ipAddress,
    });

    try {
      const rawToken = await this.createEmailVerificationToken(user.id);
      const { verifyUrl, deepLink } = this.buildVerificationLinks(rawToken);
      await this.email.sendVerificationEmail(user.email, user.firstName, verifyUrl, deepLink);
    } catch (error) {
      this.logger.error(
        `Failed to send verification email to ${user.email}: ${(error as Error).message}`,
      );
    }

    return {
      data: {
        user,
        organization: { id: organization.id, name: organization.name, status: organization.status },
      },
    };
  }

  async verifyEmail(token: string, ipAddress?: string) {
    const record = await this.db.emailVerificationToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!record) {
      throw new BadRequestException('Invalid or expired verification link.');
    }

    if (record.usedAt) {
      // Idempotent: a link that was already consumed (e.g. an email client's
      // link-scanner pre-fetching it) still succeeds for the real user as
      // long as the account ended up verified.
      if (record.user.emailVerified) {
        return this.buildAuthResponse(record.userId);
      }
      throw new BadRequestException('This verification link has already been used.');
    }

    if (record.expiresAt < new Date()) {
      throw new BadRequestException('This verification link has expired. Request a new one.');
    }

    const nextStatus = record.user.status === 'PENDING_VERIFICATION' ? 'ACTIVE' : record.user.status;

    await this.db.$transaction([
      this.db.user.update({
        where: { id: record.userId },
        data: { emailVerified: true, status: nextStatus },
      }),
      this.db.emailVerificationToken.update({
        where: { userId: record.userId },
        data: { usedAt: new Date() },
      }),
    ]);

    await this.audit.log({
      actorId: record.userId,
      action: 'EMAIL_VERIFIED',
      entityType: 'User',
      entityId: record.userId,
      ipAddress,
    });

    return this.buildAuthResponse(record.userId);
  }

  async resendVerification(email: string, ipAddress?: string) {
    const normalized = email.toLowerCase().trim();
    const user = await this.db.user.findUnique({ where: { email: normalized } });

    // Do not reveal whether an account exists for this email.
    if (!user || user.emailVerified) {
      return { data: { success: true } };
    }

    try {
      const rawToken = await this.createEmailVerificationToken(user.id);
      const { verifyUrl, deepLink } = this.buildVerificationLinks(rawToken);
      await this.email.sendVerificationEmail(user.email, user.firstName, verifyUrl, deepLink);
    } catch (error) {
      this.logger.error(
        `Failed to resend verification email to ${user.email}: ${(error as Error).message}`,
      );
    }

    await this.audit.log({
      actorId: user.id,
      action: 'EMAIL_VERIFICATION_RESENT',
      entityType: 'User',
      entityId: user.id,
      ipAddress,
    });

    return { data: { success: true } };
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

    if (!user) {
      await this.audit.log({
        action: 'LOGIN_FAILED',
        entityType: 'User',
        metadata: { email, reason: 'user_not_found' },
        ipAddress,
      });
      throw new UnauthorizedException('Email or password is incorrect.');
    }

    const isSuperAdmin = user.memberships.some((m) => m.role.code === RoleCode.SUPER_ADMIN);
    if (!isSuperAdmin && (await this.platformSettings.isMaintenanceMode())) {
      await this.audit.log({
        actorId: user.id,
        action: 'LOGIN_FAILED',
        entityType: 'User',
        entityId: user.id,
        metadata: { reason: 'maintenance_mode' },
        ipAddress,
      });
      throw new ForbiddenException('The platform is temporarily down for maintenance. Please try again later.');
    }

    if (user.lockoutUntil && user.lockoutUntil > new Date()) {
      const remainingMinutes = Math.ceil((user.lockoutUntil.getTime() - Date.now()) / 60000);
      await this.audit.log({
        actorId: user.id,
        action: 'LOGIN_FAILED',
        entityType: 'User',
        entityId: user.id,
        metadata: { reason: 'account_locked', remainingMinutes },
        ipAddress,
      });
      throw new ForbiddenException(`Account is locked. Try again in ${remainingMinutes} minute(s).`);
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

    if (!(await argon2.verify(user.passwordHash, password))) {
      const newFailedAttempts = user.failedLoginAttempts + 1;
      const lockoutUntil = newFailedAttempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;

      await this.db.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: newFailedAttempts,
          lockoutUntil,
        },
      });

      await this.audit.log({
        actorId: user.id,
        action: 'LOGIN_FAILED',
        entityType: 'User',
        entityId: user.id,
        metadata: {
          reason: 'invalid_password',
          failedAttempts: newFailedAttempts,
          locked: !!lockoutUntil,
        },
        ipAddress,
      });

      if (lockoutUntil) {
        throw new ForbiddenException('Too many failed attempts. Account locked for 15 minutes.');
      }

      throw new UnauthorizedException('Email or password is incorrect.');
    }

    if (user.failedLoginAttempts > 0 || user.lockoutUntil) {
      await this.db.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lockoutUntil: null,
        },
      });
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
          include: {
            role: true,
            organization: { select: { id: true, name: true, type: true, status: true } },
          },
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
          organizationStatus: m.organization.status,
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

  private async createEmailVerificationToken(userId: string): Promise<string> {
    const rawToken = randomBytes(32).toString('hex');
    const ttlHours = this.config.get<number>('EMAIL_VERIFICATION_TTL_HOURS', 24);
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

    await this.db.emailVerificationToken.upsert({
      where: { userId },
      create: { userId, token: rawToken, expiresAt },
      update: { token: rawToken, expiresAt, usedAt: null },
    });

    return rawToken;
  }

  private buildVerificationLinks(token: string): { verifyUrl: string; deepLink: string } {
    const apiUrl = this.config.get<string>('API_URL', 'http://localhost:3001');
    const deepLinkBase = this.config.get<string>('MOBILE_DEEP_LINK', 'donor://');
    return {
      verifyUrl: `${apiUrl}/api/v1/auth/verify-email?token=${token}`,
      deepLink: `${deepLinkBase}verify-email?token=${token}`,
    };
  }

  private async buildAuthResponse(userId: string) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      include: { memberships: { where: { status: 'ACTIVE' }, include: { role: true } } },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const roles = user.memberships.map((m) => m.role.code) as RoleCode[];
    const permissions = await this.permissions.getUserPermissions(user.id);
    const tokens = await this.createTokenPair(user.id, roles, permissions);

    await this.db.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
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
    const sessionTimeoutMinutes = await this.platformSettings.getSessionTimeoutMinutes();
    const expiresAt = new Date(Date.now() + sessionTimeoutMinutes * 60 * 1000);

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
    const secret = this.config.getOrThrow<string>('JWT_REFRESH_SECRET');
    return createHmac('sha256', secret).update(token).digest('hex');
  }
}
