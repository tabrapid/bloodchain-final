import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { RoleCode } from '@prisma/client';
import * as argon2 from 'argon2';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../../database/prisma.service';
import { EmailService } from '../email/email.service';
import { PermissionsService } from '../../modules/permissions/permissions.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { AuthService } from './auth.service';
import { PhoneVerificationService } from './phone-verification.service';

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
  emailVerificationToken: {
    upsert: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  $transaction: jest.Mock;
};

describe('AuthService', () => {
  let service: AuthService;
  let prisma: MockPrisma;
  let jwt: Partial<JwtService>;
  let permissions: Partial<PermissionsService>;
  let email: Partial<EmailService>;
  let platformSettings: Partial<PlatformSettingsService>;

  beforeEach(async () => {
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
      emailVerificationToken: {
        upsert: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    jwt = {
      signAsync: jest.fn().mockResolvedValue('access-token'),
    };

    permissions = {
      getUserPermissions: jest.fn().mockResolvedValue(['user.read.self']),
    };

    email = {
      sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
    };

    platformSettings = {
      getSessionTimeoutMinutes: jest.fn().mockResolvedValue(43200),
      isEnabled: jest.fn().mockResolvedValue(true),
      isMaintenanceMode: jest.fn().mockResolvedValue(false),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn((key: string) => (key === 'JWT_ACCESS_SECRET' ? 'secret' : '15m')),
            get: jest.fn((key: string, fallback?: unknown) => {
              if (key === 'JWT_REFRESH_EXPIRES_IN') return '30d';
              if (key === 'API_URL') return 'http://localhost:3001';
              if (key === 'MOBILE_DEEP_LINK') return 'donor://';
              if (key === 'EMAIL_VERIFICATION_TTL_HOURS') return 24;
              return fallback;
            }),
          },
        },
        {
          provide: AuditLogsService,
          useValue: { log: jest.fn().mockResolvedValue({}) },
        },
        {
          provide: PermissionsService,
          useValue: permissions,
        },
        {
          provide: EmailService,
          useValue: email,
        },
        {
          provide: PlatformSettingsService,
          useValue: platformSettings,
        },
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

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('registers a new user and returns public fields', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.role.findUnique.mockResolvedValue({ id: 'r1', code: RoleCode.DONOR });
    prisma.$transaction.mockImplementation(async (callback) => {
      const tx = {
        user: {
          create: jest.fn().mockResolvedValue({
            id: 'u1',
            email: 'test@donor.local',
            firstName: 'Test',
            lastName: 'User',
            status: 'PENDING_VERIFICATION',
          }),
        },
        donorProfile: { create: jest.fn().mockResolvedValue({}) },
        organization: {
          findFirst: jest.fn().mockResolvedValue({ id: 'org1', name: 'DONOR Donors' }),
          create: jest.fn().mockResolvedValue({ id: 'org1', name: 'DONOR Donors' }),
        },
        organizationMembership: { create: jest.fn().mockResolvedValue({}) },
      };
      return callback(tx);
    });

    const result = await service.register({
      email: 'test@donor.local',
      password: 'SecurePassword123!',
      firstName: 'Test',
      lastName: 'User',
    });

    expect(result.data.email).toBe('test@donor.local');
  });

  it('creates a SYSTEM-type placeholder org for a donor, never a fake HOSPITAL', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.role.findUnique.mockResolvedValue({ id: 'r1', code: RoleCode.DONOR });
    const findFirst = jest.fn().mockResolvedValue(null);
    const orgCreate = jest.fn().mockResolvedValue({ id: 'sys-org', type: 'SYSTEM' });
    prisma.$transaction.mockImplementation(async (callback) => {
      const tx = {
        user: {
          create: jest.fn().mockResolvedValue({
            id: 'u1',
            email: 'test@donor.local',
            firstName: 'Test',
            lastName: 'User',
            status: 'PENDING_VERIFICATION',
          }),
        },
        donorProfile: { create: jest.fn().mockResolvedValue({}) },
        organization: { findFirst, create: orgCreate },
        organizationMembership: { create: jest.fn().mockResolvedValue({}) },
      };
      return callback(tx);
    });

    await service.register({
      email: 'test@donor.local',
      password: 'SecurePassword123!',
      firstName: 'Test',
      lastName: 'User',
    });

    expect(findFirst).toHaveBeenCalledWith({ where: { type: 'SYSTEM' } });
    expect(orgCreate).toHaveBeenCalledWith({
      data: {
        type: 'SYSTEM',
        name: 'Donor Accounts (System)',
        status: 'ACTIVE',
      },
    });
  });

  it('reuses an existing SYSTEM org instead of creating a duplicate', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.role.findUnique.mockResolvedValue({ id: 'r1', code: RoleCode.DONOR });
    const orgCreate = jest.fn();
    prisma.$transaction.mockImplementation(async (callback) => {
      const tx = {
        user: {
          create: jest.fn().mockResolvedValue({
            id: 'u1',
            email: 'test2@donor.local',
            firstName: 'Test',
            lastName: 'User',
            status: 'PENDING_VERIFICATION',
          }),
        },
        donorProfile: { create: jest.fn().mockResolvedValue({}) },
        organization: {
          findFirst: jest.fn().mockResolvedValue({ id: 'sys-org', type: 'SYSTEM' }),
          create: orgCreate,
        },
        organizationMembership: { create: jest.fn().mockResolvedValue({}) },
      };
      return callback(tx);
    });

    await service.register({
      email: 'test2@donor.local',
      password: 'SecurePassword123!',
      firstName: 'Test',
      lastName: 'User',
    });

    expect(orgCreate).not.toHaveBeenCalled();
  });

  it('rejects registration with existing email', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'existing', email: 'test@donor.local' });

    await expect(
      service.register({
        email: 'test@donor.local',
        password: 'SecurePassword123!',
        firstName: 'Test',
        lastName: 'User',
      }),
    ).rejects.toThrow();
  });

  it('registers a new organization pending approval, with an admin membership', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.role.findUnique.mockResolvedValue({ id: 'role-hospital-admin', code: RoleCode.HOSPITAL_ADMIN });
    const txOrganizationCreate = jest.fn().mockResolvedValue({
      id: 'org1',
      name: 'Northstar Hospital',
      type: 'HOSPITAL',
      status: 'PENDING_APPROVAL',
    });
    const txUserCreate = jest.fn().mockResolvedValue({
      id: 'u1',
      email: 'admin@northstar.example',
      firstName: 'Alex',
      lastName: 'Rivera',
      status: 'PENDING_VERIFICATION',
    });
    const txMembershipCreate = jest.fn().mockResolvedValue({});
    prisma.$transaction.mockImplementation(async (callback) => {
      const tx = {
        organization: { create: txOrganizationCreate },
        user: { create: txUserCreate },
        organizationMembership: { create: txMembershipCreate },
      };
      return callback(tx);
    });

    const result = await service.registerOrganization({
      organizationType: 'HOSPITAL',
      organizationName: 'Northstar Hospital',
      adminEmail: 'admin@northstar.example',
      adminPassword: 'SecurePassword123!',
      adminFirstName: 'Alex',
      adminLastName: 'Rivera',
    } as any);

    expect(result.data.organization.status).toBe('PENDING_APPROVAL');
    expect(result.data.user.email).toBe('admin@northstar.example');
    expect(txOrganizationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'HOSPITAL',
          status: 'PENDING_APPROVAL',
          hospital: { create: {} },
        }),
      }),
    );
    expect(txMembershipCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ roleId: 'role-hospital-admin', status: 'ACTIVE' }),
      }),
    );
  });

  it('rejects organization registration with an already-registered admin email', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'existing', email: 'admin@northstar.example' });

    await expect(
      service.registerOrganization({
        organizationType: 'HOSPITAL',
        organizationName: 'Northstar Hospital',
        adminEmail: 'admin@northstar.example',
        adminPassword: 'SecurePassword123!',
        adminFirstName: 'Alex',
        adminLastName: 'Rivera',
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('logs in with valid credentials', async () => {
    const passwordHash = await argon2.hash('SecurePassword123!');
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'test@donor.local',
      firstName: 'Test',
      lastName: 'User',
      status: 'ACTIVE',
      emailVerified: true,
      passwordHash,
      memberships: [
        { role: { code: RoleCode.DONOR }, organization: { type: 'HOSPITAL' }, status: 'ACTIVE' },
      ],
    });

    const result = await service.login({ email: 'test@donor.local' }, 'SecurePassword123!');

    expect(result.data.accessToken).toBe('access-token');
    expect(result.data.user.roles).toContain(RoleCode.DONOR);
  });

  it('rejects login with invalid credentials', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.login({ email: 'test@donor.local' }, 'wrong')).rejects.toThrow(UnauthorizedException);
  });

  it('rejects login for suspended user', async () => {
    const passwordHash = await argon2.hash('SecurePassword123!');
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'test@donor.local',
      firstName: 'Test',
      lastName: 'User',
      status: 'SUSPENDED',
      passwordHash,
      memberships: [],
    });

    await expect(service.login({ email: 'test@donor.local' }, 'SecurePassword123!')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('rejects login for deactivated user', async () => {
    const passwordHash = await argon2.hash('SecurePassword123!');
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'test@donor.local',
      firstName: 'Test',
      lastName: 'User',
      status: 'DEACTIVATED',
      passwordHash,
      memberships: [],
    });

    await expect(service.login({ email: 'test@donor.local' }, 'SecurePassword123!')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('rejects login for a non-admin while the platform is in maintenance mode', async () => {
    (platformSettings.isMaintenanceMode as jest.Mock).mockResolvedValue(true);
    const passwordHash = await argon2.hash('SecurePassword123!');
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'test@donor.local',
      firstName: 'Test',
      lastName: 'User',
      status: 'ACTIVE',
      emailVerified: true,
      passwordHash,
      memberships: [{ role: { code: RoleCode.DONOR }, organization: { type: 'HOSPITAL' }, status: 'ACTIVE' }],
    });

    await expect(service.login({ email: 'test@donor.local' }, 'SecurePassword123!')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('still allows a SUPER_ADMIN to log in during maintenance mode', async () => {
    (platformSettings.isMaintenanceMode as jest.Mock).mockResolvedValue(true);
    const passwordHash = await argon2.hash('SecurePassword123!');
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'admin@donor.local',
      firstName: 'Admin',
      lastName: 'User',
      status: 'ACTIVE',
      emailVerified: true,
      passwordHash,
      failedLoginAttempts: 0,
      memberships: [{ role: { code: RoleCode.SUPER_ADMIN }, organization: { type: 'HOSPITAL' }, status: 'ACTIVE' }],
    });

    const result = await service.login({ email: 'admin@donor.local' }, 'SecurePassword123!');
    expect(result.data.accessToken).toBe('access-token');
  });

  it('refreshes tokens with valid refresh token', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt1',
      tokenHash: 'hash',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 86400000),
      user: {
        id: 'u1',
        email: 'test@donor.local',
        firstName: 'Test',
        lastName: 'User',
        status: 'ACTIVE',
        memberships: [
          { role: { code: RoleCode.DONOR }, organization: { type: 'HOSPITAL' }, status: 'ACTIVE' },
        ],
      },
    });

    const result = await service.refresh('valid-refresh-token');

    expect(result.data.accessToken).toBe('access-token');
    expect(result.data.user.roles).toContain(RoleCode.DONOR);
  });

  it('rejects refresh with expired token', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt1',
      tokenHash: 'hash',
      revokedAt: null,
      expiresAt: new Date(Date.now() - 86400000),
      user: {
        id: 'u1',
        email: 'test@donor.local',
        firstName: 'Test',
        lastName: 'User',
        status: 'ACTIVE',
        memberships: [],
      },
    });

    await expect(service.refresh('expired-refresh-token')).rejects.toThrow(UnauthorizedException);
  });

  it('logs out and revokes refresh token', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt1',
      tokenHash: 'hash',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 86400000),
    });

    await service.logout('refresh-token', 'u1');

    expect(prisma.refreshToken.update).toHaveBeenCalledWith({
      where: { id: 'rt1' },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('sends a verification email on registration', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.role.findUnique.mockResolvedValue({ id: 'r1', code: RoleCode.DONOR });
    prisma.$transaction.mockImplementation(async (callback) => {
      const tx = {
        user: {
          create: jest.fn().mockResolvedValue({
            id: 'u1',
            email: 'test@donor.local',
            firstName: 'Test',
            lastName: 'User',
            status: 'PENDING_VERIFICATION',
          }),
        },
        donorProfile: { create: jest.fn().mockResolvedValue({}) },
        organization: {
          findFirst: jest.fn().mockResolvedValue({ id: 'org1', name: 'DONOR Donors' }),
          create: jest.fn().mockResolvedValue({ id: 'org1', name: 'DONOR Donors' }),
        },
        organizationMembership: { create: jest.fn().mockResolvedValue({}) },
      };
      return callback(tx);
    });

    await service.register({
      email: 'test@donor.local',
      password: 'SecurePassword123!',
      firstName: 'Test',
      lastName: 'User',
    });

    expect(prisma.emailVerificationToken.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u1' } }),
    );
    expect(email.sendVerificationEmail).toHaveBeenCalledWith(
      'test@donor.local',
      'Test',
      expect.stringContaining('/auth/verify-email?token='),
      expect.stringContaining('donor://verify-email?token='),
    );
  });

  it('verifies an email with a valid token and returns an authenticated session', async () => {
    prisma.emailVerificationToken.findUnique.mockResolvedValue({
      userId: 'u1',
      token: 'valid-token',
      usedAt: null,
      expiresAt: new Date(Date.now() + 3600_000),
      user: { id: 'u1', status: 'PENDING_VERIFICATION', emailVerified: false },
    });
    prisma.$transaction.mockResolvedValue([{}, {}]);
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'test@donor.local',
      firstName: 'Test',
      lastName: 'User',
      status: 'ACTIVE',
      memberships: [
        { role: { code: RoleCode.DONOR }, organization: { type: 'HOSPITAL' }, status: 'ACTIVE' },
      ],
    });

    const result = await service.verifyEmail('valid-token');

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(result.data.accessToken).toBe('access-token');
    expect(result.data.user.email).toBe('test@donor.local');
  });

  it('rejects verification with an unknown token', async () => {
    prisma.emailVerificationToken.findUnique.mockResolvedValue(null);
    await expect(service.verifyEmail('unknown-token')).rejects.toThrow(BadRequestException);
  });

  it('rejects verification with an expired token', async () => {
    prisma.emailVerificationToken.findUnique.mockResolvedValue({
      userId: 'u1',
      token: 'expired-token',
      usedAt: null,
      expiresAt: new Date(Date.now() - 3600_000),
      user: { id: 'u1', status: 'PENDING_VERIFICATION', emailVerified: false },
    });

    await expect(service.verifyEmail('expired-token')).rejects.toThrow(BadRequestException);
  });

  it('treats an already-used token as success if the account ended up verified', async () => {
    prisma.emailVerificationToken.findUnique.mockResolvedValue({
      userId: 'u1',
      token: 'used-token',
      usedAt: new Date(),
      expiresAt: new Date(Date.now() + 3600_000),
      user: { id: 'u1', status: 'ACTIVE', emailVerified: true },
    });
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'test@donor.local',
      firstName: 'Test',
      lastName: 'User',
      status: 'ACTIVE',
      memberships: [],
    });

    const result = await service.verifyEmail('used-token');
    expect(result.data.user.email).toBe('test@donor.local');
  });

  it('rejects a used, still-unverified token', async () => {
    prisma.emailVerificationToken.findUnique.mockResolvedValue({
      userId: 'u1',
      token: 'used-token',
      usedAt: new Date(),
      expiresAt: new Date(Date.now() + 3600_000),
      user: { id: 'u1', status: 'PENDING_VERIFICATION', emailVerified: false },
    });

    await expect(service.verifyEmail('used-token')).rejects.toThrow(BadRequestException);
  });

  it('resend-verification silently no-ops for an unknown email (no enumeration)', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const result = await service.resendVerification('nobody@donor.local');

    expect(result.data.success).toBe(true);
    expect(email.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('resend-verification sends a new email for an unverified account', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'test@donor.local',
      firstName: 'Test',
      emailVerified: false,
    });

    const result = await service.resendVerification('test@donor.local');

    expect(result.data.success).toBe(true);
    expect(prisma.emailVerificationToken.upsert).toHaveBeenCalled();
    expect(email.sendVerificationEmail).toHaveBeenCalled();
  });
});
