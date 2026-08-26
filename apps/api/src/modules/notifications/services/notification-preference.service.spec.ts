import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../database/prisma.service';
import { AuditLogsService } from '../../audit-logs/audit-logs.service';
import { NotificationPreferenceService } from './notification-preference.service';

function makePrefs(overrides: Record<string, any> = {}) {
  return {
    id: 'pref-1',
    userId: 'user-1',
    emergencyRequests: true,
    appointments: true,
    donationReminders: true,
    healthResults: false,
    gamification: true,
    bloodRequests: true,
    shipments: true,
    inventory: true,
    system: true,
    security: true,
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '07:00',
    quietHoursTimezone: 'UTC',
    emergencyOverride: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('NotificationPreferenceService', () => {
  let service: NotificationPreferenceService;
  let prisma: any;
  let audit: { log: jest.Mock };

  beforeEach(async () => {
    prisma = {
      notificationPreference: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    audit = { log: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationPreferenceService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogsService, useValue: audit },
      ],
    }).compile();

    service = module.get<NotificationPreferenceService>(NotificationPreferenceService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('getPreferences', () => {
    it('returns existing preferences', async () => {
      prisma.notificationPreference.findUnique.mockResolvedValue(makePrefs());

      const result = await service.getPreferences('user-1');

      expect(prisma.notificationPreference.create).not.toHaveBeenCalled();
      expect(result.id).toBe('pref-1');
      expect(result.healthResults).toBe(false);
    });

    it('creates a default row when none exists yet', async () => {
      prisma.notificationPreference.findUnique.mockResolvedValue(null);
      prisma.notificationPreference.create.mockResolvedValue(makePrefs());

      await service.getPreferences('user-1');

      expect(prisma.notificationPreference.create).toHaveBeenCalledWith({ data: { userId: 'user-1' } });
    });
  });

  describe('updatePreferences', () => {
    it('updates an existing row and audit-logs the change', async () => {
      prisma.notificationPreference.findUnique.mockResolvedValue(makePrefs());
      prisma.notificationPreference.update.mockResolvedValue(makePrefs({ healthResults: true }));

      const result = await service.updatePreferences('user-1', { healthResults: true }, '1.2.3.4');

      expect(prisma.notificationPreference.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { healthResults: true },
      });
      expect(audit.log).toHaveBeenCalledWith({
        actorId: 'user-1',
        action: 'NOTIFICATION_PREFERENCES_UPDATED',
        entityType: 'NotificationPreference',
        entityId: 'pref-1',
        ipAddress: '1.2.3.4',
      });
      expect(result.healthResults).toBe(true);
    });

    it('creates a new row seeded with the update when none exists yet', async () => {
      prisma.notificationPreference.findUnique.mockResolvedValue(null);
      prisma.notificationPreference.create.mockResolvedValue(makePrefs({ healthResults: true }));

      await service.updatePreferences('user-1', { healthResults: true });

      expect(prisma.notificationPreference.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', healthResults: true },
      });
      expect(prisma.notificationPreference.update).not.toHaveBeenCalled();
      expect(audit.log).toHaveBeenCalled();
    });
  });

  describe('isChannelEnabled', () => {
    it('maps a known category to its preference field', async () => {
      prisma.notificationPreference.findUnique.mockResolvedValue(makePrefs({ healthResults: false }));

      expect(await service.isChannelEnabled('user-1', 'health')).toBe(false);
    });

    it('defaults to true for an unrecognized category', async () => {
      prisma.notificationPreference.findUnique.mockResolvedValue(makePrefs());

      expect(await service.isChannelEnabled('user-1', 'not-a-real-category')).toBe(true);
    });
  });

  describe('isInQuietHours', () => {
    it('returns false when quiet hours are disabled', async () => {
      prisma.notificationPreference.findUnique.mockResolvedValue(makePrefs({ quietHoursEnabled: false }));

      expect(await service.isInQuietHours('user-1')).toBe(false);
    });

    it('returns true for a time inside an overnight quiet window (22:00-07:00 UTC)', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-01-15T23:30:00.000Z'));
      prisma.notificationPreference.findUnique.mockResolvedValue(
        makePrefs({ quietHoursEnabled: true, quietHoursStart: '22:00', quietHoursEnd: '07:00', quietHoursTimezone: 'UTC' }),
      );

      expect(await service.isInQuietHours('user-1')).toBe(true);
    });

    it('returns false for a time outside an overnight quiet window', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-01-15T12:00:00.000Z'));
      prisma.notificationPreference.findUnique.mockResolvedValue(
        makePrefs({ quietHoursEnabled: true, quietHoursStart: '22:00', quietHoursEnd: '07:00', quietHoursTimezone: 'UTC' }),
      );

      expect(await service.isInQuietHours('user-1')).toBe(false);
    });

    it('returns true for a time inside a same-day quiet window', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-01-15T13:00:00.000Z'));
      prisma.notificationPreference.findUnique.mockResolvedValue(
        makePrefs({ quietHoursEnabled: true, quietHoursStart: '12:00', quietHoursEnd: '14:00', quietHoursTimezone: 'UTC' }),
      );

      expect(await service.isInQuietHours('user-1')).toBe(true);
    });
  });

  describe('shouldEmergencyOverride', () => {
    it('returns the stored flag', async () => {
      prisma.notificationPreference.findUnique.mockResolvedValue(makePrefs({ emergencyOverride: false }));

      expect(await service.shouldEmergencyOverride('user-1')).toBe(false);
    });
  });
});
