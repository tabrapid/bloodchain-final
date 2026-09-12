import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { RegisterOrganizationDto } from './dto/register-organization.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';

/**
 * Sign-in attempts allowed per minute, per IP.
 *
 * Five is the right number against credential stuffing and the wrong one
 * behind a single shared address: three web consoles and a phone signing in
 * together are four, and one mistyped password makes five. `AUTH_THROTTLE_LIMIT`
 * raises it where every client shares an IP -- a demo laptop, an office NAT --
 * without loosening the default for anyone who does not set it.
 */
const LOGIN_LIMIT = Number(process.env.AUTH_THROTTLE_LIMIT ?? 5);

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Register a new donor account' })
  @ApiResponse({ status: 201, description: 'Account created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.auth.register(dto, this.getIp(req));
  }

  @Post('register-organization')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Register a new hospital or blood center, pending admin approval' })
  @ApiResponse({ status: 201, description: 'Organization and admin account created, pending approval' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  registerOrganization(@Body() dto: RegisterOrganizationDto, @Req() req: Request) {
    return this.auth.registerOrganization(dto, this.getIp(req));
  }

  @Post('verify-email')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Verify an email address and receive an authenticated session' })
  @ApiResponse({ status: 200, type: AuthResponseDto, description: 'Email verified' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  verifyEmail(@Body() dto: VerifyEmailDto, @Req() req: Request) {
    return this.auth.verifyEmail(dto.token, this.getIp(req));
  }

  @Get('verify-email')
  @Public()
  @ApiOperation({ summary: 'Verify an email address from a browser link (returns an HTML page)' })
  async verifyEmailLink(@Query('token') token: string, @Req() req: Request, @Res() res: Response) {
    try {
      if (!token) {
        throw new Error('Missing token');
      }
      await this.auth.verifyEmail(token, this.getIp(req));
      res.status(HttpStatus.OK).type('html').send(this.renderVerificationPage(true));
    } catch {
      res.status(HttpStatus.BAD_REQUEST).type('html').send(this.renderVerificationPage(false));
    }
  }

  @Post('resend-verification')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({ summary: 'Resend the email verification link' })
  @ApiResponse({ status: 200, description: 'If the account exists and is unverified, an email was sent' })
  resendVerification(@Body() dto: ResendVerificationDto, @Req() req: Request) {
    return this.auth.resendVerification(dto.email, this.getIp(req));
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: LOGIN_LIMIT, ttl: 60000 } })
  @ApiOperation({ summary: 'Authenticate and receive token pair' })
  @ApiResponse({ status: 200, type: AuthResponseDto, description: 'Authenticated' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 403, description: 'Account suspended or deactivated' })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto.email, dto.password, this.getIp(req));
  }

  /**
   * Account recovery had no path at all: a donor who forgot their password was
   * locked out permanently, and the only workaround available to staff was to
   * share credentials -- which destroys the audit trail this system depends on.
   *
   * Throttled harder than login. A reset request sends mail to a third party,
   * so the abuse here is using the endpoint to flood someone's inbox or to
   * enumerate which addresses are registered. The response is identical either
   * way; the limit stops the volume.
   */
  @Post('forgot-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 900000 } })
  @ApiOperation({ summary: 'Request a password reset link' })
  @ApiResponse({ status: 200, description: 'If the account exists, a reset link was sent' })
  forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    return this.auth.requestPasswordReset(dto.email, this.getIp(req));
  }

  @Post('reset-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 900000 } })
  @ApiOperation({ summary: 'Set a new password using a reset token' })
  @ApiResponse({ status: 200, description: 'Password reset; all sessions revoked' })
  @ApiResponse({ status: 400, description: 'Invalid, used or expired token' })
  resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    return this.auth.resetPassword(dto.token, dto.newPassword, this.getIp(req));
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Rotate the access token using a refresh token' })
  @ApiResponse({ status: 200, type: AuthResponseDto, description: 'Token pair refreshed' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    return this.auth.refresh(dto.refreshToken, this.getIp(req));
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke the current refresh token' })
  @ApiResponse({ status: 200, description: 'Logged out' })
  logout(@Body() dto: RefreshDto, @CurrentUser('sub') userId: string, @Req() req: Request) {
    return this.auth.logout(dto.refreshToken, userId, this.getIp(req));
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Change password' })
  @ApiResponse({ status: 200, description: 'Password changed' })
  @ApiResponse({ status: 401, description: 'Invalid current password' })
  changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    return this.auth.changePassword(userId, dto.currentPassword, dto.newPassword, this.getIp(req));
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the current authenticated user' })
  @ApiResponse({ status: 200, description: 'Current user' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  me(@CurrentUser('sub') userId: string) {
    return this.auth.me(userId);
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get active sessions' })
  @ApiResponse({ status: 200, description: 'Active sessions' })
  getSessions(@CurrentUser('sub') userId: string) {
    return this.auth.getSessions(userId);
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke a specific session' })
  @ApiResponse({ status: 200, description: 'Session revoked' })
  revokeSession(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    return this.auth.revokeSession(id, userId, this.getIp(req));
  }

  @Post('sessions/revoke-all')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke all sessions' })
  @ApiResponse({ status: 200, description: 'All sessions revoked' })
  revokeAllSessions(@CurrentUser('sub') userId: string, @Req() req: Request) {
    return this.auth.revokeAllSessions(userId, this.getIp(req));
  }

  private getIp(req: Request): string | undefined {
    const forwarded = req.headers['x-forwarded-for'] as string | string[] | undefined;
    if (typeof forwarded === 'string') return forwarded.split(',')[0]?.trim();
    return req.ip ?? undefined;
  }

  private renderVerificationPage(success: boolean): string {
    const title = success ? 'Email verified' : 'Verification failed';
    const message = success
      ? 'Your email address has been verified. You can now sign in from the DONOR app.'
      : 'This verification link is invalid or has expired. Request a new one from the app.';
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title} — DONOR</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0b0e14; color: #f5f6f7; display: flex; min-height: 100vh; align-items: center; justify-content: center; margin: 0; padding: 24px; }
  .card { max-width: 420px; text-align: center; }
  h1 { color: ${success ? '#22c55e' : '#ef4444'}; margin-bottom: 12px; }
  p { color: #a1a8b3; line-height: 1.5; }
</style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
  }
}
