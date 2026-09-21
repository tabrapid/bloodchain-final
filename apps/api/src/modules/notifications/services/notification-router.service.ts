import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  NotificationType,
  NotificationPriority,
  UserRole,
} from '../dto';
import { NotificationsService } from './notifications.service';
import type { InventoryAlertPayload } from '../operational-notification.events';

/** What `routeInventoryAlert` needs; the emitted payload satisfies it. */
type InventoryAlertNotification = InventoryAlertPayload;

interface NotificationEvent {
  type: NotificationType;
  priority?: NotificationPriority;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  deepLink?: string;
  sourceType: string;
  sourceId: string;
  recipientIds: string[];
  idempotencyKey?: string;
  expiresAt?: Date;
}

@Injectable()
export class NotificationRouterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async route(event: NotificationEvent) {
    const notifications = await Promise.all(
      event.recipientIds.map(recipientId =>
        this.notificationsService.create({
          recipientId,
          type: event.type,
          priority: event.priority || NotificationPriority.NORMAL,
          title: event.title,
          body: event.body,
          data: event.data,
          deepLink: event.deepLink,
          sourceType: event.sourceType,
          sourceId: event.sourceId,
          idempotencyKey: event.idempotencyKey
            ? `${event.idempotencyKey}:${recipientId}`
            : undefined,
          expiresAt: event.expiresAt,
        }),
      ),
    );

    return { created: notifications.length, notifications };
  }

  async routeToRoles(event: Omit<NotificationEvent, 'recipientIds'> & { role: UserRole; organizationId?: string }) {
    const recipients = await this.findRecipientsByRole(event.role, event.organizationId);
    return this.route({ ...event, recipientIds: recipients });
  }

  private async findRecipientsByRole(role: UserRole, organizationId?: string): Promise<string[]> {
    const where: any = { role };

    if (organizationId) {
      if (role === UserRole.HOSPITAL_STAFF) {
        where.hospitalId = organizationId;
      } else if (role === UserRole.BLOOD_CENTER_STAFF) {
        where.bloodCenterId = organizationId;
      }
    }

    const users = await this.prisma.user.findMany({
      where,
      select: { id: true },
    });

    return users.map((u: { id: string }) => u.id);
  }

  async routeSosNotification(sosRequest: any, compatibleDonorIds: string[]) {
    const priority = NotificationPriority.CRITICAL;
    const expiresAt = sosRequest.expiresAt || new Date(Date.now() + 4 * 60 * 60 * 1000);

    const sanitizedData = {
      requestId: sosRequest.id,
      bloodType: sosRequest.bloodType,
      urgency: sosRequest.urgency,
      hospitalName: sosRequest.hospital?.name || 'Nearby Hospital',
    };

    return this.route({
      type: NotificationType.EMERGENCY,
      priority,
      title: 'Emergency Blood Request',
      body: `Urgent: ${sosRequest.bloodType} blood needed${sosRequest.urgency ? ` - ${sosRequest.urgency}` : ''}`,
      data: sanitizedData,
      deepLink: '/sos',
      sourceType: 'SOS_REQUEST',
      sourceId: sosRequest.id,
      recipientIds: compatibleDonorIds,
      idempotencyKey: `SOS:${sosRequest.id}`,
      expiresAt,
    });
  }

  async routeDonationConfirmation(donation: any, donorId: string) {
    return this.route({
      type: NotificationType.DONATION,
      priority: NotificationPriority.NORMAL,
      title: 'Donation Confirmed',
      body: `Your blood donation has been recorded successfully. Thank you for saving lives!`,
      data: { donationId: donation.id },
      deepLink: `/(app)/donations/${donation.id}`,
      sourceType: 'DONATION',
      sourceId: donation.id,
      recipientIds: [donorId],
      idempotencyKey: `DONATION_CONFIRMED:${donation.id}`,
    });
  }

  async routeAppointmentNotification(appointment: any, recipientIds: string[], action: string) {
    const templates = {
      created: { title: 'Appointment Booked', body: `Your appointment is scheduled for ${this.formatDate(appointment.scheduledAt)}` },
      reminder: { title: 'Appointment Reminder', body: `Reminder: You have an appointment in ${appointment.reminderMinutes || 60} minutes` },
      cancelled: { title: 'Appointment Cancelled', body: `Your appointment on ${this.formatDate(appointment.scheduledAt)} has been cancelled` },
      completed: { title: 'Appointment Completed', body: `Your appointment on ${this.formatDate(appointment.scheduledAt)} has been completed` },
    };

    const template = templates[action as keyof typeof templates] || templates.created;

    return this.route({
      type: NotificationType.APPOINTMENT,
      priority: action === 'reminder' ? NotificationPriority.HIGH : NotificationPriority.NORMAL,
      title: template.title,
      body: template.body,
      data: { appointmentId: appointment.id, action },
      deepLink: `/(app)/appointment/${appointment.id}`,
      sourceType: 'APPOINTMENT',
      sourceId: appointment.id,
      recipientIds,
      idempotencyKey: `APPOINTMENT:${appointment.id}:${action}`,
    });
  }

  async routeLabResultNotification(labResult: any, recipientId: string) {
    return this.route({
      type: NotificationType.LABORATORY,
      priority: NotificationPriority.NORMAL,
      title: 'Lab Results Available',
      body: 'Your blood test results are now available. Tap to view.',
      data: { resultId: labResult.id },
      // No per-result detail screen exists in the mobile app; route to the
      // laboratory results list, which is the nearest real screen.
      deepLink: '/(app)/laboratory',
      sourceType: 'LAB_RESULT',
      sourceId: labResult.id,
      recipientIds: [recipientId],
      idempotencyKey: `LAB_RESULT:${labResult.id}`,
    });
  }

  async routeAchievementNotification(achievement: any, recipientId: string) {
    return this.route({
      type: NotificationType.GAMIFICATION,
      priority: NotificationPriority.LOW,
      title: 'Achievement Unlocked!',
      body: `You've earned: ${achievement.name}`,
      data: { achievementId: achievement.id, achievementName: achievement.name },
      // No per-achievement detail screen exists in the mobile app; route to
      // the achievements list, which is the nearest real screen.
      deepLink: '/(app)/gamification/achievements',
      sourceType: 'ACHIEVEMENT',
      sourceId: achievement.id,
      recipientIds: [recipientId],
      idempotencyKey: `ACHIEVEMENT:${achievement.id}:${recipientId}`,
    });
  }

  async routeLevelUpNotification(userId: string, newLevel: number) {
    return this.route({
      type: NotificationType.GAMIFICATION,
      priority: NotificationPriority.NORMAL,
      title: 'Level Up!',
      body: `Congratulations! You've reached Level ${newLevel}!`,
      data: { level: newLevel },
      // Fully qualified: the mobile app has both an (app)/profile and a
      // (courier)/profile screen, which both strip to the same bare "/profile"
      // URL -- an unqualified path here is ambiguous.
      deepLink: '/(app)/profile',
      sourceType: 'LEVEL_UP',
      sourceId: `LEVEL_${newLevel}_${userId}`,
      recipientIds: [userId],
      idempotencyKey: `LEVEL_UP:${newLevel}:${userId}`,
    });
  }

  async routeShipmentNotification(shipment: any, recipientIds: string[], event: string) {
    const templates: Record<string, { title: string; body: string }> = {
      created: { title: 'Shipment Created', body: 'A new blood shipment has been created' },
      courier_assigned: { title: 'New Delivery Assignment', body: "You've been assigned a new blood shipment delivery" },
      accepted: { title: 'Courier Accepted Delivery', body: 'The assigned courier has accepted this shipment' },
      declined: { title: 'Courier Declined Delivery', body: 'The assigned courier declined this shipment - it needs to be reassigned' },
      picked_up: { title: 'Shipment Picked Up', body: 'Courier has picked up the shipment' },
      in_transit: { title: 'Shipment In Transit', body: 'Your shipment is on the way' },
      arrived: { title: 'Shipment Arrived', body: 'Shipment has arrived at its destination' },
      delivered: { title: 'Shipment Delivered', body: 'Shipment has been delivered successfully' },
      failed: { title: 'Delivery Failed', body: 'Shipment delivery failed. Please contact support.' },
    };

    const template = templates[event] ?? templates.created!;

    return this.route({
      type: NotificationType.SHIPMENT,
      priority: event === 'failed' || event === 'declined' ? NotificationPriority.HIGH : NotificationPriority.NORMAL,
      title: template.title,
      body: template.body,
      data: { shipmentId: shipment.id, event },
      // No per-shipment detail screen exists in the mobile app; route
      // couriers (the only mobile recipients of this notification) to their
      // active-deliveries list, the nearest real screen.
      deepLink: '/(courier)/active',
      sourceType: 'SHIPMENT',
      sourceId: shipment.id,
      recipientIds,
      idempotencyKey: `SHIPMENT:${shipment.id}:${event}`,
    });
  }

  /**
   * One inventory alert, to the staff of the organisation that owns it.
   *
   * The title names the alert type the domain actually raised rather than
   * collapsing everything into "low stock": an expiring-soon alert and an
   * expired-units alert call for different work, and a blood centre reading
   * "Low Inventory Alert" over a batch that just expired would act on the
   * wrong thing. The body is the message the cron already composed from the
   * configured thresholds, so no threshold is restated here.
   */
  async routeInventoryAlert(alert: InventoryAlertNotification, recipientIds: string[]) {
    const titles: Record<string, string> = {
      LOW_STOCK: 'Low stock',
      EXPIRING_SOON: 'Units expiring soon',
      EXPIRED: 'Units expired',
      QUARANTINED: 'Units quarantined',
    };

    return this.route({
      type: NotificationType.INVENTORY,
      // EXPIRED and LOW_STOCK are things staff must act on today; an
      // expiring-soon warning is planning.
      priority:
        alert.alertType === 'EXPIRED' || alert.alertType === 'LOW_STOCK'
          ? NotificationPriority.HIGH
          : NotificationPriority.NORMAL,
      title: titles[alert.alertType] ?? 'Inventory alert',
      body: alert.message,
      data: {
        alertId: alert.alertId,
        alertType: alert.alertType,
        organizationId: alert.organizationId,
        bloodType: alert.bloodType ?? null,
        rhFactor: alert.rhFactor ?? null,
        currentValue: alert.currentValue ?? null,
        threshold: alert.threshold ?? null,
      },
      // The mobile app has no inventory screen (inventory management is
      // web-only); fall back to home so a stray tap never hits a dead route.
      // The web portals resolve their own route from `sourceType`.
      deepLink: '/(app)/home',
      sourceType: 'INVENTORY',
      sourceId: alert.alertId,
      recipientIds,
      // The maintenance cron runs hourly and refreshes an open alert rather
      // than creating a new one, so the alert's own id is what keeps staff
      // from being told about the same shortage twenty-four times a day.
      idempotencyKey: `INVENTORY_ALERT:${alert.alertId}`,
    });
  }

  /**
   * A recall, to the staff of one organisation holding affected components.
   *
   * CRITICAL priority, and deliberately: every other inventory notification is
   * about stock running short or ageing, and this one is about blood that may
   * already be in a fridge somewhere it should not be. It is the only
   * notification in this router that says "stop using something you already
   * have".
   *
   * The body is the recall's `operationalReason` and nothing else. The clinical
   * detail stays on the case, readable only by the organisation that opened it.
   */
  async routeRecallOpened(
    event: {
      recallCaseId: string;
      recallReference: string;
      operationalReason: string | null;
      affectedCount: number;
      triggerKind: string;
    },
    organizationId: string,
    recipientIds: string[],
  ) {
    return this.route({
      type: NotificationType.INVENTORY,
      priority: NotificationPriority.CRITICAL,
      title: `Recall ${event.recallReference}`,
      body:
        event.operationalReason ??
        'A recall has been opened for components from one donation. Quarantine any component you hold from it and await instructions from the collecting organization.',
      data: {
        recallCaseId: event.recallCaseId,
        recallReference: event.recallReference,
        triggerKind: event.triggerKind,
        affectedCount: event.affectedCount,
        organizationId,
      },
      // Recall handling is a web console workflow; the mobile app has no screen
      // for it, so a stray tap lands on home rather than a dead route.
      deepLink: '/(app)/home',
      sourceType: 'RECALL',
      sourceId: event.recallCaseId,
      recipientIds,
      // One notification per person per recall, however many times the case is
      // announced.
      idempotencyKey: `RECALL_OPENED:${event.recallCaseId}`,
    });
  }

  /**
   * A declined blood request, to the hospital that raised it.
   *
   * Priority HIGH rather than CRITICAL: the request itself may have been
   * routine, and the hospital needs to see this promptly without it outranking
   * an active emergency in the same inbox.
   */
  async routeBloodRequestRejected(
    event: {
      requestId: string;
      requestReference: string;
      fulfillingOrganizationName: string;
      reason: string;
    },
    recipientIds: string[],
  ) {
    return this.route({
      type: NotificationType.BLOOD_REQUEST,
      priority: NotificationPriority.HIGH,
      title: 'Blood request declined',
      body: `${event.fulfillingOrganizationName} could not fulfil ${event.requestReference}: ${event.reason}`,
      data: { requestId: event.requestId, reason: event.reason },
      // Blood requests are a portal workflow; the mobile app has no screen for
      // one, so the deep link lands on home and each portal resolves its own
      // route from `sourceType`.
      deepLink: '/(app)/home',
      sourceType: 'BLOOD_REQUEST',
      sourceId: event.requestId,
      recipientIds,
      // A request can only be rejected once -- the status guard refuses a
      // second attempt -- so the request id is the occurrence.
      idempotencyKey: `BLOOD_REQUEST_REJECTED:${event.requestId}`,
    });
  }

  /**
   * One security-relevant action, to the account it happened to.
   *
   * `occurrenceId` is part of the idempotency key. Without it the key was
   * `SECURITY:<event>:<user>`, so the *second* password change on an account
   * matched the first and was silently dropped -- the person was told once,
   * ever, about a category of event whose entire purpose is to tell them every
   * time.
   */
  async routeSecurityNotification(
    userId: string,
    event: string,
    details: string,
    occurrenceId: string,
  ) {
    return this.route({
      type: NotificationType.SECURITY,
      priority: NotificationPriority.HIGH,
      title: 'Security alert',
      body: details,
      data: { event, occurrenceId, timestamp: new Date().toISOString() },
      deepLink: '/(app)/security',
      sourceType: 'SECURITY',
      sourceId: occurrenceId,
      recipientIds: [userId],
      idempotencyKey: `SECURITY:${event}:${occurrenceId}`,
    });
  }

  private formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }
}
