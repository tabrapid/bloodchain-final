import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface RequestUser {
  sub: string;
  roles: string[];
  permissions: string[];
  /**
   * The `Session` row this access token was minted for, when it has one.
   *
   * Used only to mark the caller's own device in their session list. Tokens
   * issued before sessions were written carry no `sid`, so it is optional.
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
