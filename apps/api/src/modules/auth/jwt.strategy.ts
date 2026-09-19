import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { RoleCode } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  roles: RoleCode[];
  permissions: string[];
  /**
   * The `Session` row this token was minted for.
   *
   * Optional because tokens issued before sessions were written carry none,
   * and they stay valid until they expire. It identifies a device on the
   * account's own session list and authorises nothing.
   */
  sid?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  validate(payload: JwtPayload) {
    return {
      sub: payload.sub,
      roles: payload.roles,
      permissions: payload.permissions,
      sid: payload.sid,
    };
  }
}
