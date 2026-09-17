import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationRouterService } from '../services/notification-router.service';
import { NotificationDeliveryService } from '../services/notification-delivery.service';
import { NotificationsService } from '../services/notifications.service';
import {
  APPOINTMENT_CANCELLED_EVENT,
  APPOINTMENT_CREATED_EVENT,
  APPOINTMENT_REMINDER_EVENT,
  type AppointmentCancelledPayload,
  type AppointmentCreatedPayload,
  type AppointmentReminderPayload,
} from '../appointment-notification.events';

const DONATION_COMPLETED_EVENT = 'donation.completed';
const BLOOD_TEST_COMPLETED_EVENT = 'blood-test.completed';
const SOS_REQUEST_CREATED_EVENT = 'sos.request.created';
const SOS_DONOR_ACCEPTED_EVENT = 'sos.donor.accepted';
const SOS_REQUEST_EXPIRED_EVENT = 'sos.request.expired';
const LAB_RESULT_PUBLISHED_EVENT = 'lab-result.published';
const ACHIEVEMENT_UNLOCKED_EVENT = 'achievement.unlocked';
const LEVEL_UP_EVENT = 'level.up';
const SHIPMENT_EVENT = 'shipment.event';
const INVENTORY_ALERT_EVENT = 'inventory.alert';
const SECURITY_EVENT = 'security.event';

interface DonationCompletedPayload {
  donationId: string;
  donorId: string;
  organizationId: string;
  isEmergency: boolean;
}

interface BloodTestCompletedPayload {
  resultId: string;
  donorId: string;
}

interface SosRequestCreatedPayload {
  requestId: string;
  bloodType: string;
  urgency: string;
  expireAt: Date;
  compatibleDonorIds: string[];
  hospitalRecipientIds?: string[];
}

interface SosDonorAcceptedPayload {
  requestId: string;
  donorId: string;
  donorName: string;
  hospitalRecipientIds: string[];
}

interface SosRequestExpiredPayload {
  requestId: string;
  recipientId: string;
}

interface LabResultPublishedPayload {
  resultId: string;
  donorId: string;
}

interface AchievementUnlockedPayload {
  achievementId: string;
  achievementName: string;
  userId: string;
}

interface LevelUpPayload {
  userId: string;
  newLevel: number;
}

interface ShipmentEventPayload {
  shipmentId: string;
  eventType: string;
  recipientIds: string[];
}

interface InventoryAlertPayload {
  inventoryId: string;
  bloodType: string;
  level: 'LOW' | 'CRITICAL';
  recipientIds: string[];
}

interface SecurityEventPayload {
  userId: string;
  eventType: string;
  details: string;
}

@Injectable()
export class NotificationEventHandler {
  private readonly logger = new Logger(NotificationEventHandler.name);

  constructor(
    private readonly router: NotificationRouterService,
    private readonly delivery: NotificationDeliveryService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @OnEvent(DONATION_COMPLETED_EVENT)
  async handleDonationCompleted(payload: DonationCompletedPayload) {
    try {
      this.logger.log(`Handling donation completed: ${payload.donationId}`);

      const result = await this.router.routeDonationConfirmation(
        { id: payload.donationId },
        payload.donorId,
      );

      for (const notification of result.notifications) {
        await this.delivery.deliver(notification.id);
      }
    } catch (error) {
      this.logger.error('Failed to handle donation completed event:', error);
    }
  }

  @OnEvent(BLOOD_TEST_COMPLETED_EVENT)
  async handleBloodTestCompleted(payload: BloodTestCompletedPayload) {
    try {
      this.logger.log(`Handling blood test completed: ${payload.resultId}`);

      const result = await this.router.routeLabResultNotification(
        { id: payload.resultId },
        payload.donorId,
      );

      for (const notification of result.notifications) {
        await this.delivery.deliver(notification.id);
      }
    } catch (error) {
      this.logger.error('Failed to handle blood test completed event:', error);
    }
  }

  @OnEvent(SOS_REQUEST_CREATED_EVENT)
  async handleSosRequestCreated(payload: SosRequestCreatedPayload) {
    try {
      this.logger.log(`Handling SOS created: ${payload.requestId}`);

      const result = await this.router.routeSosNotification(
        { id: payload.requestId, bloodType: payload.bloodType, urgency: payload.urgency, expireAt: payload.expireAt },
        payload.compatibleDonorIds,
      );

      for (const notification of result.notifications) {
        await this.delivery.deliver(notification.id);
      }
    } catch (error) {
      this.logger.error('Failed to handle SOS created event:', error);
    }
  }

  @OnEvent(SOS_DONOR_ACCEPTED_EVENT)
  async handleSosDonorAccepted(payload: SosDonorAcceptedPayload) {
    try {
      this.logger.log(`Handling SOS donor accepted: ${payload.requestId}`);

      const result = await this.router.route({
        type: 'EMERGENCY' as any,
        priority: 'HIGH' as any,
        title: 'Donor Accepted SOS',
        body: `${payload.donorName} has accepted the emergency blood request`,
        data: { requestId: payload.requestId, donorId: payload.donorId },
        // sos.tsx has no per-request detail route; see routeSosNotification.
        deepLink: '/sos',
        sourceType: 'SOS_RESPONSE',
        sourceId: `SOS_RESPONSE_${payload.requestId}_${payload.donorId}`,
        recipientIds: payload.hospitalRecipientIds || [],
        idempotencyKey: `SOS_ACCEPT:${payload.requestId}:${payload.donorId}`,
      });

      for (const notification of result.notifications) {
        await this.delivery.deliver(notification.id);
      }
    } catch (error) {
      this.logger.error('Failed to handle SOS donor accepted event:', error);
    }
  }

  @OnEvent(SOS_REQUEST_EXPIRED_EVENT)
  async handleSosRequestExpired(payload: SosRequestExpiredPayload) {
    try {
      this.logger.log(`Handling SOS expired: ${payload.requestId}`);

      const notifications = await this.notificationsService.findAll(
        { sourceId: payload.requestId, sourceType: 'SOS_REQUEST' },
        payload.recipientId,
      );

      for (const notification of notifications.items) {
        await this.notificationsService.expireNotification(notification.id);
      }
    } catch (error) {
      this.logger.error('Failed to handle SOS expired event:', error);
    }
  }

  @OnEvent(APPOINTMENT_CREATED_EVENT)
  async handleAppointmentCreated(payload: AppointmentCreatedPayload) {
    try {
      this.logger.log(`Handling appointment created: ${payload.appointmentId}`);

      const result = await this.router.routeAppointmentNotification(
        { id: payload.appointmentId, scheduledAt: payload.scheduledAt },
        payload.recipientIds,
        'created',
      );

      for (const notification of result.notifications) {
        await this.delivery.deliver(notification.id);
      }
    } catch (error) {
      this.logger.error('Failed to handle appointment created event:', error);
    }
  }

  @OnEvent(APPOINTMENT_REMINDER_EVENT)
  async handleAppointmentReminder(payload: AppointmentReminderPayload) {
    try {
      this.logger.log(`Handling appointment reminder: ${payload.appointmentId}`);

      const result = await this.router.routeAppointmentNotification(
        { id: payload.appointmentId, scheduledAt: payload.scheduledAt, reminderMinutes: payload.reminderMinutes },
        payload.recipientIds,
        'reminder',
      );

      for (const notification of result.notifications) {
        await this.delivery.deliver(notification.id);
      }
    } catch (error) {
      this.logger.error('Failed to handle appointment reminder event:', error);
    }
  }

  @OnEvent(APPOINTMENT_CANCELLED_EVENT)
  async handleAppointmentCancelled(payload: AppointmentCancelledPayload) {
    try {
      this.logger.log(`Handling appointment cancelled: ${payload.appointmentId}`);

      const result = await this.router.routeAppointmentNotification(
        { id: payload.appointmentId, scheduledAt: payload.scheduledAt },
        payload.recipientIds,
        'cancelled',
      );

      for (const notification of result.notifications) {
        await this.delivery.deliver(notification.id);
      }
    } catch (error) {
      this.logger.error('Failed to handle appointment cancelled event:', error);
    }
  }

  @OnEvent(LAB_RESULT_PUBLISHED_EVENT)
  async handleLabResultPublished(payload: LabResultPublishedPayload) {
    try {
      this.logger.log(`Handling lab result published: ${payload.resultId}`);

      const result = await this.router.routeLabResultNotification(
        { id: payload.resultId },
        payload.donorId,
      );

      for (const notification of result.notifications) {
        await this.delivery.deliver(notification.id);
      }
    } catch (error) {
      this.logger.error('Failed to handle lab result published event:', error);
    }
  }

  @OnEvent(ACHIEVEMENT_UNLOCKED_EVENT)
  async handleAchievementUnlocked(payload: AchievementUnlockedPayload) {
    try {
      this.logger.log(`Handling achievement unlocked: ${payload.achievementId}`);

      const result = await this.router.routeAchievementNotification(
        { id: payload.achievementId, name: payload.achievementName },
        payload.userId,
      );

      for (const notification of result.notifications) {
        await this.delivery.deliver(notification.id);
      }
    } catch (error) {
      this.logger.error('Failed to handle achievement unlocked event:', error);
    }
  }

  @OnEvent(LEVEL_UP_EVENT)
  async handleLevelUp(payload: LevelUpPayload) {
    try {
      this.logger.log(`Handling level up: ${payload.userId} to level ${payload.newLevel}`);

      const result = await this.router.routeLevelUpNotification(payload.userId, payload.newLevel);

      for (const notification of result.notifications) {
        await this.delivery.deliver(notification.id);
      }
    } catch (error) {
      this.logger.error('Failed to handle level up event:', error);
    }
  }

  @OnEvent(SHIPMENT_EVENT)
  async handleShipmentEvent(payload: ShipmentEventPayload) {
    try {
      this.logger.log(`Handling shipment event: ${payload.shipmentId} - ${payload.eventType}`);

      const result = await this.router.routeShipmentNotification(
        { id: payload.shipmentId },
        payload.recipientIds,
        payload.eventType,
      );

      for (const notification of result.notifications) {
        await this.delivery.deliver(notification.id);
      }
    } catch (error) {
      this.logger.error('Failed to handle shipment event:', error);
    }
  }

  @OnEvent(INVENTORY_ALERT_EVENT)
  async handleInventoryAlert(payload: InventoryAlertPayload) {
    try {
      this.logger.log(`Handling inventory alert: ${payload.inventoryId}`);

      const result = await this.router.routeInventoryAlert(
        { id: payload.inventoryId, bloodType: payload.bloodType },
        payload.recipientIds,
        payload.level,
      );

      for (const notification of result.notifications) {
        await this.delivery.deliver(notification.id);
      }
    } catch (error) {
      this.logger.error('Failed to handle inventory alert event:', error);
    }
  }

  @OnEvent(SECURITY_EVENT)
  async handleSecurityEvent(payload: SecurityEventPayload) {
    try {
      this.logger.log(`Handling security event for user: ${payload.userId}`);

      const result = await this.router.routeSecurityNotification(
        payload.userId,
        payload.eventType,
        payload.details,
      );

      for (const notification of result.notifications) {
        await this.delivery.deliver(notification.id);
      }
    } catch (error) {
      this.logger.error('Failed to handle security event:', error);
    }
  }
}
