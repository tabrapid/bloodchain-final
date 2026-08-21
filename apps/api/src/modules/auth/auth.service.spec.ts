import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { RoleCode } from '@prisma/client';
import * as argon2 from 'argon2';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../../database/prisma.service';
import { PermissionsService } from '../../modules/permissions/permissions.service';
import { AuthService } from './auth.service';

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
  $transaction: jest.Mock;
};

describe('AuthService', () => {
  let service: AuthService;
  let prisma: MockPrisma;
  let jwt: Partial<JwtService>;
  let permissions: Partial<PermissionsService>;

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
      $transaction: jest.fn(),
    };

    jwt = {
      signAsync: jest.fn().mockResolvedValue('access-token'),
    };

    permissions = {
      getUserPermissions: jest.fn().mockResolvedValue(['user.read.self']),
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
            get: jest.fn((key: string) => (key === 'JWT_REFRESH_EXPIRES_IN' ? '30d' : undefined)),
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

    const result = await service.login('test@donor.local', 'SecurePassword123!');

    expect(result.data.accessToken).toBe('access-token');
    expect(result.data.user.roles).toContain(RoleCode.DONOR);
  });

  it('rejects login with invalid credentials', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.login('test@donor.local', 'wrong')).rejects.toThrow(UnauthorizedException);
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

    await expect(service.login('test@donor.local', 'SecurePassword123!')).rejects.toThrow(
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

    await expect(service.login('test@donor.local', 'SecurePassword123!')).rejects.toThrow(
      ForbiddenException,
    );
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
});
