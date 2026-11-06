import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface RequestUser {
  sub: string;
  roles: string[];
  permissions: string[];
  /**
   * The `Session` row this access token was minted for, when it has one.
   *
   * HTTP authentication validates this session and current grants on every
   * protected request. Optional here for non-HTTP callers and guard fixtures.
   */
  sid?: string;
}

export const CurrentUser = createParamDecorator(
  (data: keyof RequestUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user?: RequestUser }>();
    const user = request.user;
    return data && user ? user[data] : user;
  },
);
