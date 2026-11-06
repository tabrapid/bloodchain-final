import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { RoleCode } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export interface JwtPayload {
  sub: string;
  roles: RoleCode[];
  permissions: string[];
  /**
   * The `Session` row this token was minted for.
   *
   * Required at validation time. Legacy tokens without a session must sign in
   * again so logout and account suspension cannot leave usable access tokens.
   */
  sid?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private readonly db: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    if (typeof payload.sub !== 'string' || !payload.sub ||
        typeof payload.sid !== 'string' || !payload.sid) {
      throw new UnauthorizedException('Session expired. Please sign in again.');
    }
    const session = await this.db.session.findUnique({
      where: { id: payload.sid },
      include: {
        user: {
          include: {
            memberships: {
              where: { status: 'ACTIVE' },
              include: {
                organization: { select: { status: true } },
                role: { include: { permissions: { include: { permission: true } } } },
              },
            },
          },
        },
      },
    });
    if (!session || session.userId !== payload.sub || session.revokedAt ||
        session.expiresAt <= new Date() ||
        session.user.status === 'SUSPENDED' || session.user.status === 'DEACTIVATED') {
      throw new UnauthorizedException('Session expired. Please sign in again.');
    }
    // Signed claims describe issuance time. Authorization uses current grants,
    // including organization suspension and role/permission removal.
    const memberships = session.user.memberships.filter((m) =>
      m.role.code === RoleCode.SUPER_ADMIN || m.organization.status === 'ACTIVE');
    const roles = [...new Set(memberships.map((m) => m.role.code))];
    const permissions = new Set(memberships.flatMap((m) =>
      m.role.permissions.map((grant) => grant.permission.code)));
    if (roles.includes(RoleCode.SUPER_ADMIN)) permissions.add('admin.manage');
    return {
      sub: payload.sub,
      roles,
      permissions: [...permissions],
      sid: payload.sid,
    };
  }
}
