import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { UsersService } from './users.service';

function makeUser(overrides: Record<string, any> = {}) {
  return {
    id: 'user-1',
    email: 'donor@example.com',
    firstName: 'Aziz',
    lastName: 'Karimov',
    displayName: 'Aziz K.',
    avatarUrl: null,
    phone: '+998901234567',
    dateOfBirth: new Date('1995-01-01'),
    status: 'ACTIVE',
    emailVerified: true,
    phoneVerified: true,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('UsersService', () => {
  let service: UsersService;
  let prisma: any;
  let audit: { log: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
    };
    audit = { log: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogsService, useValue: audit },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('findById', () => {
    it('returns a redacted projection of the user (no password/hash fields)', async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser());

      const result = await service.findById('user-1');

      expect(result).toEqual(expect.objectContaining({ id: 'user-1', email: 'donor@example.com' }));
      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          select: expect.not.objectContaining({ passwordHash: true }),
        }),
      );
    });

    it('throws 404 when the user does not exist', async () => {
      // It used to return null, and the route wrapped that into a 200 with a
      // body of `{ data: null }` -- for a route whose own OpenAPI already
      // advertised a 404. Every client unwraps `json.data`, so "no such user"
      // arrived at the caller as a successful response carrying nothing.
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findById('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('findMany', () => {
    it('paginates using the given page and limit', async () => {
      prisma.user.findMany.mockResolvedValue([makeUser()]);
      prisma.user.count.mockResolvedValue(41);

      const result = await service.findMany(2, 20);

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 20 }),
      );
      expect(result.meta).toEqual({ page: 2, limit: 20, total: 41, totalPages: 3 });
    });

    it('defaults to page 1 / limit 20 when not provided', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      await service.findMany();

      expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 20 }));
    });
  });

  describe('getProfile', () => {
    it('throws NotFoundException when the user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getProfile('missing')).rejects.toThrow(NotFoundException);
    });

    it('returns null donorProfile/notificationPreference when neither relation exists', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...makeUser(), donorProfile: null, notificationPreference: null });

      const result = await service.getProfile('user-1');

      expect(result.data.donorProfile).toBeNull();
      expect(result.data.notificationPreference).toBeNull();
    });

    it('projects the donor profile and notification preference when present', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...makeUser(),
        donorProfile: {
          id: 'profile-1',
          bloodType: 'O',
          rhFactor: 'POSITIVE',
          bloodTypeVerifiedAt: null,
          bloodTypeSource: 'SELF_REPORTED',
          city: 'Tashkent',
          district: 'Chilanzar',
          donorStatus: 'ACTIVE',
          verificationStatus: 'VERIFIED',
          dateOfBirth: new Date('1995-01-01'),
          consentLocation: true,
        },
        notificationPreference: {
          id: 'pref-1',
          emergencyRequests: true,
          appointments: true,
          donationReminders: true,
          healthResults: true,
          system: true,
          gamification: true,
          bloodRequests: true,
          shipments: true,
          inventory: true,
          security: true,
        },
      });

      const result = await service.getProfile('user-1');

      expect(result.data.donorProfile).toEqual(
        expect.objectContaining({ id: 'profile-1', bloodType: 'O', city: 'Tashkent' }),
      );
      expect(result.data.notificationPreference).toEqual(
        expect.objectContaining({ id: 'pref-1', emergencyRequests: true }),
      );
    });
  });

  describe('updateProfile', () => {
    it('throws NotFoundException when the user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.updateProfile('missing', { firstName: 'New' })).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('falls back to the existing value for any field not included in the patch', async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser());
      prisma.user.update.mockResolvedValue(makeUser({ firstName: 'Updated' }));

      await service.updateProfile('user-1', { firstName: 'Updated' });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          firstName: 'Updated',
          lastName: 'Karimov',
          displayName: 'Aziz K.',
          phone: '+998901234567',
          dateOfBirth: makeUser().dateOfBirth,
        },
      });
    });

    it('writes an audit log entry with the actor id and IP address', async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser());
      prisma.user.update.mockResolvedValue(makeUser());

      await service.updateProfile('user-1', { firstName: 'Updated' }, '203.0.113.1');

      expect(audit.log).toHaveBeenCalledWith({
        actorId: 'user-1',
        action: 'USER_PROFILE_UPDATED',
        entityType: 'User',
        entityId: 'user-1',
        ipAddress: '203.0.113.1',
      });
    });

    it('does not include email/status in the returned data as directly writable, and echoes the updated row', async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser());
      prisma.user.update.mockResolvedValue(makeUser({ firstName: 'Updated' }));

      const result = await service.updateProfile('user-1', { firstName: 'Updated' });

      expect(result.data.firstName).toBe('Updated');
      expect(result.data.email).toBe('donor@example.com');
    });
  });
});
