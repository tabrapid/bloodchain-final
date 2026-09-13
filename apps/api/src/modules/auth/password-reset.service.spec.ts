import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import * as argon2 from 'argon2';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PermissionsService } from '../permissions/permissions.service';
import { EmailService } from '../email/email.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { AuthService } from './auth.service';

/**
 * Account recovery had no path at all before this: a donor who forgot their
 * password was locked out permanently, and the only workaround available to
 * staff was to share credentials -- which destroys the audit trail the whole
 * system depends on.
 */
describe('AuthService password reset', () => {
  let service: AuthService;
  let prisma: any;
  let email: { sendPasswordResetEmail: jest.Mock };
  let audit: { log: jest.Mock };

  const TTL_MINUTES = 60;
  const hashOf = (token: string) => createHash('sha256').update(token).digest('hex');

  const activeUser = {
    id: 'user-1',
    email: 'donor@donor.local',
    firstName: 'Sample',
    status: 'ACTIVE',
    passwordHash: 'old-hash',
  };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn(), update: jest.fn() },
      refreshToken: { updateMany: jest.fn() },
      passwordResetToken: {
        findUnique: jest.fn(),
        upsert: jest.fn().mockResolvedValue({}),
        update: jest.fn(),
      },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    email = { sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined) };
    audit = { log: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: { signAsync: jest.fn() } },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn(() => 'secret'),
            get: jest.fn((key: string, fallback?: unknown) => {
              if (key === 'PASSWORD_RESET_TTL_MINUTES') return TTL_MINUTES;
              if (key === 'PASSWORD_RESET_COOLDOWN_SECONDS') return 60;
              if (key === 'WEB_URL') return 'http://localhost:3000,http://localhost:3002';
              if (key === 'MOBILE_DEEP_LINK') return 'donor://';
              return fallback;
            }),
          },
        },
        { provide: AuditLogsService, useValue: audit },
        { provide: PermissionsService, useValue: { getUserPermissions: jest.fn() } },
        { provide: EmailService, useValue: email },
        { provide: PlatformSettingsService, useValue: { isEnabled: jest.fn() } },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('requestPasswordReset', () => {
    it('creates a token and sends a link for an active account', async () => {
      prisma.user.findUnique.mockResolvedValue(activeUser);
      prisma.passwordResetToken.findUnique.mockResolvedValue(null);

      await service.requestPasswordReset('donor@donor.local', '203.0.113.1');

      expect(prisma.passwordResetToken.upsert).toHaveBeenCalledTimes(1);
      expect(email.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    });

    /**
     * Anything that differs between a registered and an unregistered address
     * turns this endpoint into a way to test whether a given person is a donor
     * here -- which, for a blood service, is medical information about them.
     */
    it('answers identically for an unknown address, and sends nothing', async () => {
      prisma.user.findUnique.mockResolvedValue(activeUser);
      prisma.passwordResetToken.findUnique.mockResolvedValue(null);
      const known = await service.requestPasswordReset('donor@donor.local');

      prisma.user.findUnique.mockResolvedValue(null);
      const unknown = await service.requestPasswordReset('nobody@example.test');

      expect(unknown).toEqual(known);
      expect(email.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    });

    it('answers identically for a suspended account, and sends nothing', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...activeUser, status: 'SUSPENDED' });
      const response = await service.requestPasswordReset('donor@donor.local');

      expect(response.data.success).toBe(true);
      expect(email.sendPasswordResetEmail).not.toHaveBeenCalled();
      expect(prisma.passwordResetToken.upsert).not.toHaveBeenCalled();
    });

    it('never stores the token itself, only its hash', async () => {
      prisma.user.findUnique.mockResolvedValue(activeUser);
      prisma.passwordResetToken.findUnique.mockResolvedValue(null);

      await service.requestPasswordReset('donor@donor.local');

      const stored = prisma.passwordResetToken.upsert.mock.calls[0][0];
      const sentUrl = email.sendPasswordResetEmail.mock.calls[0][2] as string;
      const sentToken = new URL(sentUrl).searchParams.get('token')!;

      expect(stored.create.tokenHash).toBe(hashOf(sentToken));
      expect(JSON.stringify(stored)).not.toContain(sentToken);
    });

    /**
     * The deep link is a contract with a file path in the mobile app:
     * `donor://reset-password` resolves to app/(auth)/reset-password.tsx, and
     * Expo Router strips the group folder from the URL. Renaming that screen
     * would break every reset email already in someone's inbox, silently, so
     * the path is pinned here as well as there.
     */
    it('points the deep link at the mobile reset screen', async () => {
      prisma.user.findUnique.mockResolvedValue(activeUser);
      prisma.passwordResetToken.findUnique.mockResolvedValue(null);

      await service.requestPasswordReset('donor@donor.local');

      const deepLink = email.sendPasswordResetEmail.mock.calls[0][3] as string;
      expect(deepLink).toMatch(/^donor:\/\/reset-password\?token=[a-f0-9]{64}$/);

      const webUrl = email.sendPasswordResetEmail.mock.calls[0][2] as string;
      expect(new URL(webUrl).pathname).toBe('/reset-password');
    });

    it('sets an expiry from the configured TTL', async () => {
      prisma.user.findUnique.mockResolvedValue(activeUser);
      prisma.passwordResetToken.findUnique.mockResolvedValue(null);
      const before = Date.now();

      await service.requestPasswordReset('donor@donor.local');

      const { expiresAt } = prisma.passwordResetToken.upsert.mock.calls[0][0].create;
      const ttlMs = expiresAt.getTime() - before;
      expect(ttlMs).toBeGreaterThan((TTL_MINUTES - 1) * 60 * 1000);
      expect(ttlMs).toBeLessThanOrEqual((TTL_MINUTES + 1) * 60 * 1000);
    });

    /**
     * The per-IP throttle does not stop someone cycling addresses to flood one
     * person's inbox, so the account carries its own floor.
     */
    it('does not resend within the per-account cooldown', async () => {
      prisma.user.findUnique.mockResolvedValue(activeUser);
      prisma.passwordResetToken.findUnique.mockResolvedValue({
        usedAt: null,
        createdAt: new Date(Date.now() - 5_000),
      });

      const response = await service.requestPasswordReset('donor@donor.local');

      expect(response.data.success).toBe(true);
      expect(email.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('does resend once the cooldown has passed', async () => {
      prisma.user.findUnique.mockResolvedValue(activeUser);
      prisma.passwordResetToken.findUnique.mockResolvedValue({
        usedAt: null,
        createdAt: new Date(Date.now() - 10 * 60 * 1000),
      });

      await service.requestPasswordReset('donor@donor.local');

      expect(email.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    });

    it('still reports success when sending the mail fails', async () => {
      prisma.user.findUnique.mockResolvedValue(activeUser);
      prisma.passwordResetToken.findUnique.mockResolvedValue(null);
      email.sendPasswordResetEmail.mockRejectedValue(new Error('smtp down'));

      const response = await service.requestPasswordReset('donor@donor.local');

      expect(response.data.success).toBe(true);
    });

    it('audits matched and unmatched attempts alike', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await service.requestPasswordReset('nobody@example.test');

      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PASSWORD_RESET_REQUESTED',
          metadata: expect.objectContaining({ matched: false }),
        }),
      );
    });
  });

  describe('resetPassword', () => {
    const validRecord = () => ({
      id: 'token-1',
      userId: activeUser.id,
      usedAt: null,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      user: activeUser,
    });

    it('looks the token up by hash, never by its plain value', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(validRecord());

      await service.resetPassword('the-token', 'CorrectHorse!2026');

      expect(prisma.passwordResetToken.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tokenHash: hashOf('the-token') } }),
      );
    });

    it('stores a hashed password, spends the token and revokes sessions in one transaction', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(validRecord());

      await service.resetPassword('the-token', 'CorrectHorse!2026');

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: activeUser.id } }),
      );
      const newHash = prisma.user.update.mock.calls[0][0].data.passwordHash;
      expect(newHash).not.toBe('CorrectHorse!2026');
      await expect(argon2.verify(newHash, 'CorrectHorse!2026')).resolves.toBe(true);

      expect(prisma.passwordResetToken.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'token-1' }, data: { usedAt: expect.any(Date) } }),
      );
      // A reset is often the response to a suspected compromise, so leaving
      // other refresh tokens alive would leave an intruder signed in behind
      // the new password.
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: activeUser.id, revokedAt: null } }),
      );
    });

    it('refuses an already-used token', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue({
        ...validRecord(),
        usedAt: new Date(),
      });

      await expect(service.resetPassword('the-token', 'CorrectHorse!2026')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('refuses an expired token', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue({
        ...validRecord(),
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.resetPassword('the-token', 'CorrectHorse!2026')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('refuses an unknown token', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(null);

      await expect(service.resetPassword('nope', 'CorrectHorse!2026')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('refuses a token belonging to a suspended account', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue({
        ...validRecord(),
        user: { ...activeUser, status: 'SUSPENDED' },
      });

      await expect(service.resetPassword('the-token', 'CorrectHorse!2026')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    /**
     * One message for every failure mode, so a caller cannot probe which
     * tokens ever existed.
     */
    it('gives the same message whether the token is unknown, used or expired', async () => {
      const messages: string[] = [];
      for (const record of [
        null,
        { ...validRecord(), usedAt: new Date() },
        { ...validRecord(), expiresAt: new Date(Date.now() - 1000) },
      ]) {
        prisma.passwordResetToken.findUnique.mockResolvedValue(record);
        const error = await service
          .resetPassword('t', 'CorrectHorse!2026')
          .catch((err: BadRequestException) => err);
        messages.push((error as BadRequestException).message);
      }
      expect(new Set(messages).size).toBe(1);
    });

    it('records the reason on the audit trail even though the caller is not told', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue({
        ...validRecord(),
        usedAt: new Date(),
      });

      await service.resetPassword('the-token', 'CorrectHorse!2026').catch(() => undefined);

      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PASSWORD_RESET_FAILED',
          metadata: expect.objectContaining({ reason: 'already_used' }),
        }),
      );
    });

    it('audits a successful reset', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(validRecord());

      await service.resetPassword('the-token', 'CorrectHorse!2026');

      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PASSWORD_RESET_COMPLETED' }),
      );
    });
  });
});
