import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PlatformSettingsService } from './platform-settings.service';

function makeSettings(overrides: Record<string, any> = {}) {
  return {
    id: 'platform',
    sessionTimeoutMinutes: 43200,
    aiHealthInsightsEnabled: true,
    sosEmergencyEnabled: true,
    gamificationEnabled: true,
    pushNotificationsEnabled: true,
    maintenanceMode: false,
    ...overrides,
  };
}

describe('PlatformSettingsService', () => {
  let service: PlatformSettingsService;
  let prisma: any;
  let audit: { log: jest.Mock };

  beforeEach(async () => {
    prisma = {
      platformSettings: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    audit = { log: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformSettingsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogsService, useValue: audit },
      ],
    }).compile();

    service = module.get<PlatformSettingsService>(PlatformSettingsService);
  });

  describe('get', () => {
    it('returns the existing singleton row when one exists', async () => {
      prisma.platformSettings.findUnique.mockResolvedValue(makeSettings());

      const result = await service.get();

      expect(prisma.platformSettings.create).not.toHaveBeenCalled();
      expect(result.id).toBe('platform');
    });

    it('creates the singleton row with defaults on first access', async () => {
      prisma.platformSettings.findUnique.mockResolvedValue(null);
      prisma.platformSettings.create.mockResolvedValue(makeSettings());

      await service.get();

      expect(prisma.platformSettings.create).toHaveBeenCalledWith({ data: { id: 'platform' } });
    });
  });

  describe('update', () => {
    it('updates only the patched fields and stamps updatedById', async () => {
      prisma.platformSettings.findUnique.mockResolvedValue(makeSettings());
      prisma.platformSettings.update.mockResolvedValue(makeSettings({ maintenanceMode: true }));

      await service.update('admin-1', { maintenanceMode: true });

      expect(prisma.platformSettings.update).toHaveBeenCalledWith({
        where: { id: 'platform' },
        data: { maintenanceMode: true, updatedById: 'admin-1' },
      });
    });

    it('creates the singleton row first if it does not exist yet, before updating it', async () => {
      prisma.platformSettings.findUnique.mockResolvedValue(null);
      prisma.platformSettings.create.mockResolvedValue(makeSettings());
      prisma.platformSettings.update.mockResolvedValue(makeSettings({ maintenanceMode: true }));

      await service.update('admin-1', { maintenanceMode: true });

      expect(prisma.platformSettings.create).toHaveBeenCalledWith({ data: { id: 'platform' } });
      expect(prisma.platformSettings.update).toHaveBeenCalled();
    });

    it('audit-logs the change with the patch as metadata', async () => {
      prisma.platformSettings.findUnique.mockResolvedValue(makeSettings());
      prisma.platformSettings.update.mockResolvedValue(makeSettings({ sosEmergencyEnabled: false }));

      await service.update('admin-1', { sosEmergencyEnabled: false });

      expect(audit.log).toHaveBeenCalledWith({
        actorId: 'admin-1',
        action: 'PLATFORM_SETTINGS_UPDATED',
        entityType: 'PlatformSettings',
        entityId: 'platform',
        metadata: { sosEmergencyEnabled: false },
      });
    });
  });

  describe('isEnabled', () => {
    it('reads the requested boolean flag off the singleton row', async () => {
      prisma.platformSettings.findUnique.mockResolvedValue(makeSettings({ gamificationEnabled: false }));

      expect(await service.isEnabled('gamificationEnabled')).toBe(false);
    });
  });

  describe('isMaintenanceMode', () => {
    it('reflects the current maintenanceMode flag', async () => {
      prisma.platformSettings.findUnique.mockResolvedValue(makeSettings({ maintenanceMode: true }));

      expect(await service.isMaintenanceMode()).toBe(true);
    });
  });

  describe('getSessionTimeoutMinutes', () => {
    it('reflects the current sessionTimeoutMinutes value', async () => {
      prisma.platformSettings.findUnique.mockResolvedValue(makeSettings({ sessionTimeoutMinutes: 60 }));

      expect(await service.getSessionTimeoutMinutes()).toBe(60);
    });
  });
});
