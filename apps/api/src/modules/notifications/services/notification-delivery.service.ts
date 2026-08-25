import { Injectable, Logger } from '@nestjs/common';
import { ExpoPushMessage } from 'expo-server-sdk';
import { PrismaService } from '../../../database/prisma.service';
import { PushDeviceService } from './push-device.service';
import { PushProviderService } from './push-provider.service';
import { NotificationPreferenceService } from './notification-preference.service';
import { DeliveryStatus, NotificationPriority } from '../dto';

interface DeliverableNotification {
  id: string;
  title: string;
  body: string;
  type: string;
  priority: string;
  deepLink?: string | null;
  data?: unknown;
  expiresAt?: Date | null;
}

@Injectable()
export class NotificationDeliveryService {
  private readonly logger = new Logger(NotificationDeliveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushDeviceService: PushDeviceService,
    private readonly pushProvider: PushProviderService,
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
      const emergencyOverride =
        isEmergency && (await this.preferenceService.shouldEmergencyOverride(notification.recipientId));

      if (isInQuietHours && !emergencyOverride) {
        await this.updateDeliveryStatus(delivery.id, DeliveryStatus.PENDING, 'QUEUED_FOR_QUIET_HOURS');
        return { success: false, reason: 'Queued for quiet hours', queued: true };
      }

      const validDevices = devices.filter((d) => this.pushProvider.isValidToken(d.token));
      const invalidDevices = devices.filter((d) => !this.pushProvider.isValidToken(d.token));

      await Promise.all(
        invalidDevices.map((d) =>
          this.pushDeviceService.markInvalidToken(d.token).catch(() => undefined),
        ),
      );

      if (validDevices.length === 0) {
        await this.updateDeliveryStatus(delivery.id, DeliveryStatus.INVALID_TOKEN, 'NO_VALID_DEVICES');
        return { success: false, reason: 'No valid devices' };
      }

      const messages = validDevices.map((device) => this.buildPushMessage(device.token, notification));

      this.logger.debug(`Sending ${messages.length} push message(s) for notification ${notificationId}`);
      const tickets = await this.pushProvider.send(messages);

      let successes = 0;
      let failures = 0;
      let firstErrorCode: string | undefined;
      const successTicketIds: string[] = [];

      tickets.forEach((ticket, index) => {
        if (ticket.status === 'ok') {
          successes++;
          successTicketIds.push(ticket.id);
        } else {
          failures++;
          const errorCode = ticket.details?.error ?? 'UNKNOWN_ERROR';
          firstErrorCode = firstErrorCode ?? errorCode;

          if (errorCode === 'DeviceNotRegistered') {
            const device = validDevices[index];
            if (device) {
              this.pushDeviceService.markInvalidToken(device.token).catch(() => undefined);
            }
          }
        }
      });

      const now = new Date();
      const baseUpdate = {
        attempts: { increment: 1 },
        lastAttemptAt: now,
        ...(successTicketIds.length > 0 ? { providerId: successTicketIds.slice(0, 5).join(',') } : {}),
      };

      if (successes > 0) {
        await this.prisma.notificationDelivery.update({
          where: { id: delivery.id },
          data: { ...baseUpdate, status: DeliveryStatus.DELIVERED, deliveredAt: now },
        });

        await this.prisma.notification.update({
          where: { id: notificationId },
          data: { status: 'SENT' },
        });

        return { success: true, sent: successes, failed: failures };
      }

      const status =
        firstErrorCode === 'DeviceNotRegistered' ? DeliveryStatus.INVALID_TOKEN : DeliveryStatus.FAILED;

      await this.prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: { ...baseUpdate, status, failedAt: now, errorCode: firstErrorCode },
      });

      return { success: false, reason: firstErrorCode };
    } catch (error) {
      this.logger.error(`Failed to deliver notification ${notificationId}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.updateDeliveryStatus(delivery.id, DeliveryStatus.FAILED, errorMessage);
      return { success: false, reason: errorMessage };
    }
  }

  private buildPushMessage(token: string, notification: DeliverableNotification): ExpoPushMessage {
    const priority: ExpoPushMessage['priority'] =
      notification.priority === NotificationPriority.CRITICAL || notification.priority === NotificationPriority.HIGH
        ? 'high'
        : 'default';

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
        ...(typeof notification.data === 'object' && notification.data ? notification.data : {}),
      },
      sound: 'default',
      priority,
      ttl,
      expiration: notification.expiresAt ? Math.floor(new Date(notification.expiresAt).getTime() / 1000) : undefined,
    };
  }

  private async updateDeliveryStatus(id: string, status: DeliveryStatus, errorCode?: string) {
    const data: Record<string, unknown> = { status };

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
