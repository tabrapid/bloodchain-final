import { Test, TestingModule } from '@nestjs/testing';
import { AINotificationService } from './ai-notification.service';
import { NotificationsService } from '../notifications/services/notifications.service';
import { PrismaService } from '../../database/prisma.service';

describe('AINotificationService', () => {
  let service: AINotificationService;
  let notificationsService: { create: jest.Mock };
  let mockPrisma: { notificationPreference: { findUnique: jest.Mock } };

  beforeEach(async () => {
    notificationsService = { create: jest.fn().mockResolvedValue({ id: 'notif-1' }) };
    mockPrisma = { notificationPreference: { findUnique: jest.fn().mockResolvedValue(null) } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AINotificationService,
        { provide: NotificationsService, useValue: notificationsService },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AINotificationService>(AINotificationService);
  });

  describe('notifyInsightReady', () => {
    it('sends deepLink as a top-level field, not buried inside data', async () => {
      await service.notifyInsightReady('user-1', 'TREND_SUMMARY' as any, 'src-1');

      expect(notificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({ deepLink: '/(app)/insights' }),
      );
      const call = notificationsService.create.mock.calls[0][0];
      expect(call.data).not.toHaveProperty('deepLink');
    });

    it('skips notifying when the user disabled health result notifications', async () => {
      mockPrisma.notificationPreference.findUnique.mockResolvedValue({ healthResults: false });

      await service.notifyInsightReady('user-1', 'TREND_SUMMARY' as any, 'src-1');

      expect(notificationsService.create).not.toHaveBeenCalled();
    });
  });

  describe('notifyAnalysisComplete', () => {
    it('sends deepLink as a top-level field on failure', async () => {
      await service.notifyAnalysisComplete('user-1', false, 'TREND_SUMMARY');

      expect(notificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({ deepLink: '/(app)/insights' }),
      );
      const call = notificationsService.create.mock.calls[0][0];
      expect(call.data).not.toHaveProperty('deepLink');
    });

    it('does not notify on success', async () => {
      await service.notifyAnalysisComplete('user-1', true, 'TREND_SUMMARY');

      expect(notificationsService.create).not.toHaveBeenCalled();
    });
  });
});
