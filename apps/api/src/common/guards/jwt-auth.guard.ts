import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  override canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  override handleRequest<TUser = unknown>(err: Error | null, user: TUser | false): TUser {
    if (err || !user) {
      throw new UnauthorizedException('Access token is missing or invalid.');
    }
    return user;
  }
}
