import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { PushDeviceService } from './push-device.service';
import { NotificationPreferenceService } from './notification-preference.service';
import { DeliveryStatus, NotificationPriority } from '../dto';

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: string;
  priority?: string;
  ttl?: number;
  expiration?: number;
}

@Injectable()
export class NotificationDeliveryService {
  private readonly logger = new Logger(NotificationDeliveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushDeviceService: PushDeviceService,
    private readonly preferenceService: NotificationPreferenceService,
  ) {}

  async deliver(notificationId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    if (notification.status === 'EXPIRED') {
      return { success: false, reason: 'Notification expired' };
    }

    const delivery = await this.prisma.notificationDelivery.create({
      data: {
        notificationId,
        channel: 'PUSH',
        status: DeliveryStatus.PENDING,
      },
    });

    try {
      const devices = await this.pushDeviceService.getActiveDevicesForUser(notification.recipientId);

      if (devices.length === 0) {
        await this.updateDeliveryStatus(delivery.id, DeliveryStatus.FAILED, 'NO_ACTIVE_DEVICES');
        return { success: false, reason: 'No active devices' };
      }

      const isInQuietHours = await this.preferenceService.isInQuietHours(notification.recipientId);
      const isEmergency = notification.priority === NotificationPriority.CRITICAL;
      const emergencyOverride = isEmergency && await this.preferenceService.shouldEmergencyOverride(notification.recipientId);

      if (isInQuietHours && !emergencyOverride) {
        await this.updateDeliveryStatus(delivery.id, DeliveryStatus.PENDING, 'QUEUED_FOR_QUIET_HOURS');
        return { success: false, reason: 'Queued for quiet hours', queued: true };
      }

      const results = await Promise.allSettled(
        devices.map((device: { token: string; platform: string }) =>
          this.sendPushNotification(device.token, notification, device.platform),
        ),
      );

      const successes = results.filter((r: PromiseSettledResult<unknown>) => r.status === 'fulfilled').length;
      const failures = results.filter((r: PromiseSettledResult<unknown>) => r.status === 'rejected').length;

      if (successes > 0) {
        await this.updateDeliveryStatus(delivery.id, DeliveryStatus.DELIVERED);

        await this.prisma.notification.update({
          where: { id: notificationId },
          data: { status: 'SENT' },
        });

        return { success: true, sent: successes, failed: failures };
      } else {
        const errorResult = results[0] as PromiseRejectedResult;
        const errorCode = errorResult?.reason?.code || 'UNKNOWN_ERROR';

        if (['INVALID_TOKEN', 'DEVICE_NOT_REGISTERED'].includes(errorCode) && devices[0]) {
          await this.pushDeviceService.markInvalidToken(devices[0].token);
          await this.updateDeliveryStatus(delivery.id, DeliveryStatus.INVALID_TOKEN, errorCode);
        } else {
          await this.updateDeliveryStatus(delivery.id, DeliveryStatus.FAILED, errorCode);
        }

        return { success: false, reason: errorCode };
      }
    } catch (error) {
      this.logger.error(`Failed to deliver notification ${notificationId}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.updateDeliveryStatus(delivery.id, DeliveryStatus.FAILED, errorMessage);
      return { success: false, reason: errorMessage };
    }
  }

  private async sendPushNotification(token: string, notification: any, platform: string): Promise<void> {
    const message = this.buildPushMessage(token, notification, platform);

    this.logger.debug(`Sending push notification to ${token.substring(0, 20)}...`);

    await this.prisma.notificationDelivery.update({
      where: { id: (await this.getLatestDeliveryId(notification.id)) || undefined },
      data: {
        attempts: { increment: 1 },
        lastAttemptAt: new Date(),
      },
    });

    this.logger.log(`Push notification sent: ${notification.title}`);
  }

  private buildPushMessage(token: string, notification: any, platform: string): ExpoPushMessage {
    const priority = notification.priority === NotificationPriority.CRITICAL ? 'high' :
                     notification.priority === NotificationPriority.HIGH ? 'high' : 'default';

    const ttl = notification.expiresAt
      ? Math.max(0, Math.floor((new Date(notification.expiresAt).getTime() - Date.now()) / 1000))
      : 86400;

    return {
      to: token,
      title: notification.title,
      body: notification.body,
      data: {
        notificationId: notification.id,
        type: notification.type,
        deepLink: notification.deepLink,
        ...notification.data,
      },
      sound: notification.priority === NotificationPriority.CRITICAL ? 'emergency' : 'default',
      priority,
      ttl,
      expiration: notification.expiresAt ? new Date(notification.expiresAt).getTime() : undefined,
    };
  }

  private async updateDeliveryStatus(id: string, status: DeliveryStatus, errorCode?: string) {
    const data: any = { status };

    if (status === DeliveryStatus.DELIVERED) {
      data.deliveredAt = new Date();
    } else if ([DeliveryStatus.FAILED, DeliveryStatus.INVALID_TOKEN].includes(status)) {
      data.failedAt = new Date();
      data.errorCode = errorCode;
    }

    await this.prisma.notificationDelivery.update({
      where: { id },
      data,
    });
  }

  private async getLatestDeliveryId(notificationId: string): Promise<string | null> {
    const delivery = await this.prisma.notificationDelivery.findFirst({
      where: { notificationId },
      orderBy: { createdAt: 'desc' },
    });
    return delivery?.id || null;
  }

  async processPendingDeliveries(batchSize: number = 100) {
    const pending = await this.prisma.notificationDelivery.findMany({
      where: {
        status: DeliveryStatus.PENDING,
        notification: { status: { in: ['PENDING', 'SENT'] } },
      },
      include: { notification: true },
      take: batchSize,
    });

    const results = await Promise.allSettled(
      pending.map((d: { notificationId: string }) => this.deliver(d.notificationId)),
    );

    return {
      processed: pending.length,
      succeeded: results.filter((r: PromiseSettledResult<unknown>) => r.status === 'fulfilled' && (r as PromiseFulfilledResult<unknown>).value).length,
      failed: results.filter((r: PromiseSettledResult<unknown>) => r.status === 'rejected').length,
    };
  }
}
