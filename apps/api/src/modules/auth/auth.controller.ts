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
import {
  RegisterWithPhoneDto,
  RequestPhoneCodeDto,
  VerifyPhoneCodeDto,
} from './dto/phone-auth.dto';

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

/**
 * Code requests allowed per fifteen minutes, per IP.
 *
 * Three, because every one of these can cost money and can make a stranger's
 * phone buzz -- far more expensive to abuse than a failed sign-in. It has the
 * same escape hatch as `LOGIN_LIMIT` and for the same reason: behind one shared
 * address (a demo laptop, an office NAT, an end-to-end test run) three is a
 * limit on the building rather than on a person.
 */
const OTP_REQUEST_LIMIT = Number(process.env.OTP_THROTTLE_LIMIT ?? 3);

/**
 * Code verifications allowed per fifteen minutes, per IP.
 *
 * Higher, because verifying sends nothing and costs nothing. The real defence
 * against guessing is the per-code attempt cap; this only stops someone
 * cycling *numbers* rather than guesses.
 */
const OTP_VERIFY_LIMIT = Number(process.env.OTP_VERIFY_THROTTLE_LIMIT ?? 10);

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
    return this.auth.login(
      { email: dto.email, phone: dto.phone },
      dto.password,
      this.getIp(req),
      // Read from the request, never from the body: a device label a caller
      // can choose is a label on someone else's session list.
      {
        ipAddress: this.getIp(req),
        userAgent: req.headers['user-agent'],
        deviceName: (req.headers['x-device-name'] as string | undefined)?.slice(0, 80),
        deviceType: (req.headers['x-device-type'] as string | undefined)?.slice(0, 40),
      },
    );
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

  /**
   * Phone-first sign-up and phone recovery, step one.
   *
   * Throttled hard, and for a different reason than the rest of auth: every
   * call here can cost money and can make a stranger's phone buzz. Three per
   * fifteen minutes per address, on top of the per-number hourly ceiling the
   * service enforces -- one limit stops a machine, the other stops a botnet
   * pointed at one person.
   */
  @Post('phone/request-code')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: OTP_REQUEST_LIMIT, ttl: 900000 } })
  @ApiOperation({ summary: 'Send a one-time code by SMS' })
  @ApiResponse({ status: 200, description: 'A code was requested; the response never says whether the number has an account' })
  @ApiResponse({ status: 429, description: 'Cooldown or hourly ceiling' })
  requestPhoneCode(@Body() dto: RequestPhoneCodeDto, @Req() req: Request) {
    return this.auth.requestPhoneCode(dto.phone, dto.purpose, {
      ipAddress: this.getIp(req),
      locale: dto.locale,
    });
  }

  /**
   * Step two: spend the code.
   *
   * Looser than request-code because it sends nothing and costs nothing, but
   * still bounded -- the per-code attempt cap is the real defence, and this
   * stops someone cycling *numbers* rather than guesses.
   */
  @Post('phone/verify-code')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: OTP_VERIFY_LIMIT, ttl: 900000 } })
  @ApiOperation({ summary: 'Verify a one-time code and receive proof of ownership' })
  @ApiResponse({ status: 200, description: 'Verified; returns a registration ticket or a reset token' })
  @ApiResponse({ status: 400, description: 'Wrong, expired or exhausted code' })
  verifyPhoneCode(@Body() dto: VerifyPhoneCodeDto, @Req() req: Request) {
    return this.auth.verifyPhoneCode(dto.phone, dto.purpose, dto.code, this.getIp(req));
  }

  /** Step three: create the account the verified number belongs to. */
  @Post('register-phone')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Finish phone-first registration and sign in' })
  @ApiResponse({ status: 201, type: AuthResponseDto, description: 'Account created and signed in' })
  @ApiResponse({ status: 400, description: 'Ticket invalid or expired, or the number is taken' })
  registerWithPhone(@Body() dto: RegisterWithPhoneDto, @Req() req: Request) {
    return this.auth.registerWithPhone(dto, this.getIp(req));
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
  getSessions(@CurrentUser('sub') userId: string, @CurrentUser('sid') sessionId?: string) {
    return this.auth.getSessions(userId, sessionId);
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
