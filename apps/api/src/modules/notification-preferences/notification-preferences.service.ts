import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';

@Injectable()
export class NotificationPreferencesService {
  constructor(
    private readonly db: PrismaService,
    private readonly audit: AuditLogsService,
  ) {}

  async getPreferences(userId: string) {
    let prefs = await this.db.notificationPreference.findUnique({
      where: { userId },
    });

    if (!prefs) {
      prefs = await this.db.notificationPreference.create({
        data: { userId },
      });
    }

    return {
      data: {
        id: prefs.id,
        emergencyRequests: prefs.emergencyRequests,
        appointments: prefs.appointments,
        donationReminders: prefs.donationReminders,
        healthResults: prefs.healthResults,
        system: prefs.system,
        promotional: prefs.promotional,
      },
    };
  }

  async updatePreferences(userId: string, dto: UpdateNotificationPreferencesDto, ipAddress?: string) {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    let prefs = await this.db.notificationPreference.findUnique({
      where: { userId },
    });

    if (!prefs) {
      prefs = await this.db.notificationPreference.create({
        data: { userId },
      });
    }

    const updated = await this.db.notificationPreference.update({
      where: { userId },
      data: {
        emergencyRequests: dto.emergencyRequests ?? prefs.emergencyRequests,
        appointments: dto.appointments ?? prefs.appointments,
        donationReminders: dto.donationReminders ?? prefs.donationReminders,
        healthResults: dto.healthResults ?? prefs.healthResults,
        system: dto.system ?? prefs.system,
        promotional: dto.promotional ?? prefs.promotional,
      },
    });

    await this.audit.log({
      actorId: userId,
      action: 'NOTIFICATION_PREFERENCES_UPDATED',
      entityType: 'NotificationPreference',
      entityId: updated.id,
      ipAddress,
    });

    return {
      data: {
        id: updated.id,
        emergencyRequests: updated.emergencyRequests,
        appointments: updated.appointments,
        donationReminders: updated.donationReminders,
        healthResults: updated.healthResults,
        system: updated.system,
        promotional: updated.promotional,
      },
    };
  }
}