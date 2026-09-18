import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { PhoneVerificationPurpose, RoleCode } from '@prisma/client';
import * as argon2 from 'argon2';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../../database/prisma.service';
import { EmailService } from '../email/email.service';
import { PermissionsService } from '../permissions/permissions.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { AuthService } from './auth.service';
import { PhoneVerificationService } from './phone-verification.service';

/**
 * Sprint 1B: signing up and signing in with a phone number.
 *
 * The security claims worth a test are the ones that are invisible when they
 * work. Nothing here trusts the client about which number was verified; an
 * existing account cannot be discovered by asking for a code; and the email
 * sign-in that every existing user and all three consoles depend on behaves
 * exactly as it did.
 */

const PHONE = '+998901234567';
const TICKET_SECRET = 'r'.repeat(48);

describe('AuthService: phone-first auth', () => {
  let service: AuthService;
  let jwt: JwtService;
  let prisma: {
    user: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    role: { findUnique: jest.Mock };
    donorProfile: { create: jest.Mock };
    organization: { findFirst: jest.Mock; create: jest.Mock };
    organizationMembership: { create: jest.Mock };
    refreshToken: { create: jest.Mock };
    passwordResetToken: { upsert: jest.Mock };
    $transaction: jest.Mock;
  };
  let phoneVerification: { requestCode: jest.Mock; verifyCode: jest.Mock };
  let audit: { log: jest.Mock };

  const config: Record<string, unknown> = {
    JWT_ACCESS_SECRET: 'a'.repeat(48),
    JWT_REFRESH_SECRET: TICKET_SECRET,
    PASSWORD_RESET_TTL_MINUTES: 60,
  };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn(), update: jest.fn() },
      role: { findUnique: jest.fn().mockResolvedValue({ id: 'role-donor', code: RoleCode.DONOR }) },
      donorProfile: { create: jest.fn() },
      organization: {
        findFirst: jest.fn().mockResolvedValue({ id: 'org-system' }),
        create: jest.fn(),
      },
      organizationMembership: { create: jest.fn() },
      refreshToken: { create: jest.fn().mockResolvedValue({ id: 'rt-1' }) },
      passwordResetToken: { upsert: jest.fn().mockResolvedValue({ id: 'prt-1' }) },
      $transaction: jest.fn(),
    };

    phoneVerification = {
      requestCode: jest.fn().mockResolvedValue({
        sentTo: '+998*******67',
        expiresInSeconds: 300,
        resendAvailableInSeconds: 60,
      }),
      verifyCode: jest.fn().mockResolvedValue(undefined),
    };

    audit = { log: jest.fn().mockResolvedValue({ id: 'a-1' }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: new JwtService({}) },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, fallback?: unknown) => config[key] ?? fallback),
            getOrThrow: jest.fn((key: string) => config[key]),
          },
        },
        { provide: AuditLogsService, useValue: audit },
        { provide: PermissionsService, useValue: { getUserPermissions: jest.fn().mockResolvedValue([]) } },
        { provide: EmailService, useValue: { sendVerificationEmail: jest.fn(), sendPasswordResetEmail: jest.fn() } },
        {
          provide: PlatformSettingsService,
          useValue: {
            isMaintenanceMode: jest.fn().mockResolvedValue(false),
            getSessionTimeoutMinutes: jest.fn().mockResolvedValue(43200),
          },
        },
        { provide: PhoneVerificationService, useValue: phoneVerification },
      ],
    }).compile();

    service = module.get(AuthService);
    jwt = module.get(JwtService);
  });

  /** A ticket the server would have issued for `phone`. */
  const ticketFor = (phone: string, overrides: Record<string, unknown> = {}) =>
    jwt.sign(
      { typ: 'phone_verification', phone, ...overrides },
      { secret: TICKET_SECRET, expiresIn: 900 },
    );

  describe('requesting a code', () => {
    it('answers identically whether or not the number has an account', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const unknown = await service.requestPhoneCode(PHONE, PhoneVerificationPurpose.REGISTRATION);

      prisma.user.findUnique.mockResolvedValue({ id: 'u-1', status: 'ACTIVE' });
      const known = await service.requestPhoneCode(PHONE, PhoneVerificationPurpose.REGISTRATION);

      // Byte for byte. A difference here is how someone walks the number space
      // and learns who donates blood -- which is medical information about
      // them, not a UX detail.
      expect(known).toEqual(unknown);
    });

    it('tells the person holding an already-registered number, without telling the caller', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u-1', status: 'ACTIVE' });

      await service.requestPhoneCode(PHONE, PhoneVerificationPurpose.REGISTRATION);

      expect(phoneVerification.requestCode).toHaveBeenCalledWith(
        PHONE,
        PhoneVerificationPurpose.REGISTRATION,
        expect.objectContaining({ messageFor: 'existing-account' }),
      );
    });

    it('sends nothing to a stranger asked to reset a password they do not have', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await service.requestPhoneCode(PHONE, PhoneVerificationPurpose.PASSWORD_RESET);

      expect(phoneVerification.requestCode).toHaveBeenCalledWith(
        PHONE,
        PhoneVerificationPurpose.PASSWORD_RESET,
        expect.objectContaining({ messageFor: 'none' }),
      );
    });

    it('normalises before it looks anything up', async () => {
      await service.requestPhoneCode('90 123 45 67', PhoneVerificationPurpose.REGISTRATION);

      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { phone: PHONE } }),
      );
    });

    it('refuses a number that is not one', async () => {
      await expect(
        service.requestPhoneCode('nope', PhoneVerificationPurpose.REGISTRATION),
      ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'AUTH_PHONE_INVALID' }) });
    });
  });

  describe('verifying a code', () => {
    it('hands back a signed ticket for sign-up, not a boolean', async () => {
      const result = await service.verifyPhoneCode(
        PHONE,
        PhoneVerificationPurpose.REGISTRATION,
        '123456',
      );

      const payload = jwt.verify<{ typ: string; phone: string }>(
        (result.data as { verificationToken: string }).verificationToken,
        { secret: TICKET_SECRET },
      );
      // The number is inside the signature. `{ verified: true }` would be proof
      // of nothing: anyone can POST that.
      expect(payload).toMatchObject({ typ: 'phone_verification', phone: PHONE });
    });

    it('mints a real password-reset token for recovery, not a phone-shaped variant', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u-1', status: 'ACTIVE' });

      const result = await service.verifyPhoneCode(
        PHONE,
        PhoneVerificationPurpose.PASSWORD_RESET,
        '123456',
      );

      // The same row the email flow writes, so recovery by phone is single-use,
      // expires the same way, and revokes every session when it is spent.
      expect(prisma.passwordResetToken.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'u-1' } }),
      );
      const token = (result.data as { resetToken: string }).resetToken;
      expect(token).toMatch(/^[0-9a-f]{64}$/);
      const written = prisma.passwordResetToken.upsert.mock.calls[0][0];
      expect(written.create.tokenHash).not.toBe(token);
    });

    it('refuses recovery for an account that is not active', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u-1', status: 'SUSPENDED' });

      await expect(
        service.verifyPhoneCode(PHONE, PhoneVerificationPurpose.PASSWORD_RESET, '123456'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('does not mint anything when the code itself was refused', async () => {
      phoneVerification.verifyCode.mockRejectedValue(new BadRequestException('nope'));

      await expect(
        service.verifyPhoneCode(PHONE, PhoneVerificationPurpose.REGISTRATION, '000000'),
      ).rejects.toThrow();
      expect(prisma.passwordResetToken.upsert).not.toHaveBeenCalled();
    });
  });

  describe('finishing registration', () => {
    const details = {
      firstName: 'Aziz',
      lastName: 'Karimov',
      password: 'DevelopmentOnly!123',
    };

    beforeEach(() => {
      prisma.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
        callback({
          user: {
            create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
              id: 'u-new',
              ...data,
            })),
          },
          donorProfile: { create: jest.fn() },
          organization: { findFirst: jest.fn().mockResolvedValue({ id: 'org-system' }), create: jest.fn() },
          organizationMembership: { create: jest.fn() },
        }),
      );
      prisma.user.update.mockResolvedValue({});
    });

    /** The row the service tried to create, read back out of the transaction. */
    async function register(ticket: string, extra: Record<string, unknown> = {}) {
      let created: Record<string, unknown> | undefined;
      prisma.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
        callback({
          user: {
            create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
              created = data;
              return { id: 'u-new', ...data };
            }),
          },
          donorProfile: { create: jest.fn() },
          organization: { findFirst: jest.fn().mockResolvedValue({ id: 'org-system' }), create: jest.fn() },
          organizationMembership: { create: jest.fn() },
        }),
      );
      prisma.user.findUnique.mockImplementation(async ({ where }: { where: Record<string, unknown> }) =>
        where.id
          ? { id: 'u-new', email: created?.email, firstName: 'Aziz', lastName: 'Karimov', status: 'ACTIVE', memberships: [] }
          : null,
      );

      const result = await service.registerWithPhone({
        verificationToken: ticket,
        ...details,
        ...extra,
      } as never);
      return { result, created };
    }

    it('creates an active, phone-verified donor with the number from the ticket', async () => {
      const { created } = await register(ticketFor(PHONE));

      expect(created).toMatchObject({ phone: PHONE, phoneVerified: true, status: 'ACTIVE' });
      // The verification a PENDING_VERIFICATION account waits for has already
      // happened; holding them at it again would be theatre.
      expect(created!.emailVerified).toBe(false);
    });

    it('signs the new donor in rather than sending them to a login form', async () => {
      const { result } = await register(ticketFor(PHONE));

      expect(result.data).toHaveProperty('accessToken');
      expect(result.data).toHaveProperty('refreshToken');
    });

    it('stores a hashed password, never the password', async () => {
      const { created } = await register(ticketFor(PHONE));

      expect(created!.passwordHash).not.toBe(details.password);
      await expect(argon2.verify(created!.passwordHash as string, details.password)).resolves.toBe(true);
    });

    it('gives a donor without an email a reserved local address, left unverified', async () => {
      const { created } = await register(ticketFor(PHONE));

      // The column is unique and NOT NULL, so something has to go there. It is
      // obviously synthetic, and `emailVerified: false` keeps anything from
      // treating it as a way to reach someone.
      expect(created!.email).toBe('998901234567@phone.bloodchain.local');
      expect(created!.emailVerified).toBe(false);
    });

    it('keeps a real address when one is given', async () => {
      const { created } = await register(ticketFor(PHONE), { email: 'Aziz@Example.UZ' });

      expect(created!.email).toBe('aziz@example.uz');
    });

    it('refuses a ticket signed with the wrong key', async () => {
      const forged = jwt.sign(
        { typ: 'phone_verification', phone: PHONE },
        { secret: 'x'.repeat(48), expiresIn: 900 },
      );

      await expect(register(forged)).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'AUTH_VERIFICATION_TICKET_INVALID' }),
      });
    });

    it('refuses an expired ticket', async () => {
      const stale = jwt.sign(
        { typ: 'phone_verification', phone: PHONE },
        { secret: TICKET_SECRET, expiresIn: -10 },
      );

      await expect(register(stale)).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'AUTH_VERIFICATION_TICKET_INVALID' }),
      });
    });

    it('refuses a token of the wrong type signed with the same key', async () => {
      // Without the type check, anything this secret ever signs would count as
      // proof of a phone number.
      const wrongType = jwt.sign(
        { typ: 'something_else', phone: PHONE },
        { secret: TICKET_SECRET, expiresIn: 900 },
      );

      await expect(register(wrongType)).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'AUTH_VERIFICATION_TICKET_INVALID' }),
      });
    });

    it('refuses a ticket with no number in it', async () => {
      const empty = jwt.sign({ typ: 'phone_verification' }, { secret: TICKET_SECRET, expiresIn: 900 });

      await expect(register(empty)).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'AUTH_VERIFICATION_TICKET_INVALID' }),
      });
    });

    it('refuses when the number was registered in the meantime', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u-existing' });

      await expect(
        service.registerWithPhone({
          verificationToken: ticketFor(PHONE),
          ...details,
        } as never),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'AUTH_PHONE_TAKEN' }),
      });
    });
  });

  describe('signing in', () => {
    const password = 'DevelopmentOnly!123';
    let passwordHash: string;

    beforeAll(async () => {
      passwordHash = await argon2.hash(password);
    });

    const account = (overrides: Record<string, unknown> = {}) => ({
      id: 'u-1',
      email: 'donor@donor.local',
      phone: PHONE,
      passwordHash,
      firstName: 'Aziz',
      lastName: 'Karimov',
      displayName: null,
      status: 'ACTIVE',
      emailVerified: false,
      phoneVerified: true,
      failedLoginAttempts: 0,
      lockoutUntil: null,
      memberships: [{ role: { code: RoleCode.DONOR } }],
      ...overrides,
    });

    it('signs in by phone number', async () => {
      prisma.user.findUnique.mockResolvedValue(account());
      prisma.user.update.mockResolvedValue({});

      const result = await service.login({ phone: '90 123 45 67' }, password);

      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { phone: PHONE } }),
      );
      expect(result.data).toHaveProperty('accessToken');
    });

    it('still signs in by email, which every console and existing user depends on', async () => {
      prisma.user.findUnique.mockResolvedValue(account({ emailVerified: true }));
      prisma.user.update.mockResolvedValue({});

      const result = await service.login({ email: 'Donor@Donor.local' }, password);

      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { email: 'donor@donor.local' } }),
      );
      expect(result.data).toHaveProperty('accessToken');
    });

    it('refuses a wrong password the same way whichever identifier was used', async () => {
      prisma.user.findUnique.mockResolvedValue(account());
      prisma.user.update.mockResolvedValue({});

      await expect(service.login({ phone: PHONE }, 'wrong-password')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('says the same thing for an unknown number as for a wrong password', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const unknown = await service.login({ phone: PHONE }, password).catch((e) => e);

      prisma.user.findUnique.mockResolvedValue(account());
      prisma.user.update.mockResolvedValue({});
      const wrongPassword = await service.login({ phone: PHONE }, 'wrong-password').catch((e) => e);

      // "No account with that number" is how you find out who donates here.
      expect(unknown.getStatus()).toBe(wrongPassword.getStatus());
      expect(unknown.getResponse()).toEqual(wrongPassword.getResponse());
    });

    it('refuses a body with neither identifier', async () => {
      await expect(service.login({}, password)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('lets a phone-verified donor in without a verified email', async () => {
      prisma.user.findUnique.mockResolvedValue(
        account({ status: 'PENDING_VERIFICATION', emailVerified: false, phoneVerified: true }),
      );
      prisma.user.update.mockResolvedValue({});

      await expect(service.login({ phone: PHONE }, password)).resolves.toHaveProperty('data');
    });

    it('still holds an account with no confirmed contact at all', async () => {
      prisma.user.findUnique.mockResolvedValue(
        account({ status: 'PENDING_VERIFICATION', emailVerified: false, phoneVerified: false }),
      );

      await expect(service.login({ email: 'donor@donor.local' }, password)).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'AUTH_CONTACT_NOT_VERIFIED' }),
      });
    });
  });
});
