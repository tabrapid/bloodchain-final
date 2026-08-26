import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  NotificationType,
  NotificationPriority,
  UserRole,
} from '../dto';
import { NotificationsService } from './notifications.service';

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
      deepLink: `/sos/${sosRequest.id}`,
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
      deepLink: `/donations/${donation.id}`,
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
      deepLink: `/calendar/appointment/${appointment.id}`,
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
      deepLink: `/health/tests/${labResult.id}`,
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
      deepLink: `/profile/achievements/${achievement.id}`,
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
      deepLink: `/profile`,
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
      deepLink: `/shipments/${shipment.id}`,
      sourceType: 'SHIPMENT',
      sourceId: shipment.id,
      recipientIds,
      idempotencyKey: `SHIPMENT:${shipment.id}:${event}`,
    });
  }

  async routeInventoryAlert(inventory: any, recipientIds: string[], level: 'LOW' | 'CRITICAL') {
    return this.route({
      type: NotificationType.INVENTORY,
      priority: level === 'CRITICAL' ? NotificationPriority.HIGH : NotificationPriority.NORMAL,
      title: level === 'CRITICAL' ? 'Critical Inventory Alert' : 'Low Inventory Alert',
      body: `${inventory.bloodType} inventory is ${level === 'CRITICAL' ? 'critically low' : 'running low'}`,
      data: { inventoryId: inventory.id, bloodType: inventory.bloodType, level },
      deepLink: `/inventory/${inventory.id}`,
      sourceType: 'INVENTORY',
      sourceId: inventory.id,
      recipientIds,
    });
  }

  async routeSecurityNotification(userId: string, event: string, details: string) {
    return this.route({
      type: NotificationType.SECURITY,
      priority: NotificationPriority.HIGH,
      title: 'Security Alert',
      body: details,
      data: { event, timestamp: new Date().toISOString() },
      deepLink: '/profile/security',
      sourceType: 'SECURITY',
      sourceId: `SEC_${event}_${Date.now()}`,
      recipientIds: [userId],
      idempotencyKey: `SECURITY:${event}:${userId}`,
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
