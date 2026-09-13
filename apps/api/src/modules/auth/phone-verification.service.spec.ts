import { BadRequestException, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PhoneVerificationPurpose } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../../database/prisma.service';
import { SmsService } from '../sms/sms.service';
import { PhoneVerificationService } from './phone-verification.service';

/**
 * Sprint 1B: one-time codes.
 *
 * A six-digit code is a million possibilities, which is not many. Everything
 * tested here is one of the things that makes that enough -- the attempt cap,
 * the expiry, single use, supersede-on-resend, the hourly ceiling, and the fact
 * that the code itself never reaches the database. Remove any one of them and
 * the other five stop mattering.
 */

const PHONE = '+998901234567';
const PURPOSE = PhoneVerificationPurpose.REGISTRATION;

type MockPrisma = {
  phoneVerification: {
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
    count: jest.Mock;
  };
  $transaction: jest.Mock;
};

describe('PhoneVerificationService', () => {
  let service: PhoneVerificationService;
  let prisma: MockPrisma;
  let sms: { send: jest.Mock; providerName: string; isDevelopmentProvider: boolean };
  let audit: { log: jest.Mock };
  let config: Record<string, number | string>;

  /** The six digits out of the last message the service handed to the provider. */
  const sentCode = (): string => {
    const body = sms.send.mock.calls.at(-1)?.[0]?.body as string | undefined;
    const match = body?.match(/\b(\d{6})\b/);
    if (!match?.[1]) throw new Error(`No code in the last SMS: ${body ?? '(none sent)'}`);
    return match[1];
  };

  /** The code the service generated, read out of the row it tried to write. */
  const writtenHash = (): string => {
    const create = prisma.phoneVerification.create.mock.calls.at(-1)?.[0];
    return create?.data?.codeHash as string;
  };

  beforeEach(async () => {
    config = {
      OTP_TTL_SECONDS: 300,
      OTP_MAX_ATTEMPTS: 5,
      OTP_RESEND_COOLDOWN_SECONDS: 60,
      OTP_MAX_PER_HOUR: 5,
      JWT_REFRESH_SECRET: 'a'.repeat(48),
    };

    prisma = {
      phoneVerification: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'pv-1' }),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        count: jest.fn().mockResolvedValue(0),
      },
      // The service batches supersede + create; run both and hand back results.
      $transaction: jest.fn(async (operations: unknown[]) => Promise.all(operations as Promise<unknown>[])),
    };

    sms = { send: jest.fn().mockResolvedValue({ accepted: true }), providerName: 'test', isDevelopmentProvider: true };
    audit = { log: jest.fn().mockResolvedValue({ id: 'a-1' }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PhoneVerificationService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogsService, useValue: audit },
        { provide: SmsService, useValue: sms },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, fallback?: unknown) => config[key] ?? fallback),
            getOrThrow: jest.fn((key: string) => config[key]),
          },
        },
      ],
    }).compile();

    service = module.get(PhoneVerificationService);
  });

  describe('requesting a code', () => {
    it('sends a six-digit code and says when it expires', async () => {
      const result = await service.requestCode(PHONE, PURPOSE);

      expect(sms.send).toHaveBeenCalledTimes(1);
      const { body, to } = sms.send.mock.calls[0][0];
      expect(to).toBe(PHONE);
      expect(body).toMatch(/\b\d{6}\b/);
      expect(result.expiresInSeconds).toBe(300);
    });

    it('never stores the code itself, only a keyed hash of it', async () => {
      await service.requestCode(PHONE, PURPOSE);

      const code = sentCode();
      const stored = writtenHash();

      // A database copy must not be a list of live codes.
      expect(stored).not.toContain(code);
      expect(stored).toMatch(/^[0-9a-f]{64}$/);
    });

    it('binds the hash to the number, so a row lifted from one cannot be replayed on another', async () => {
      await service.requestCode(PHONE, PURPOSE);
      const first = writtenHash();
      const code = sentCode();

      // Same code, different number: a different stored value.
      const other = '+998901234568';
      prisma.phoneVerification.findFirst.mockResolvedValue(null);
      await service.requestCode(other, PURPOSE);
      // Force the same code by comparing hashes of the known code directly.
      const matchesOnOtherNumber = service['codeMatches'](other, PURPOSE, code, first);
      expect(matchesOnOtherNumber).toBe(false);
    });

    it('supersedes any live code before writing the new one', async () => {
      await service.requestCode(PHONE, PURPOSE);

      // Twenty resends must not leave twenty valid codes; that would turn the
      // five-attempt cap into a hundred guesses.
      expect(prisma.phoneVerification.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { phone: PHONE, purpose: PURPOSE, consumedAt: null, supersededAt: null },
          data: expect.objectContaining({ supersededAt: expect.any(Date) }),
        }),
      );
    });

    it('refuses a resend inside the cooldown, and says how long is left', async () => {
      prisma.phoneVerification.findFirst.mockResolvedValue({
        id: 'pv-0',
        createdAt: new Date(Date.now() - 10_000),
      });

      await expect(service.requestCode(PHONE, PURPOSE)).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'AUTH_OTP_COOLDOWN',
          details: { retryAfterSeconds: 50 },
        }),
      });
      expect(sms.send).not.toHaveBeenCalled();
    });

    it('allows a resend once the cooldown has passed', async () => {
      prisma.phoneVerification.findFirst.mockResolvedValue({
        id: 'pv-0',
        createdAt: new Date(Date.now() - 61_000),
      });

      await expect(service.requestCode(PHONE, PURPOSE)).resolves.toBeDefined();
      expect(sms.send).toHaveBeenCalled();
    });

    it('refuses once the number has had its hourly allowance', async () => {
      prisma.phoneVerification.count.mockResolvedValue(5);

      await expect(service.requestCode(PHONE, PURPOSE)).rejects.toBeInstanceOf(HttpException);
      // The point of this limit is that a rotating set of IP addresses cannot
      // use us to text one person all evening.
      expect(sms.send).not.toHaveBeenCalled();
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PHONE_OTP_RATE_LIMITED' }),
      );
    });

    it('masks the number in the audit trail', async () => {
      await service.requestCode(PHONE, PURPOSE);

      const entry = audit.log.mock.calls.at(-1)![0];
      expect(entry.metadata.phone).toBe('+998*******67');
      expect(JSON.stringify(entry)).not.toContain(PHONE);
    });

    it('reports a refused send instead of pretending a message went out', async () => {
      sms.send.mockResolvedValue({ accepted: false, error: 'provider down' });

      await expect(service.requestCode(PHONE, PURPOSE)).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'AUTH_OTP_SEND_FAILED' }),
      });
    });

    it('writes the row but sends nothing when there is nobody to tell', async () => {
      // A recovery request for a number with no account. The caller must not be
      // able to tell this case apart, and a stranger must not get an SMS about
      // a service they do not use.
      await service.requestCode(PHONE, PhoneVerificationPurpose.PASSWORD_RESET, {
        messageFor: 'none',
      });

      expect(sms.send).not.toHaveBeenCalled();
      expect(prisma.phoneVerification.create).toHaveBeenCalled();
    });

    it('tells the owner of an already-registered number, without the API saying so', async () => {
      await service.requestCode(PHONE, PURPOSE, { messageFor: 'existing-account' });

      const body = sms.send.mock.calls[0][0].body as string;
      expect(body).not.toMatch(/\b\d{6}\b/);
      expect(body.toLowerCase()).toContain('bloodchain');
    });

    it('writes the SMS in the language the app is being used in', async () => {
      await service.requestCode(PHONE, PURPOSE, { locale: 'ru' });
      expect(sms.send.mock.calls[0][0].body).toContain('код');

      sms.send.mockClear();
      prisma.phoneVerification.findFirst.mockResolvedValue(null);
      await service.requestCode(PHONE, PURPOSE, { locale: 'en' });
      expect(sms.send.mock.calls[0][0].body).toContain('verification code');
    });
  });

  describe('verifying a code', () => {
    /** Sends a code and hands back the live row it would have written. */
    async function issueCode(overrides: Record<string, unknown> = {}) {
      await service.requestCode(PHONE, PURPOSE);
      const code = sentCode();
      const row = {
        id: 'pv-1',
        phone: PHONE,
        purpose: PURPOSE,
        codeHash: writtenHash(),
        expiresAt: new Date(Date.now() + 300_000),
        consumedAt: null,
        supersededAt: null,
        attempts: 0,
        ...overrides,
      };
      prisma.phoneVerification.findFirst.mockResolvedValue(row);
      prisma.phoneVerification.update.mockResolvedValue({ ...row, attempts: (row.attempts as number) + 1 });
      return { code, row };
    }

    it('accepts the right code and spends it', async () => {
      const { code } = await issueCode();

      await expect(service.verifyCode(PHONE, PURPOSE, code)).resolves.toBeUndefined();

      // Conditional on still being unspent, so two racing requests cannot both
      // succeed -- the database decides, not a read-then-write.
      expect(prisma.phoneVerification.updateMany).toHaveBeenLastCalledWith({
        where: { id: 'pv-1', consumedAt: null },
        data: { consumedAt: expect.any(Date) },
      });
    });

    it('refuses the same code a second time', async () => {
      const { code } = await issueCode();
      // The row was consumed between the read and the write: the conditional
      // update matches nothing.
      prisma.phoneVerification.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.verifyCode(PHONE, PURPOSE, code)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('refuses a wrong code', async () => {
      const { code } = await issueCode();
      const wrong = String((Number(code) + 1) % 1_000_000).padStart(6, '0');

      await expect(service.verifyCode(PHONE, PURPOSE, wrong)).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'AUTH_OTP_INVALID' }),
      });
    });

    it('counts the attempt before checking it, so a crash is not a free guess', async () => {
      const { code } = await issueCode();
      const wrong = String((Number(code) + 1) % 1_000_000).padStart(6, '0');

      await expect(service.verifyCode(PHONE, PURPOSE, wrong)).rejects.toThrow();
      expect(prisma.phoneVerification.update).toHaveBeenCalledWith({
        where: { id: 'pv-1' },
        data: { attempts: { increment: 1 } },
      });
    });

    it('burns the code once the attempts are gone', async () => {
      const { code, row } = await issueCode({ attempts: 4 });
      const wrong = String((Number(code) + 1) % 1_000_000).padStart(6, '0');
      prisma.phoneVerification.update.mockResolvedValue({ ...row, attempts: 5 });

      await expect(service.verifyCode(PHONE, PURPOSE, wrong)).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'AUTH_OTP_TOO_MANY_ATTEMPTS' }),
      });
      // Dead, not merely out of attempts: otherwise a later request could keep
      // guessing against the same code.
      expect(prisma.phoneVerification.update).toHaveBeenLastCalledWith({
        where: { id: 'pv-1' },
        data: { supersededAt: expect.any(Date) },
      });
    });

    it('refuses a code whose attempts were already exhausted', async () => {
      const { code } = await issueCode({ attempts: 5 });

      await expect(service.verifyCode(PHONE, PURPOSE, code)).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'AUTH_OTP_TOO_MANY_ATTEMPTS' }),
      });
      // Not even counted: the right code does not revive a burnt one.
      expect(prisma.phoneVerification.update).not.toHaveBeenCalled();
    });

    it('refuses an expired code, and says so', async () => {
      const { code } = await issueCode({ expiresAt: new Date(Date.now() - 1000) });

      await expect(service.verifyCode(PHONE, PURPOSE, code)).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'AUTH_OTP_EXPIRED' }),
      });
    });

    it('answers the same when no code was ever requested as when one is wrong', async () => {
      prisma.phoneVerification.findFirst.mockResolvedValue(null);

      // Telling these apart says whether a code was requested for this number,
      // which is a step towards saying whether the number has an account.
      await expect(service.verifyCode(PHONE, PURPOSE, '123456')).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'AUTH_OTP_INVALID' }),
      });
    });

    it('only looks at codes that are neither spent nor superseded', async () => {
      prisma.phoneVerification.findFirst.mockResolvedValue(null);
      await expect(service.verifyCode(PHONE, PURPOSE, '123456')).rejects.toThrow();

      expect(prisma.phoneVerification.findFirst).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: { phone: PHONE, purpose: PURPOSE, consumedAt: null, supersededAt: null },
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('does not accept a code issued for a different purpose', async () => {
      const { code } = await issueCode();

      // The purpose is part of the hashed input, so a registration code cannot
      // be replayed to take over an existing account's password reset.
      await expect(
        service.verifyCode(PHONE, PhoneVerificationPurpose.PASSWORD_RESET, code),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('resendAvailableIn', () => {
    it('is zero when no code has been sent', async () => {
      prisma.phoneVerification.findFirst.mockResolvedValue(null);
      await expect(service.resendAvailableIn(PHONE, PURPOSE)).resolves.toBe(0);
    });

    it('counts down from the last send', async () => {
      prisma.phoneVerification.findFirst.mockResolvedValue({
        createdAt: new Date(Date.now() - 20_000),
      });
      await expect(service.resendAvailableIn(PHONE, PURPOSE)).resolves.toBe(40);
    });
  });
});
