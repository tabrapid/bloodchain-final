import { Injectable } from '@nestjs/common';
import { PlatformSettings } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

const SINGLETON_ID = 'platform';

export interface PlatformSettingsPatch {
  sessionTimeoutMinutes?: number;
  aiHealthInsightsEnabled?: boolean;
  sosEmergencyEnabled?: boolean;
  gamificationEnabled?: boolean;
  pushNotificationsEnabled?: boolean;
  maintenanceMode?: boolean;
}

@Injectable()
export class PlatformSettingsService {
  constructor(
    private readonly db: PrismaService,
    private readonly audit: AuditLogsService,
  ) {}

  async get(): Promise<PlatformSettings> {
    const existing = await this.db.platformSettings.findUnique({ where: { id: SINGLETON_ID } });
    if (existing) return existing;
    return this.db.platformSettings.create({ data: { id: SINGLETON_ID } });
  }

  async update(adminId: string, patch: PlatformSettingsPatch): Promise<PlatformSettings> {
    await this.get(); // ensure the singleton row exists before updating it

    const updated = await this.db.platformSettings.update({
      where: { id: SINGLETON_ID },
      data: { ...patch, updatedById: adminId },
    });

    await this.audit.log({
      actorId: adminId,
      action: 'PLATFORM_SETTINGS_UPDATED',
      entityType: 'PlatformSettings',
      entityId: SINGLETON_ID,
      metadata: { ...patch },
    });

    return updated;
  }

  /** Fast boolean-only reads for gate points that don't need the full row. */
  async isEnabled(
    flag: 'aiHealthInsightsEnabled' | 'sosEmergencyEnabled' | 'gamificationEnabled' | 'pushNotificationsEnabled',
  ): Promise<boolean> {
    const settings = await this.get();
    return settings[flag];
  }

  async isMaintenanceMode(): Promise<boolean> {
    const settings = await this.get();
    return settings.maintenanceMode;
  }

  async getSessionTimeoutMinutes(): Promise<number> {
    const settings = await this.get();
    return settings.sessionTimeoutMinutes;
  }
}
