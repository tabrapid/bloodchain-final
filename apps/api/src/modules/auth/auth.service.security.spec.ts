import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { PhoneVerificationService } from './phone-verification.service';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { EmailService } from '../email/email.service';
import { PermissionsService } from '../permissions/permissions.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { RoleCode, UserStatus } from '@prisma/client';

jest.mock('argon2');

type MockPrisma = {
  user: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
  refreshToken: {
    create: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  role: { findUnique: jest.Mock };
  donorProfile: { create: jest.Mock };
  session: { findMany: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
  $transaction: jest.Mock;
};

describe('AuthService Security Tests', () => {
  let authService: AuthService;
  let prisma: MockPrisma;
  let auditLogsService: { log: jest.Mock };

  const mockCorrectPassword = 'CorrectPassword123!';
  const mockWrongPassword = 'WrongPassword123!';

  const createMockUser = (overrides: Record<string, any> = {}) => ({
    id: 'user-1',
    email: 'test@donor.local',
    passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$test',
    firstName: 'Test',
    lastName: 'User',
    displayName: 'Test User',
    status: 'ACTIVE' as UserStatus,
    emailVerified: true,
    phoneVerified: false,
    failedLoginAttempts: 0,
    lockoutUntil: null as Date | null,
    lastLoginAt: null,
    memberships: [
      {
        role: { code: RoleCode.DONOR, id: 'role-1', name: 'Donor' },
        organizationId: 'org-1',
        status: 'ACTIVE',
      },
    ],
    ...overrides,
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    prisma = {
      user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      refreshToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      role: { findUnique: jest.fn() },
      donorProfile: { create: jest.fn() },
      session: { findMany: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
      $transaction: jest.fn(),
    };

    auditLogsService = { log: jest.fn() };

    const mockPermissionsService = {
      getUserPermissions: jest.fn().mockResolvedValue(['donor.read']),
    };

    const mockConfigService = {
      getOrThrow: jest.fn().mockReturnValue('test-secret-with-minimum-32-characters'),
      get: jest.fn().mockImplementation((key: string, defaultValue: string) => defaultValue),
    };

    const mockJwtService = {
      signAsync: jest.fn().mockResolvedValue('test-access-token'),
    };

    const mockEmailService = {
      sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
    };

    const mockPlatformSettingsService = {
      getSessionTimeoutMinutes: jest.fn().mockResolvedValue(43200),
      isEnabled: jest.fn().mockResolvedValue(true),
      isMaintenanceMode: jest.fn().mockResolvedValue(false),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogsService, useValue: auditLogsService },
        { provide: PermissionsService, useValue: mockPermissionsService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: EmailService, useValue: mockEmailService },
        { provide: PlatformSettingsService, useValue: mockPlatformSettingsService },
        {
          // Phone verification is exercised on its own, in
          // phone-verification.service.spec.ts. Here it is a stub, because
          // these tests are about email sign-in and the reset flow, and a real
          // one would drag in the SMS provider for no benefit.
          provide: PhoneVerificationService,
          useValue: {
            requestCode: jest.fn(),
            verifyCode: jest.fn(),
            resendAvailableIn: jest.fn().mockResolvedValue(0),
          },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  describe('Brute Force Protection', () => {
    it('should block login when account is locked', async () => {
      const lockedUser = createMockUser({
        failedLoginAttempts: 5,
        lockoutUntil: new Date(Date.now() + 15 * 60 * 1000),
      });

      prisma.user.findUnique.mockResolvedValue(lockedUser);

      await expect(
        authService.login({ email: 'test@donor.local' }, mockCorrectPassword),
      ).rejects.toThrow(ForbiddenException);

      expect(auditLogsService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'LOGIN_FAILED',
          metadata: expect.objectContaining({
            reason: 'account_locked',
          }),
        }),
      );
    });

    it('should allow login after lockout expires', async () => {
      const userWithExpiredLockout = createMockUser({
        failedLoginAttempts: 5,
        lockoutUntil: new Date(Date.now() - 1000),
      });

      (argon2.verify as jest.Mock).mockResolvedValue(true);
      prisma.user.findUnique.mockResolvedValue(userWithExpiredLockout);
      prisma.user.update.mockResolvedValue({
        ...userWithExpiredLockout,
        failedLoginAttempts: 0,
        lockoutUntil: null,
      });
      prisma.refreshToken.create.mockResolvedValue({ id: 'token-1' });

      const result = await authService.login({ email: 'test@donor.local' }, mockCorrectPassword);

      expect(result).toHaveProperty('data');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          failedLoginAttempts: 0,
          lockoutUntil: null,
        },
      });
    });

    it('should lock account after 5 failed attempts', async () => {
      const userWithAttempts = createMockUser({
        failedLoginAttempts: 4,
        lockoutUntil: null,
      });

      (argon2.verify as jest.Mock).mockResolvedValue(false);
      prisma.user.findUnique.mockResolvedValue(userWithAttempts);
      prisma.user.update.mockResolvedValue({
        ...userWithAttempts,
        failedLoginAttempts: 5,
        lockoutUntil: expect.any(Date),
      });

      await expect(
        authService.login({ email: 'test@donor.local' }, mockWrongPassword),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          failedLoginAttempts: 5,
          lockoutUntil: expect.any(Date),
        },
      });
    });

    it('should increment failed attempts on wrong password', async () => {
      const userWithNoAttempts = createMockUser({
        failedLoginAttempts: 0,
        lockoutUntil: null,
      });

      (argon2.verify as jest.Mock).mockResolvedValue(false);
      prisma.user.findUnique.mockResolvedValue(userWithNoAttempts);
      prisma.user.update.mockResolvedValue({
        ...userWithNoAttempts,
        failedLoginAttempts: 1,
        lockoutUntil: null,
      });

      await expect(
        authService.login({ email: 'test@donor.local' }, mockWrongPassword),
      ).rejects.toThrow(UnauthorizedException);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          failedLoginAttempts: 1,
          lockoutUntil: null,
        },
      });
    });
  });

  describe('Account Status Checks', () => {
    it('should reject suspended accounts', async () => {
      const suspendedUser = createMockUser({
        status: 'SUSPENDED' as UserStatus,
        failedLoginAttempts: 0,
        lockoutUntil: null,
      });

      (argon2.verify as jest.Mock).mockResolvedValue(true);
      prisma.user.findUnique.mockResolvedValue(suspendedUser);

      await expect(
        authService.login({ email: 'test@donor.local' }, mockCorrectPassword),
      ).rejects.toThrow(ForbiddenException);

      expect(auditLogsService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'LOGIN_FAILED',
          metadata: { reason: 'account_suspended' },
        }),
      );
    });

    it('should reject deactivated accounts', async () => {
      const deactivatedUser = createMockUser({
        status: 'DEACTIVATED' as UserStatus,
        failedLoginAttempts: 0,
        lockoutUntil: null,
      });

      (argon2.verify as jest.Mock).mockResolvedValue(true);
      prisma.user.findUnique.mockResolvedValue(deactivatedUser);

      await expect(
        authService.login({ email: 'test@donor.local' }, mockCorrectPassword),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject unverified email accounts', async () => {
      const unverifiedUser = createMockUser({
        status: 'PENDING_VERIFICATION' as UserStatus,
        emailVerified: false,
        failedLoginAttempts: 0,
        lockoutUntil: null,
      });

      (argon2.verify as jest.Mock).mockResolvedValue(true);
      prisma.user.findUnique.mockResolvedValue(unverifiedUser);

      await expect(
        authService.login({ email: 'test@donor.local' }, mockCorrectPassword),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Session Security', () => {
    it('should revoke all refresh tokens on password change', async () => {
      const user = createMockUser({
        memberships: [
          {
            role: { code: RoleCode.DONOR, id: 'role-1', name: 'Donor' },
            organizationId: 'org-1',
            status: 'ACTIVE',
          },
        ],
      });

      (argon2.verify as jest.Mock).mockResolvedValue(true);
      (argon2.hash as jest.Mock).mockResolvedValue('new-hash');
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.user.update.mockResolvedValue({
        ...user,
        passwordHash: 'new-hash',
      });
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 3 });

      await authService.changePassword(
        'user-1',
        mockCorrectPassword,
        'NewPassword123!',
        '127.0.0.1',
      );

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { revokedAt: expect.any(Date) },
      });

      expect(auditLogsService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PASSWORD_CHANGED',
        }),
      );
    });

    it('should fail password change with wrong current password', async () => {
      const user = createMockUser();

      (argon2.verify as jest.Mock).mockResolvedValue(false);
      prisma.user.findUnique.mockResolvedValue(user);

      await expect(
        authService.changePassword(
          'user-1',
          mockWrongPassword,
          'NewPassword123!',
          '127.0.0.1',
        ),
      ).rejects.toThrow(UnauthorizedException);

      expect(auditLogsService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PASSWORD_CHANGE_FAILED',
          metadata: { reason: 'invalid_current_password' },
        }),
      );
    });
  });

  describe('Audit Logging', () => {
    it('should log failed login attempts', async () => {
      const user = createMockUser({
        failedLoginAttempts: 0,
        lockoutUntil: null,
      });

      (argon2.verify as jest.Mock).mockResolvedValue(false);
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.user.update.mockResolvedValue({
        ...user,
        failedLoginAttempts: 1,
      });

      await expect(
        authService.login({ email: 'test@donor.local' }, mockWrongPassword),
      ).rejects.toThrow();

      expect(auditLogsService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'LOGIN_FAILED',
          metadata: expect.objectContaining({
            reason: 'invalid_password',
            failedAttempts: 1,
          }),
        }),
      );
    });

    it('records the identifier a failed sign-in was attempted with, so a spray is visible', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.login({ email: 'nonexistent@donor.local' }, mockWrongPassword),
      ).rejects.toThrow(UnauthorizedException);

      // The audit trail is internal, and an attempt against an address nobody
      // holds is exactly what an operator needs to see. What must not leak is
      // the *response*: the caller is told the same thing either way.
      expect(auditLogsService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'LOGIN_FAILED',
          metadata: {
            identifier: 'nonexistent@donor.local',
            via: 'email',
            reason: 'user_not_found',
          },
        }),
      );
    });

    it('masks the number when a sign-in is attempted by phone', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.login({ phone: '+998901234567' }, mockWrongPassword),
      ).rejects.toThrow(UnauthorizedException);

      // A full phone number in a log is a phone number in every copy of that
      // log. The last two digits are enough to match up an attempt with a
      // report; the rest is not ours to spread around.
      expect(auditLogsService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'LOGIN_FAILED',
          metadata: expect.objectContaining({ identifier: '+998*******67', via: 'phone' }),
        }),
      );
    });
  });
});
