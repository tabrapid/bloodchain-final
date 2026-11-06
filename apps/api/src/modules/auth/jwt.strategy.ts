import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { RoleCode } from '@prisma/client';
import { resolveSessionUser } from './session-authorization';
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
  constructor(
    config: ConfigService,
    private readonly db: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    return resolveSessionUser(this.db, payload);
  }
}
