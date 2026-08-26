import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { AuditLogsService } from '../../audit-logs/audit-logs.service';
import { UpdateNotificationPreferencesDto, NotificationPreferenceResponseDto } from '../dto';

@Injectable()
export class NotificationPreferenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogsService,
  ) {}

  async getPreferences(userId: string) {
    let prefs = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });

    if (!prefs) {
      prefs = await this.prisma.notificationPreference.create({
        data: { userId },
      });
    }

    return this.toResponseDto(prefs);
  }

  async updatePreferences(userId: string, dto: UpdateNotificationPreferencesDto, ipAddress?: string) {
    let prefs = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });

    if (!prefs) {
      prefs = await this.prisma.notificationPreference.create({
        data: { userId, ...dto },
      });
    } else {
      prefs = await this.prisma.notificationPreference.update({
        where: { userId },
        data: dto,
      });
    }

    await this.audit.log({
      actorId: userId,
      action: 'NOTIFICATION_PREFERENCES_UPDATED',
      entityType: 'NotificationPreference',
      entityId: prefs.id,
      ipAddress,
    });

    return this.toResponseDto(prefs);
  }

  async isChannelEnabled(userId: string, category: string): Promise<boolean> {
    const prefs = await this.getPreferences(userId);

    const categoryMap: Record<string, keyof NotificationPreferenceResponseDto> = {
      emergency: 'emergencyRequests',
      appointment: 'appointments',
      donation: 'donationReminders',
      health: 'healthResults',
      gamification: 'gamification',
      bloodRequest: 'bloodRequests',
      shipment: 'shipments',
      inventory: 'inventory',
      system: 'system',
      security: 'security',
    };

    const prefKey = categoryMap[category];
    if (!prefKey) return true;

    return prefs[prefKey] as boolean;
  }

  async isInQuietHours(userId: string): Promise<boolean> {
    const prefs = await this.getPreferences(userId);

    if (!prefs.quietHoursEnabled) return false;

    const timezone = prefs.quietHoursTimezone || 'UTC';
    const now = this.getTimeInTimezone(new Date(), timezone);
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const startParts = (prefs.quietHoursStart || '22:00').split(':').map(Number);
    const endParts = (prefs.quietHoursEnd || '07:00').split(':').map(Number);

    const startHour = startParts[0] ?? 22;
    const startMin = startParts[1] ?? 0;
    const endHour = endParts[0] ?? 7;
    const endMin = endParts[1] ?? 0;

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    if (startMinutes <= endMinutes) {
      return currentTime >= startMinutes && currentTime < endMinutes;
    } else {
      return currentTime >= startMinutes || currentTime < endMinutes;
    }
  }

  async shouldEmergencyOverride(userId: string): Promise<boolean> {
    const prefs = await this.getPreferences(userId);
    return prefs.emergencyOverride;
  }

  private getTimeInTimezone(date: Date, timezone: string): Date {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
      });
      const parts = formatter.formatToParts(date);
      const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
      const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
      const result = new Date(date);
      result.setHours(hour, minute, 0, 0);
      return result;
    } catch {
      return date;
    }
  }

  private toResponseDto(prefs: any): NotificationPreferenceResponseDto {
    return {
      id: prefs.id,
      userId: prefs.userId,
      emergencyRequests: prefs.emergencyRequests ?? true,
      appointments: prefs.appointments ?? true,
      donationReminders: prefs.donationReminders ?? true,
      healthResults: prefs.healthResults ?? false,
      gamification: prefs.gamification ?? true,
      bloodRequests: prefs.bloodRequests ?? true,
      shipments: prefs.shipments ?? true,
      inventory: prefs.inventory ?? true,
      system: prefs.system ?? true,
      security: prefs.security ?? true,
      quietHoursEnabled: prefs.quietHoursEnabled ?? false,
      quietHoursStart: prefs.quietHoursStart,
      quietHoursEnd: prefs.quietHoursEnd,
      quietHoursTimezone: prefs.quietHoursTimezone || 'UTC',
      emergencyOverride: prefs.emergencyOverride ?? true,
      createdAt: prefs.createdAt,
      updatedAt: prefs.updatedAt,
    };
  }
}
