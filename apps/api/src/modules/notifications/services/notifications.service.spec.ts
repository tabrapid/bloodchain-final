import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { NotificationsService } from './notifications.service';
import { NotificationStatus } from '../dto';

function makeNotification(overrides: Record<string, any> = {}) {
  return {
    id: 'notif-1',
    recipientId: 'user-1',
    type: 'DONATION',
    status: NotificationStatus.SENT,
    readAt: null,
    ...overrides,
  };
}

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      notification: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        groupBy: jest.fn().mockResolvedValue([]),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificationsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  describe('findAll', () => {
    it('excludes ARCHIVED notifications by default', async () => {
      await service.findAll({}, 'user-1');

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: { not: NotificationStatus.ARCHIVED } }),
        }),
      );
    });

    it('shows ARCHIVED notifications when explicitly filtered for them', async () => {
      await service.findAll({ status: NotificationStatus.ARCHIVED }, 'user-1');

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: NotificationStatus.ARCHIVED }) }),
      );
    });

    it('still applies a real status filter unrelated to archiving', async () => {
      await service.findAll({ status: NotificationStatus.READ }, 'user-1');

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: NotificationStatus.READ }) }),
      );
    });

    it('asks for a whole number of rows even when limit arrives as a string', async () => {
      // `take: limit + 1` on the string "5" asked Prisma for "51" rows, which
      // it refuses -- so every paginated inbox request answered 500.
      await service.findAll({ limit: '5' as unknown as number }, 'user-1');

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 6 }),
      );
    });

    it('defaults to a page of 50 when no limit is given', async () => {
      await service.findAll({}, 'user-1');

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 51 }),
      );
    });

    it('narrows to one source when asked, rather than returning the whole inbox', async () => {
      // The SOS-expiry handler passes these. They were silently ignored, so
      // expiring one SOS request expired every live notification that donor
      // had -- appointment reminders included.
      await service.findAll({ sourceType: 'SOS_REQUEST', sourceId: 'sos-1' }, 'user-1');

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ sourceType: 'SOS_REQUEST', sourceId: 'sos-1' }),
        }),
      );
    });
  });

  describe('getUnreadCount', () => {
    it('excludes ARCHIVED notifications from the unread count', async () => {
      await service.getUnreadCount('user-1');

      expect(prisma.notification.count).toHaveBeenCalledWith({
        where: { recipientId: 'user-1', readAt: null, status: { not: NotificationStatus.ARCHIVED } },
      });
    });
  });

  describe('getStats', () => {
    it('excludes ARCHIVED notifications from total, unread, and byType', async () => {
      await service.getStats('user-1');

      expect(prisma.notification.count).toHaveBeenNthCalledWith(1, {
        where: { recipientId: 'user-1', status: { not: NotificationStatus.ARCHIVED } },
      });
      expect(prisma.notification.count).toHaveBeenNthCalledWith(2, {
        where: { recipientId: 'user-1', readAt: null, status: { not: NotificationStatus.ARCHIVED } },
      });
      expect(prisma.notification.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { recipientId: 'user-1', status: { not: NotificationStatus.ARCHIVED } },
        }),
      );
    });
  });

  describe('archive', () => {
    it('sets status to ARCHIVED', async () => {
      prisma.notification.findUnique.mockResolvedValue(makeNotification());
      prisma.notification.update.mockResolvedValue(makeNotification({ status: NotificationStatus.ARCHIVED }));

      const result = await service.archive('notif-1', 'user-1');

      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        data: { status: NotificationStatus.ARCHIVED },
      });
      expect(result.status).toBe(NotificationStatus.ARCHIVED);
    });

    it('is idempotent when already ARCHIVED', async () => {
      const archived = makeNotification({ status: NotificationStatus.ARCHIVED });
      prisma.notification.findUnique.mockResolvedValue(archived);

      const result = await service.archive('notif-1', 'user-1');

      expect(prisma.notification.update).not.toHaveBeenCalled();
      expect(result).toBe(archived);
    });

    it('rejects archiving another user\'s notification', async () => {
      prisma.notification.findUnique.mockResolvedValue(makeNotification({ recipientId: 'someone-else' }));

      await expect(service.archive('notif-1', 'user-1')).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException for a missing notification', async () => {
      prisma.notification.findUnique.mockResolvedValue(null);

      await expect(service.archive('missing', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('unarchive', () => {
    it('reverts an archived-but-read notification to READ', async () => {
      prisma.notification.findUnique.mockResolvedValue(
        makeNotification({ status: NotificationStatus.ARCHIVED, readAt: new Date('2026-01-01') }),
      );
      prisma.notification.update.mockResolvedValue(makeNotification({ status: NotificationStatus.READ }));

      await service.unarchive('notif-1', 'user-1');

      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        data: { status: NotificationStatus.READ },
      });
    });

    it('reverts an archived-but-unread notification to SENT', async () => {
      prisma.notification.findUnique.mockResolvedValue(
        makeNotification({ status: NotificationStatus.ARCHIVED, readAt: null }),
      );
      prisma.notification.update.mockResolvedValue(makeNotification({ status: NotificationStatus.SENT }));

      await service.unarchive('notif-1', 'user-1');

      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        data: { status: NotificationStatus.SENT },
      });
    });

    it('is a no-op when the notification is not currently ARCHIVED', async () => {
      const notActive = makeNotification({ status: NotificationStatus.READ });
      prisma.notification.findUnique.mockResolvedValue(notActive);

      const result = await service.unarchive('notif-1', 'user-1');

      expect(prisma.notification.update).not.toHaveBeenCalled();
      expect(result).toBe(notActive);
    });
  });
});
