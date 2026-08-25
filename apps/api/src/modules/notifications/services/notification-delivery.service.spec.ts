import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../database/prisma.service';
import { NotificationDeliveryService } from './notification-delivery.service';
import { PushDeviceService } from './push-device.service';
import { PushProviderService } from './push-provider.service';
import { NotificationPreferenceService } from './notification-preference.service';
import { DeliveryStatus, NotificationPriority } from '../dto';

type MockPrisma = {
  notification: { findUnique: jest.Mock; update: jest.Mock };
  notificationDelivery: { create: jest.Mock; update: jest.Mock };
};

describe('NotificationDeliveryService', () => {
  let service: NotificationDeliveryService;
  let prisma: MockPrisma;
  let pushDeviceService: { getActiveDevicesForUser: jest.Mock; markInvalidToken: jest.Mock };
  let pushProvider: { isValidToken: jest.Mock; send: jest.Mock };
  let preferenceService: { isInQuietHours: jest.Mock; shouldEmergencyOverride: jest.Mock };

  const baseNotification = {
    id: 'notif-1',
    recipientId: 'user-1',
    title: 'Emergency near you',
    body: 'A hospital needs O- blood.',
    type: 'EMERGENCY',
    priority: NotificationPriority.NORMAL,
    status: 'PENDING',
    deepLink: '/sos',
    data: null,
    expiresAt: null,
  };

  beforeEach(async () => {
    prisma = {
      notification: { findUnique: jest.fn(), update: jest.fn() },
      notificationDelivery: { create: jest.fn().mockResolvedValue({ id: 'delivery-1' }), update: jest.fn() },
    };

    pushDeviceService = {
      getActiveDevicesForUser: jest.fn(),
      markInvalidToken: jest.fn().mockResolvedValue(undefined),
    };

    pushProvider = {
      isValidToken: jest.fn().mockReturnValue(true),
      send: jest.fn(),
    };

    preferenceService = {
      isInQuietHours: jest.fn().mockResolvedValue(false),
      shouldEmergencyOverride: jest.fn().mockResolvedValue(false),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationDeliveryService,
        { provide: PrismaService, useValue: prisma },
        { provide: PushDeviceService, useValue: pushDeviceService },
        { provide: PushProviderService, useValue: pushProvider },
        { provide: NotificationPreferenceService, useValue: preferenceService },
      ],
    }).compile();

    service = module.get<NotificationDeliveryService>(NotificationDeliveryService);
  });

  it('throws when the notification does not exist', async () => {
    prisma.notification.findUnique.mockResolvedValue(null);
    await expect(service.deliver('missing')).rejects.toThrow('Notification not found');
  });

  it('short-circuits an expired notification without creating a delivery row', async () => {
    prisma.notification.findUnique.mockResolvedValue({ ...baseNotification, status: 'EXPIRED' });

    const result = await service.deliver('notif-1');

    expect(result).toEqual({ success: false, reason: 'Notification expired' });
    expect(prisma.notificationDelivery.create).not.toHaveBeenCalled();
  });

  it('fails with NO_ACTIVE_DEVICES when the recipient has no registered devices', async () => {
    prisma.notification.findUnique.mockResolvedValue(baseNotification);
    pushDeviceService.getActiveDevicesForUser.mockResolvedValue([]);

    const result = await service.deliver('notif-1');

    expect(result).toEqual({ success: false, reason: 'No active devices' });
    expect(prisma.notificationDelivery.update).toHaveBeenCalledWith({
      where: { id: 'delivery-1' },
      data: expect.objectContaining({ status: DeliveryStatus.FAILED, errorCode: 'NO_ACTIVE_DEVICES' }),
    });
  });

  it('queues a non-emergency notification during quiet hours instead of sending', async () => {
    prisma.notification.findUnique.mockResolvedValue(baseNotification);
    pushDeviceService.getActiveDevicesForUser.mockResolvedValue([{ token: 't1', platform: 'ios' }]);
    preferenceService.isInQuietHours.mockResolvedValue(true);

    const result = await service.deliver('notif-1');

    expect(result).toEqual({ success: false, reason: 'Queued for quiet hours', queued: true });
    expect(pushProvider.send).not.toHaveBeenCalled();
  });

  it('overrides quiet hours for a critical notification when the recipient allows it', async () => {
    prisma.notification.findUnique.mockResolvedValue({
      ...baseNotification,
      priority: NotificationPriority.CRITICAL,
    });
    pushDeviceService.getActiveDevicesForUser.mockResolvedValue([{ token: 't1', platform: 'ios' }]);
    preferenceService.isInQuietHours.mockResolvedValue(true);
    preferenceService.shouldEmergencyOverride.mockResolvedValue(true);
    pushProvider.send.mockResolvedValue([{ status: 'ok', id: 'ticket-1' }]);

    const result = await service.deliver('notif-1');

    expect(pushProvider.send).toHaveBeenCalled();
    expect(result).toEqual({ success: true, sent: 1, failed: 0 });
  });

  it('marks all-invalid-format tokens inactive and fails with NO_VALID_DEVICES without calling the provider', async () => {
    prisma.notification.findUnique.mockResolvedValue(baseNotification);
    pushDeviceService.getActiveDevicesForUser.mockResolvedValue([{ token: 'garbage', platform: 'ios' }]);
    pushProvider.isValidToken.mockReturnValue(false);

    const result = await service.deliver('notif-1');

    expect(pushDeviceService.markInvalidToken).toHaveBeenCalledWith('garbage');
    expect(pushProvider.send).not.toHaveBeenCalled();
    expect(result).toEqual({ success: false, reason: 'No valid devices' });
    expect(prisma.notificationDelivery.update).toHaveBeenCalledWith({
      where: { id: 'delivery-1' },
      data: expect.objectContaining({ status: DeliveryStatus.INVALID_TOKEN, errorCode: 'NO_VALID_DEVICES' }),
    });
  });

  it('marks the notification delivered and the underlying notification SENT on a successful push', async () => {
    prisma.notification.findUnique.mockResolvedValue(baseNotification);
    pushDeviceService.getActiveDevicesForUser.mockResolvedValue([
      { token: 'ExponentPushToken[aaaa]', platform: 'ios' },
    ]);
    pushProvider.send.mockResolvedValue([{ status: 'ok', id: 'ticket-1' }]);

    const result = await service.deliver('notif-1');

    expect(result).toEqual({ success: true, sent: 1, failed: 0 });
    expect(prisma.notificationDelivery.update).toHaveBeenCalledWith({
      where: { id: 'delivery-1' },
      data: expect.objectContaining({
        status: DeliveryStatus.DELIVERED,
        providerId: 'ticket-1',
      }),
    });
    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'notif-1' },
      data: { status: 'SENT' },
    });
  });

  it('deactivates a device on DeviceNotRegistered and reports failure when every device fails', async () => {
    prisma.notification.findUnique.mockResolvedValue(baseNotification);
    pushDeviceService.getActiveDevicesForUser.mockResolvedValue([
      { token: 'ExponentPushToken[stale]', platform: 'android' },
    ]);
    pushProvider.send.mockResolvedValue([
      { status: 'error', message: 'not registered', details: { error: 'DeviceNotRegistered' } },
    ]);

    const result = await service.deliver('notif-1');

    expect(pushDeviceService.markInvalidToken).toHaveBeenCalledWith('ExponentPushToken[stale]');
    expect(result).toEqual({ success: false, reason: 'DeviceNotRegistered' });
    expect(prisma.notificationDelivery.update).toHaveBeenCalledWith({
      where: { id: 'delivery-1' },
      data: expect.objectContaining({ status: DeliveryStatus.INVALID_TOKEN, errorCode: 'DeviceNotRegistered' }),
    });
    expect(prisma.notification.update).not.toHaveBeenCalled();
  });

  it('reports partial success when only some devices succeed', async () => {
    prisma.notification.findUnique.mockResolvedValue(baseNotification);
    pushDeviceService.getActiveDevicesForUser.mockResolvedValue([
      { token: 'ExponentPushToken[a]', platform: 'ios' },
      { token: 'ExponentPushToken[b]', platform: 'android' },
    ]);
    pushProvider.send.mockResolvedValue([
      { status: 'ok', id: 'ticket-1' },
      { status: 'error', message: 'boom', details: { error: 'MessageRateExceeded' } },
    ]);

    const result = await service.deliver('notif-1');

    expect(result).toEqual({ success: true, sent: 1, failed: 1 });
    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'notif-1' },
      data: { status: 'SENT' },
    });
  });

  it('catches an unexpected error and marks the delivery FAILED instead of throwing', async () => {
    prisma.notification.findUnique.mockResolvedValue(baseNotification);
    pushDeviceService.getActiveDevicesForUser.mockResolvedValue([{ token: 't1', platform: 'ios' }]);
    pushProvider.send.mockRejectedValue(new Error('boom'));

    const result = await service.deliver('notif-1');

    expect(result).toEqual({ success: false, reason: 'boom' });
    expect(prisma.notificationDelivery.update).toHaveBeenCalledWith({
      where: { id: 'delivery-1' },
      data: expect.objectContaining({ status: DeliveryStatus.FAILED, errorCode: 'boom' }),
    });
  });
});
