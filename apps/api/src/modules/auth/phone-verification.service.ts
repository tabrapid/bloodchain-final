import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PhoneVerificationPurpose } from '@prisma/client';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { SmsService } from '../sms/sms.service';
import { maskPhone } from '../../common/utils/phone.util';
import { AuthErrorCode, authError } from './auth-error-codes';

/** Codes are six digits: what a person can read off a lock screen and retype. */
const CODE_DIGITS = 6;

/** The three languages the donor app speaks, for the message body. */
type SmsLocale = 'uz' | 'ru' | 'en';

export interface RequestCodeResult {
  /** `+998*******67` -- enough to recognise, not enough to read out. */
  sentTo: string;
  expiresInSeconds: number;
  resendAvailableInSeconds: number;
}

/**
 * One-time codes sent to a phone, and everything that keeps them from being
 * useful to anyone but their owner.
 *
 * A six-digit code is a million possibilities, which sounds like a lot and is
 * not: at a thousand guesses a second it falls in under a minute. Everything
 * here exists because of that number.
 *
 * - **Attempts are capped per code.** Five wrong guesses burn the code, so an
 *   attacker gets 5 in a million, not a million in a million.
 * - **Codes expire in minutes**, so the window is short even if the cap were
 *   somehow bypassed.
 * - **A code is single-use**, spent in a conditional update so two racing
 *   requests cannot both consume it.
 * - **A resend supersedes the previous code** rather than adding to it.
 *   Otherwise requesting twenty codes would leave twenty valid ones and turn
 *   the cap on its head.
 * - **Codes are never stored.** What is stored is an HMAC keyed with a server
 *   secret, so a database copy is not a list of live codes: without the key,
 *   a million-entry rainbow table is uncomputable, which a bare SHA-256 of a
 *   six-digit number very much is not.
 * - **Comparison is constant-time**, so timing does not leak a prefix.
 */
@Injectable()
export class PhoneVerificationService {
  private readonly logger = new Logger(PhoneVerificationService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditLogsService,
    private readonly sms: SmsService,
  ) {}

  get ttlSeconds(): number {
    return this.config.get<number>('OTP_TTL_SECONDS', 300);
  }

  get resendCooldownSeconds(): number {
    return this.config.get<number>('OTP_RESEND_COOLDOWN_SECONDS', 60);
  }

  get maxAttempts(): number {
    return this.config.get<number>('OTP_MAX_ATTEMPTS', 5);
  }

  get maxPerHour(): number {
    return this.config.get<number>('OTP_MAX_PER_HOUR', 5);
  }

  /**
   * Sends a code to `phone`, unless it is too soon or there have been too many.
   *
   * The caller is responsible for having normalised the number and for deciding
   * whether this number *should* get a code -- this method says nothing about
   * whether an account exists, and must not, because that answer is the whole
   * prize in phone enumeration.
   */
  async requestCode(
    phone: string,
    purpose: PhoneVerificationPurpose,
    options: {
      ipAddress?: string;
      locale?: string;
      messageFor?: 'code' | 'existing-account' | 'none';
    } = {},
  ): Promise<RequestCodeResult> {
    const now = Date.now();

    const latest = await this.db.phoneVerification.findFirst({
      where: { phone, purpose },
      orderBy: { createdAt: 'desc' },
    });

    if (latest) {
      const sinceLast = now - latest.createdAt.getTime();
      const cooldownMs = this.resendCooldownSeconds * 1000;
      if (sinceLast < cooldownMs) {
        const retryAfterSeconds = Math.ceil((cooldownMs - sinceLast) / 1000);
        throw new HttpException(
          authError(
            AuthErrorCode.OTP_COOLDOWN,
            `Wait ${retryAfterSeconds} second(s) before requesting another code.`,
            { retryAfterSeconds },
          ),
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    // A per-number hourly ceiling on top of the per-IP throttle. The throttle
    // stops one machine hammering the endpoint; this stops a rotating set of
    // addresses from using us to text one person forty times, which costs them
    // their evening and costs us the SMS bill.
    const lastHour = new Date(now - 60 * 60 * 1000);
    const recentCount = await this.db.phoneVerification.count({
      where: { phone, purpose, createdAt: { gte: lastHour } },
    });
    if (recentCount >= this.maxPerHour) {
      await this.audit.log({
        action: 'PHONE_OTP_RATE_LIMITED',
        entityType: 'PhoneVerification',
        metadata: { phone: maskPhone(phone), purpose, recentCount },
        ipAddress: options.ipAddress,
      });
      throw new HttpException(
        authError(
          AuthErrorCode.OTP_RATE_LIMITED,
          'Too many codes requested for this number. Try again later.',
          { retryAfterSeconds: 3600 },
        ),
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = this.generateCode();
    const expiresAt = new Date(now + this.ttlSeconds * 1000);

    // Supersede first, then create: at no point are two codes live for the same
    // number and purpose.
    await this.db.$transaction([
      this.db.phoneVerification.updateMany({
        where: { phone, purpose, consumedAt: null, supersededAt: null },
        data: { supersededAt: new Date() },
      }),
      this.db.phoneVerification.create({
        data: {
          phone,
          purpose,
          codeHash: this.hashCode(phone, purpose, code),
          expiresAt,
          requestedIp: options.ipAddress,
        },
      }),
    ]);

    // `none` means there is nobody to tell: a recovery request for a number
    // with no account. The row is still written and the budget still spent, so
    // the caller cannot tell this case from a real one by what comes back --
    // but no stranger gets an SMS about a service they do not use, and we do
    // not pay to send it.
    //
    // The honest residual: skipping the send is marginally faster, so response
    // time is a weak oracle. What makes that impractical rather than merely
    // unlikely is the per-number ceiling below -- five requests an hour is not
    // enough to measure a difference this small against network noise, let
    // alone to walk a number space.
    const locale = this.pickLocale(options.locale);
    const delivery =
      options.messageFor === 'none'
        ? { accepted: true }
        : await this.sms.send({
            to: phone,
            body:
              options.messageFor === 'existing-account'
                ? this.existingAccountMessage(locale)
                : this.codeMessage(code, locale),
            kind: 'otp' as const,
          });

    await this.audit.log({
      action: 'PHONE_OTP_REQUESTED',
      entityType: 'PhoneVerification',
      metadata: {
        phone: maskPhone(phone),
        purpose,
        provider: this.sms.providerName,
        delivered: delivery.accepted,
      },
      ipAddress: options.ipAddress,
    });

    if (!delivery.accepted) {
      // The row stays. The user retries, the cooldown applies, and we do not
      // pretend a message went out that did not.
      throw new HttpException(
        authError(
          AuthErrorCode.OTP_SEND_FAILED,
          'Could not send the code right now. Please try again.',
        ),
        HttpStatus.BAD_GATEWAY,
      );
    }

    return {
      sentTo: maskPhone(phone),
      expiresInSeconds: this.ttlSeconds,
      resendAvailableInSeconds: this.resendCooldownSeconds,
    };
  }

  /**
   * Spends a code, or explains why it could not be spent.
   *
   * Returns nothing useful on purpose: proof of ownership is minted by the
   * caller (a signed ticket, or a password-reset token), never by the client
   * being told "yes". A boolean in a response body is not proof of anything.
   */
  async verifyCode(
    phone: string,
    purpose: PhoneVerificationPurpose,
    code: string,
    ipAddress?: string,
  ): Promise<void> {
    const record = await this.db.phoneVerification.findFirst({
      where: { phone, purpose, consumedAt: null, supersededAt: null },
      orderBy: { createdAt: 'desc' },
    });

    // No live code and a wrong code are the same answer. Telling them apart
    // says whether a code was ever requested for this number.
    const invalid = new BadRequestException(
      authError(AuthErrorCode.OTP_INVALID, 'That code is not correct.'),
    );

    if (!record) {
      await this.logFailure(phone, purpose, 'no_active_code', ipAddress);
      throw invalid;
    }

    if (record.expiresAt.getTime() <= Date.now()) {
      await this.logFailure(phone, purpose, 'expired', ipAddress);
      throw new BadRequestException(
        authError(
          AuthErrorCode.OTP_EXPIRED,
          'That code has expired. Request a new one.',
        ),
      );
    }

    if (record.attempts >= this.maxAttempts) {
      await this.logFailure(phone, purpose, 'attempts_exhausted', ipAddress);
      throw new BadRequestException(
        authError(
          AuthErrorCode.OTP_TOO_MANY_ATTEMPTS,
          'Too many incorrect attempts. Request a new code.',
        ),
      );
    }

    // Count the attempt before checking it. A process that dies mid-verify must
    // not hand back a free guess, and an attacker must not be able to win the
    // race by opening many connections at once.
    const attempted = await this.db.phoneVerification.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });

    if (!this.codeMatches(phone, purpose, code, record.codeHash)) {
      const exhausted = attempted.attempts >= this.maxAttempts;
      if (exhausted) {
        // Burn it. A code whose attempts are gone is dead, and leaving it
        // "live" would let a later request keep guessing after a resend.
        await this.db.phoneVerification.update({
          where: { id: record.id },
          data: { supersededAt: new Date() },
        });
      }
      await this.logFailure(
        phone,
        purpose,
        exhausted ? 'wrong_code_exhausted' : 'wrong_code',
        ipAddress,
      );
      throw exhausted
        ? new BadRequestException(
            authError(
              AuthErrorCode.OTP_TOO_MANY_ATTEMPTS,
              'Too many incorrect attempts. Request a new code.',
            ),
          )
        : invalid;
    }

    // Single-use, enforced by the database rather than by reading first: two
    // requests arriving together both see `consumedAt: null`, and exactly one
    // of these updates matches a row.
    const consumed = await this.db.phoneVerification.updateMany({
      where: { id: record.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    if (consumed.count !== 1) {
      await this.logFailure(phone, purpose, 'already_consumed', ipAddress);
      throw invalid;
    }

    await this.audit.log({
      action: 'PHONE_OTP_VERIFIED',
      entityType: 'PhoneVerification',
      entityId: record.id,
      metadata: { phone: maskPhone(phone), purpose },
      ipAddress,
    });
  }

  /** Seconds until another code may be requested for this number, or 0. */
  async resendAvailableIn(phone: string, purpose: PhoneVerificationPurpose): Promise<number> {
    const latest = await this.db.phoneVerification.findFirst({
      where: { phone, purpose },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    if (!latest) return 0;
    const elapsed = Date.now() - latest.createdAt.getTime();
    return Math.max(0, Math.ceil((this.resendCooldownSeconds * 1000 - elapsed) / 1000));
  }

  private async logFailure(
    phone: string,
    purpose: PhoneVerificationPurpose,
    reason: string,
    ipAddress?: string,
  ): Promise<void> {
    await this.audit.log({
      action: 'PHONE_OTP_FAILED',
      entityType: 'PhoneVerification',
      metadata: { phone: maskPhone(phone), purpose, reason },
      ipAddress,
    });
  }

  /** A uniformly random six-digit code, leading zeros included. */
  private generateCode(): string {
    return randomInt(0, 10 ** CODE_DIGITS)
      .toString()
      .padStart(CODE_DIGITS, '0');
  }

  /**
   * The stored form of a code.
   *
   * Keyed HMAC, not a plain digest. A six-digit code has a million possible
   * values, so every unkeyed hash of every possible code fits in a file you
   * could build in seconds -- a database leak would be a list of live codes.
   * The key makes that table uncomputable without also stealing the server's
   * secret.
   *
   * The phone and purpose go into the input so a hash lifted from one row
   * cannot be replayed against another number or a different flow.
   */
  private hashCode(phone: string, purpose: PhoneVerificationPurpose, code: string): string {
    // `?.trim() ||` rather than `??`: an unset variable in a .env file arrives
    // as an empty string, not undefined, and `??` would happily key the HMAC
    // with "".
    const secret =
      this.config.get<string>('OTP_HASH_SECRET')?.trim() ||
      this.config.getOrThrow<string>('JWT_REFRESH_SECRET');
    return createHmac('sha256', secret).update(`${purpose}:${phone}:${code}`).digest('hex');
  }

  private codeMatches(
    phone: string,
    purpose: PhoneVerificationPurpose,
    code: string,
    storedHash: string,
  ): boolean {
    const candidate = Buffer.from(this.hashCode(phone, purpose, code), 'utf8');
    const stored = Buffer.from(storedHash, 'utf8');
    // Both are fixed-length hex of the same digest, so a length difference means
    // a corrupt row rather than a near miss -- and timingSafeEqual throws on it.
    if (candidate.length !== stored.length) return false;
    return timingSafeEqual(candidate, stored);
  }

  private pickLocale(locale?: string): SmsLocale {
    const normalized = (locale ?? '').slice(0, 2).toLowerCase();
    return normalized === 'ru' || normalized === 'en' ? normalized : 'uz';
  }

  /**
   * The message body, in the language the app is being used in.
   *
   * Three strings written out here rather than read from `@bloodchain/i18n`:
   * the API compiles with classic module resolution and cannot import a
   * workspace package. Three lines of duplication is the honest cost; a
   * build-system change to avoid it is not this sprint's job.
   */
  private codeMessage(code: string, locale: SmsLocale): string {
    switch (locale) {
      case 'ru':
        return `${code} — код подтверждения BloodChain. Никому его не сообщайте.`;
      case 'en':
        return `${code} is your BloodChain verification code. Do not share it with anyone.`;
      default:
        return `${code} — BloodChain tasdiqlash kodi. Uni hech kimga aytmang.`;
    }
  }

  /**
   * Sent when someone asks to register a number that already has an account.
   *
   * The request gets the same answer either way -- the API must not say whether
   * a number is registered -- but the person holding that phone deserves to
   * know someone tried, and to be pointed at signing in rather than left
   * waiting for a code that is not coming.
   */
  private existingAccountMessage(locale: SmsLocale): string {
    switch (locale) {
      case 'ru':
        return 'Этот номер уже зарегистрирован в BloodChain. Войдите или восстановите пароль.';
      case 'en':
        return 'This number already has a BloodChain account. Sign in, or reset your password.';
      default:
        return 'Bu raqam BloodChain’da allaqachon ro‘yxatdan o‘tgan. Kiring yoki parolni tiklang.';
    }
  }
}
