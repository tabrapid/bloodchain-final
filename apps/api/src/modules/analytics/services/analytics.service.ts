import { Injectable, ForbiddenException } from '@nestjs/common';
import { InventoryThresholdsService } from '../../inventory-thresholds/inventory-thresholds.service';
import { PrismaService } from '../../../database/prisma.service';
import {
  LaboratoryResultStatus,
  ShipmentStatus,
} from '@prisma/client';

export enum DateRangeType {
  TODAY = 'TODAY',
  YESTERDAY = 'YESTERDAY',
  LAST_7_DAYS = 'LAST_7_DAYS',
  LAST_30_DAYS = 'LAST_30_DAYS',
  LAST_90_DAYS = 'LAST_90_DAYS',
  THIS_MONTH = 'THIS_MONTH',
  LAST_MONTH = 'LAST_MONTH',
  THIS_YEAR = 'THIS_YEAR',
  CUSTOM = 'CUSTOM',
}

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly thresholds: InventoryThresholdsService,
  ) {}

  async getOverview(organizationId: string, userId: string, filters: any) {
    await this.validateOrganizationAccess(organizationId, userId);
    const { startDate, endDate } = this.getDateRange(filters.range, filters.startDate, filters.endDate, filters.timezone);

    const [inventory, donations, emergencies, appointments, requests, shipments, alerts] = await Promise.all([
      this.getInventorySummary(organizationId),
      this.getDonationKpis(organizationId, startDate, endDate),
      this.getEmergencyKpis(organizationId, startDate, endDate),
      this.getAppointmentKpis(organizationId, startDate, endDate),
      this.getRequestKpis(organizationId, startDate, endDate),
      this.getShipmentKpis(organizationId, startDate, endDate),
      this.getAlertCounts(organizationId),
    ]);

    return { inventory, donations, emergencies, appointments, requests, shipments, alerts };
  }

  async getInventoryAnalytics(organizationId: string, userId: string, filters: any) {
    await this.validateOrganizationAccess(organizationId, userId);
    const { startDate, endDate } = this.getDateRange(filters.range, filters.startDate, filters.endDate, filters.timezone);

    const [summary, byBloodGroup, byComponent, trends, movements] = await Promise.all([
      this.getInventorySummary(organizationId),
      this.getInventoryByBloodGroup(organizationId),
      this.getInventoryByComponent(organizationId),
      this.getInventoryTrends(organizationId, startDate, endDate),
      this.getInventoryMovements(organizationId, startDate, endDate),
    ]);

    return { summary, byBloodGroup, byComponent, trends, movements };
  }

  async getDonationAnalytics(organizationId: string, userId: string, filters: any) {
    await this.validateOrganizationAccess(organizationId, userId);
    const { startDate, endDate } = this.getDateRange(filters.range, filters.startDate, filters.endDate, filters.timezone);

    const [summary, byStatus, byBloodGroup, trends] = await Promise.all([
      this.getDonationSummary(organizationId, startDate, endDate),
      this.getDonationsByStatus(organizationId, startDate, endDate),
      this.getDonationsByBloodGroup(organizationId, startDate, endDate),
      this.getDonationTrends(organizationId, startDate, endDate),
    ]);

    return { summary, byStatus, byBloodGroup, trends };
  }

  async getEmergencyAnalytics(organizationId: string, userId: string, filters: any) {
    await this.validateOrganizationAccess(organizationId, userId);
    const { startDate, endDate } = this.getDateRange(filters.range, filters.startDate, filters.endDate, filters.timezone);

    const [summary, byStatus, byUrgency, byBloodGroup, trends] = await Promise.all([
      this.getEmergencySummary(organizationId, startDate, endDate),
      this.getEmergenciesByStatus(organizationId, startDate, endDate),
      this.getEmergenciesByUrgency(organizationId, startDate, endDate),
      this.getEmergenciesByBloodGroup(organizationId, startDate, endDate),
      this.getEmergencyTrends(organizationId, startDate, endDate),
    ]);

    return { summary, byStatus, byUrgency, byBloodGroup, trends };
  }

  async getRequestAnalytics(organizationId: string, userId: string, filters: any) {
    await this.validateOrganizationAccess(organizationId, userId);
    const { startDate, endDate } = this.getDateRange(filters.range, filters.startDate, filters.endDate, filters.timezone);

    const [summary, byStatus, byPriority, trends] = await Promise.all([
      this.getRequestSummary(organizationId, startDate, endDate),
      this.getRequestsByStatus(organizationId, startDate, endDate),
      this.getRequestsByPriority(organizationId, startDate, endDate),
      this.getRequestTrends(organizationId, startDate, endDate),
    ]);

    return { summary, byStatus, byPriority, trends };
  }

  async getAppointmentAnalytics(organizationId: string, userId: string, filters: any) {
    await this.validateOrganizationAccess(organizationId, userId);
    const { startDate, endDate } = this.getDateRange(filters.range, filters.startDate, filters.endDate, filters.timezone);

    const [summary, byStatus, byType, trends] = await Promise.all([
      this.getAppointmentSummary(organizationId, startDate, endDate),
      this.getAppointmentsByStatus(organizationId, startDate, endDate),
      this.getAppointmentsByType(organizationId, startDate, endDate),
      this.getAppointmentTrends(organizationId, startDate, endDate),
    ]);

    return { summary, byStatus, byType, trends };
  }

  async getLaboratoryAnalytics(organizationId: string, userId: string, filters: any) {
    await this.validateOrganizationAccess(organizationId, userId);
    const { startDate, endDate } = this.getDateRange(filters.range, filters.startDate, filters.endDate, filters.timezone);

    const [summary, byStatus, trends] = await Promise.all([
      this.getLaboratorySummary(organizationId, startDate, endDate),
      this.getLaboratoryByStatus(organizationId, startDate, endDate),
      this.getLaboratoryTrends(organizationId, startDate, endDate),
    ]);

    return { summary, byStatus, trends };
  }

  async getShipmentAnalytics(organizationId: string, userId: string, filters: any) {
    await this.validateOrganizationAccess(organizationId, userId);
    const { startDate, endDate } = this.getDateRange(filters.range, filters.startDate, filters.endDate, filters.timezone);

    const [summary, byStatus, trends] = await Promise.all([
      this.getShipmentSummary(organizationId, startDate, endDate),
      this.getShipmentsByStatus(organizationId, startDate, endDate),
      this.getShipmentTrends(organizationId, startDate, endDate),
    ]);

    return { summary, byStatus, trends };
  }

  async getActivityFeed(organizationId: string, userId: string, filters: any) {
    await this.validateOrganizationAccess(organizationId, userId);
    const limit = Number(filters.limit) || 50;

    const activities: any[] = [];

    try {
      const donations = await this.prisma.donation.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
      activities.push(...donations.map((d: any) => ({
        id: d.id,
        type: 'DONATION',
        description: `Donation ${d.status.toLowerCase()}`,
        timestamp: d.updatedAt.toISOString(),
        status: d.status,
      })));
    } catch { /* ignore */ }

    try {
      const emergencies = await this.prisma.emergencyRequest.findMany({
        where: { hospitalId: organizationId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
      activities.push(...emergencies.map((e: any) => ({
        id: e.id,
        type: 'EMERGENCY',
        description: `Emergency ${e.status.toLowerCase()}`,
        timestamp: e.updatedAt.toISOString(),
        status: e.status,
      })));
    } catch { /* ignore */ }

    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return { items: activities.slice(0, 50), total: activities.length };
  }

  async getAlerts(organizationId: string, userId: string) {
    await this.validateOrganizationAccess(organizationId, userId);

    const alerts = await this.prisma.inventoryAlert.findMany({
      where: { organizationId, acknowledged: false },
      orderBy: { createdAt: 'desc' },
    });

    const formattedAlerts = alerts.map((a: any) => ({
      id: a.id,
      type: a.type,
      priority: a.currentValue !== null && a.currentValue < 2 ? 'CRITICAL' : 'HIGH',
      title: a.currentValue !== null && a.currentValue < 2 ? 'Critical Stock Alert' : 'Low Stock Alert',
      message: a.message,
      sourceType: 'INVENTORY',
      sourceId: a.id,
      status: a.acknowledged ? 'ACKNOWLEDGED' : 'OPEN',
      createdAt: a.createdAt.toISOString(),
    }));

    return {
      alerts: formattedAlerts,
      critical: formattedAlerts.filter((a: any) => a.priority === 'CRITICAL').length,
      high: formattedAlerts.filter((a: any) => a.priority === 'HIGH').length,
      medium: 0,
      low: 0,
      total: formattedAlerts.length,
    };
  }

  private async validateOrganizationAccess(organizationId: string, userId: string): Promise<void> {
    const membership = await this.prisma.organizationMembership.findFirst({
      where: { organizationId, userId, status: 'ACTIVE' },
    });
    if (!membership) {
      throw new ForbiddenException('Access denied to this organization');
    }
  }

  private getDateRange(range: DateRangeType, startDate?: string, endDate?: string, timezone?: string) {
    const now = new Date();
    let start: Date;
    let end: Date;

    const startOfDayFn = (d: Date) => {
      const result = new Date(d);
      result.setHours(0, 0, 0, 0);
      return result;
    };

    const endOfDayFn = (d: Date) => {
      const result = new Date(d);
      result.setHours(23, 59, 59, 999);
      return result;
    };

    const subDaysFn = (d: Date, days: number) => {
      const result = new Date(d);
      result.setDate(result.getDate() - days);
      return result;
    };

    const startOfMonthFn = (d: Date) => {
      return new Date(d.getFullYear(), d.getMonth(), 1);
    };

    const endOfMonthFn = (d: Date) => {
      return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
    };

    const startOfYearFn = (d: Date) => {
      return new Date(d.getFullYear(), 0, 1);
    };

    const parseDateFn = (s: string) => new Date(s);

    switch (range) {
      case DateRangeType.TODAY:
        start = startOfDayFn(now);
        end = endOfDayFn(now);
        break;
      case DateRangeType.YESTERDAY: {
        const yesterday = subDaysFn(now, 1);
        start = startOfDayFn(yesterday);
        end = endOfDayFn(yesterday);
        break;
      }
      case DateRangeType.LAST_7_DAYS:
        start = startOfDayFn(subDaysFn(now, 6));
        end = endOfDayFn(now);
        break;
      case DateRangeType.LAST_30_DAYS:
        start = startOfDayFn(subDaysFn(now, 29));
        end = endOfDayFn(now);
        break;
      case DateRangeType.LAST_90_DAYS:
        start = startOfDayFn(subDaysFn(now, 89));
        end = endOfDayFn(now);
        break;
      case DateRangeType.THIS_MONTH:
        start = startOfMonthFn(now);
        end = endOfDayFn(now);
        break;
      case DateRangeType.LAST_MONTH: {
        const lastMonth = subDaysFn(now, now.getDate());
        start = startOfMonthFn(lastMonth);
        end = endOfMonthFn(lastMonth);
        break;
      }
      case DateRangeType.THIS_YEAR:
        start = startOfYearFn(now);
        end = endOfDayFn(now);
        break;
      case DateRangeType.CUSTOM:
        start = startDate ? startOfDayFn(parseDateFn(startDate)) : startOfDayFn(subDaysFn(now, 29));
        end = endDate ? endOfDayFn(parseDateFn(endDate)) : endOfDayFn(now);
        break;
      default:
        start = startOfDayFn(subDaysFn(now, 29));
        end = endOfDayFn(now);
    }

    return { startDate: start, endDate: end, timezone: timezone || 'UTC' };
  }

  private formatDateKey(date: Date): string {
    return date.toISOString().split('T')[0] as string;
  }

  private async getInventorySummary(organizationId: string) {
    const units = await this.prisma.bloodUnit.findMany({
      where: { organizationId },
      select: { status: true, bloodType: true, rhFactor: true },
    });

    const total = units.length;
    const available = units.filter((u: any) => u.status === 'AVAILABLE').length;
    const reserved = units.filter((u: any) => u.status === 'RESERVED').length;
    const quarantined = units.filter((u: any) => u.status === 'QUARANTINED').length;
    const expired = units.filter((u: any) => u.status === 'EXPIRED').length;

    const bloodGroupCounts = new Map<string, number>();
    units.forEach((u: any) => {
      if (u.status === 'AVAILABLE') {
        const key = `${u.bloodType}${u.rhFactor === 'NEGATIVE' ? '-' : '+'}`;
        bloodGroupCounts.set(key, (bloodGroupCounts.get(key) || 0) + 1);
      }
    });

    const lowStock: string[] = [];
    const criticalStock: string[] = [];
    const allBloodGroups = ['A', 'B', 'AB', 'O'] as const;

    // The threshold is the organisation's own, not `count < 5`.
    //
    // This was a second copy of the number the alert cron used, in a second
    // module, and the two could disagree: the dashboard called a group low
    // while the alert engine did not, or the reverse. Both now ask the same
    // service, which answers with what the organisation configured, a
    // clearly-labelled development fallback, or nothing at all.
    //
    // "Nothing at all" -- production with no configuration -- leaves `lowStock`
    // empty rather than falling back to a guess. An empty list here means
    // "nobody has said what low means", and the console's own threshold screen
    // is where that gets fixed. Zero units is still reported as critical,
    // because no configuration is needed to know that none is none.
    const thresholdRows = await this.thresholds.listRows(organizationId);

    for (const bg of allBloodGroups) {
      for (const rh of ['POSITIVE', 'NEGATIVE'] as const) {
        const posNeg = rh === 'POSITIVE' ? '+' : '-';
        const key = `${bg}${posNeg}`;
        const count = bloodGroupCounts.get(key) || 0;
        if (count === 0) {
          criticalStock.push(key);
          continue;
        }

        const resolved = this.thresholds.resolveFrom(thresholdRows, { bloodType: bg, rhFactor: rh });
        if (resolved.threshold !== null && count < resolved.threshold) lowStock.push(key);
      }
    }

    return {
      totalUnits: total,
      availableUnits: available,
      reservedUnits: reserved,
      quarantinedUnits: quarantined,
      expiredUnits: expired,
      lowStockGroups: lowStock,
      criticalGroups: criticalStock,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Matches BloodGroupCountDto's {bloodGroup, rhFactor, fullName, count,
   * percent} shape, the same as getDonationsByBloodGroup and
   * getEmergenciesByBloodGroup below -- this one previously returned a
   * different, one-off shape (available/reserved/inTransit/status, with
   * reserved and inTransit hardcoded to 0) that the frontend's shared DTO
   * was never written to expect.
   */
  private async getInventoryByBloodGroup(organizationId: string) {
    const units = await this.prisma.bloodUnit.groupBy({
      by: ['bloodType', 'rhFactor'],
      where: { organizationId },
      _count: { id: true },
    });

    const total = units.reduce((sum: number, u: any) => sum + u._count.id, 0);
    return units.map((u: any) => ({
      bloodGroup: u.bloodType,
      rhFactor: u.rhFactor,
      fullName: `${u.bloodType}${u.rhFactor === 'NEGATIVE' ? '-' : '+'}`,
      count: u._count.id,
      percent: total > 0 ? Math.round((u._count.id / total) * 1000) / 10 : 0,
    }));
  }

  /** Backs the inventory analytics page's "Inventory by Component" card. */
  private async getInventoryByComponent(organizationId: string) {
    const [byComponent, byComponentAvailable, byComponentReserved] = await Promise.all([
      this.prisma.bloodUnit.groupBy({
        by: ['componentType'],
        where: { organizationId },
        _count: { id: true },
      }),
      this.prisma.bloodUnit.groupBy({
        by: ['componentType'],
        where: { organizationId, status: 'AVAILABLE' },
        _count: { id: true },
      }),
      this.prisma.bloodUnit.groupBy({
        by: ['componentType'],
        where: { organizationId, status: 'RESERVED' },
        _count: { id: true },
      }),
    ]);

    const availableByType = new Map(byComponentAvailable.map((c: any) => [c.componentType, c._count.id]));
    const reservedByType = new Map(byComponentReserved.map((c: any) => [c.componentType, c._count.id]));

    return byComponent.map((c: any) => ({
      componentType: c.componentType,
      count: c._count.id,
      available: availableByType.get(c.componentType) ?? 0,
      reserved: reservedByType.get(c.componentType) ?? 0,
    }));
  }

  private async getInventoryTrends(organizationId: string, startDate: Date, endDate: Date) {
    const movements = await this.prisma.inventoryMovement.findMany({
      where: { organizationId, createdAt: { gte: startDate, lte: endDate } },
      select: { type: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const dataByDate = new Map<string, number>();
    movements.forEach((m: any) => {
      const dateKey = this.formatDateKey(m.createdAt);
      dataByDate.set(dateKey, (dataByDate.get(dateKey) || 0) + 1);
    });

    const data = Array.from(dataByDate.entries()).map(([date, value]) => ({ date, value }));
    return { data, period: 'daily', total: data.reduce((sum: number, d: any) => sum + d.value, 0) };
  }

  private async getInventoryMovements(organizationId: string, startDate: Date, endDate: Date) {
    const movements = await this.prisma.inventoryMovement.groupBy({
      by: ['type'],
      where: { organizationId, createdAt: { gte: startDate, lte: endDate } },
      _count: { id: true },
    });

    return movements.map((m: any) => ({ type: m.type, count: m._count.id, volumeMl: 0 }));
  }

  private async getDonationKpis(organizationId: string, startDate: Date, endDate: Date) {
    const [total, completed, cancelled] = await Promise.all([
      this.prisma.donation.count({ where: { organizationId, createdAt: { gte: startDate, lte: endDate } } }),
      this.prisma.donation.count({ where: { organizationId, status: 'COMPLETED', createdAt: { gte: startDate, lte: endDate } } }),
      this.prisma.donation.count({ where: { organizationId, status: 'CANCELLED', createdAt: { gte: startDate, lte: endDate } } }),
    ]);

    const byBloodGroup = await this.getDonationsByBloodGroup(organizationId, startDate, endDate);

    return {
      total: { value: total, previousValue: null, changePercent: null, trend: 'stable' as const, label: '' },
      completed: { value: completed, previousValue: null, changePercent: null, trend: 'stable' as const, label: '' },
      cancelled: { value: cancelled, previousValue: null, changePercent: null, trend: 'stable' as const, label: '' },
      byBloodGroup,
    };
  }

  private async getDonationSummary(organizationId: string, startDate: Date, endDate: Date) {
    const [total, completed, noShow, units] = await Promise.all([
      this.prisma.donation.count({ where: { organizationId, createdAt: { gte: startDate, lte: endDate } } }),
      this.prisma.donation.count({ where: { organizationId, status: 'COMPLETED', createdAt: { gte: startDate, lte: endDate } } }),
      this.prisma.donation.count({ where: { organizationId, status: 'NO_SHOW', createdAt: { gte: startDate, lte: endDate } } }),
      this.prisma.donation.findMany({
        where: { organizationId, createdAt: { gte: startDate, lte: endDate }, status: 'COMPLETED' },
        select: { volumeMl: true },
      }),
    ]);

    const totalVolume = units.reduce((sum: number, u: any) => sum + (u.volumeMl || 0), 0);
    return {
      total,
      completed,
      cancelled: total - completed,
      noShows: noShow,
      completionRate: completed > 0 && total > 0 ? Math.round((completed / total) * 100) : null,
      totalVolumeMl: totalVolume,
      avgVolumeMl: units.length > 0 ? Math.round(totalVolume / units.length) : 0,
    };
  }

  private async getDonationsByStatus(organizationId: string, startDate: Date, endDate: Date) {
    const donations = await this.prisma.donation.groupBy({
      by: ['status'],
      where: { organizationId, createdAt: { gte: startDate, lte: endDate } },
      _count: { id: true },
    });

    const total = donations.reduce((sum: number, d: any) => sum + d._count.id, 0);
    return donations.map((d: any) => ({
      status: d.status,
      count: d._count.id,
      percent: total > 0 ? Math.round((d._count.id / total) * 1000) / 10 : 0,
    }));
  }

  private async getDonationsByBloodGroup(organizationId: string, startDate: Date, endDate: Date) {
    const donations = await this.prisma.donation.groupBy({
      by: ['bloodType', 'rhFactor'],
      where: { organizationId, createdAt: { gte: startDate, lte: endDate }, status: 'COMPLETED' },
      _count: { id: true },
    });

    const total = donations.reduce((sum: number, d: any) => sum + d._count.id, 0);
    return donations.map((d: any) => ({
      bloodGroup: d.bloodType,
      rhFactor: d.rhFactor,
      fullName: `${d.bloodType}${d.rhFactor === 'NEGATIVE' ? '-' : '+'}`,
      count: d._count.id,
      percent: total > 0 ? Math.round((d._count.id / total) * 1000) / 10 : 0,
    }));
  }

  private async getDonationTrends(organizationId: string, startDate: Date, endDate: Date) {
    const donations = await this.prisma.donation.findMany({
      where: { organizationId, createdAt: { gte: startDate, lte: endDate }, status: 'COMPLETED' },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const dataByDate = new Map<string, number>();
    donations.forEach((d: any) => {
      const dateKey = this.formatDateKey(d.createdAt);
      dataByDate.set(dateKey, (dataByDate.get(dateKey) || 0) + 1);
    });

    const data = Array.from(dataByDate.entries()).map(([date, value]) => ({ date, value }));
    return { data, period: 'daily', total: data.reduce((sum: number, d: any) => sum + d.value, 0) };
  }

  private async getEmergencyKpis(organizationId: string, startDate: Date, endDate: Date) {
    const [total, active, completed] = await Promise.all([
      this.prisma.emergencyRequest.count({ where: { hospitalId: organizationId, createdAt: { gte: startDate, lte: endDate } } }),
      this.prisma.emergencyRequest.count({ where: { hospitalId: organizationId, status: { in: ['ACTIVE', 'MATCHING'] }, createdAt: { gte: startDate, lte: endDate } } }),
      this.prisma.emergencyRequest.count({ where: { hospitalId: organizationId, status: 'COMPLETED', createdAt: { gte: startDate, lte: endDate } } }),
    ]);

    return {
      total: { value: total, previousValue: null, changePercent: null, trend: 'stable' as const, label: '' },
      active: { value: active, previousValue: null, changePercent: null, trend: 'stable' as const, label: '' },
      completed: { value: completed, previousValue: null, changePercent: null, trend: 'stable' as const, label: '' },
      avgResponseTime: null,
      acceptanceRate: null,
    };
  }

  private async getEmergencySummary(organizationId: string, startDate: Date, endDate: Date) {
    const [total, active, completed, expired, cancelled] = await Promise.all([
      this.prisma.emergencyRequest.count({ where: { hospitalId: organizationId, createdAt: { gte: startDate, lte: endDate } } }),
      this.prisma.emergencyRequest.count({ where: { hospitalId: organizationId, status: { in: ['ACTIVE', 'MATCHING'] }, createdAt: { gte: startDate, lte: endDate } } }),
      this.prisma.emergencyRequest.count({ where: { hospitalId: organizationId, status: 'COMPLETED', createdAt: { gte: startDate, lte: endDate } } }),
      this.prisma.emergencyRequest.count({ where: { hospitalId: organizationId, status: 'EXPIRED', createdAt: { gte: startDate, lte: endDate } } }),
      this.prisma.emergencyRequest.count({ where: { hospitalId: organizationId, status: 'CANCELLED', createdAt: { gte: startDate, lte: endDate } } }),
    ]);

    return { total, active, completed, expired, cancelled, avgResponseTimeMinutes: null, acceptanceRate: null, successfulDonationRate: null };
  }

  private async getEmergenciesByStatus(organizationId: string, startDate: Date, endDate: Date) {
    const emergencies = await this.prisma.emergencyRequest.groupBy({
      by: ['status'],
      where: { hospitalId: organizationId, createdAt: { gte: startDate, lte: endDate } },
      _count: { id: true },
    });

    const total = emergencies.reduce((sum: number, e: any) => sum + e._count.id, 0);
    return emergencies.map((e: any) => ({
      status: e.status,
      count: e._count.id,
      percent: total > 0 ? Math.round((e._count.id / total) * 1000) / 10 : 0,
    }));
  }

  private async getEmergenciesByUrgency(organizationId: string, startDate: Date, endDate: Date) {
    const emergencies = await this.prisma.emergencyRequest.groupBy({
      by: ['urgencyLevel'],
      where: { hospitalId: organizationId, createdAt: { gte: startDate, lte: endDate } },
      _count: { id: true },
    });

    return emergencies.map((e: any) => ({ urgencyLevel: e.urgencyLevel || 'NORMAL', count: e._count.id }));
  }

  /** Matches BloodGroupCountDto, same as getInventoryByBloodGroup / getDonationsByBloodGroup. */
  private async getEmergenciesByBloodGroup(organizationId: string, startDate: Date, endDate: Date) {
    const emergencies = await this.prisma.emergencyRequest.groupBy({
      by: ['bloodType', 'rhFactor'],
      where: { hospitalId: organizationId, createdAt: { gte: startDate, lte: endDate } },
      _count: { id: true },
    });

    const total = emergencies.reduce((sum: number, e: any) => sum + e._count.id, 0);
    return emergencies.map((e: any) => ({
      bloodGroup: e.bloodType,
      rhFactor: e.rhFactor,
      fullName: `${e.bloodType}${e.rhFactor === 'NEGATIVE' ? '-' : '+'}`,
      count: e._count.id,
      percent: total > 0 ? Math.round((e._count.id / total) * 1000) / 10 : 0,
    }));
  }

  private async getEmergencyTrends(organizationId: string, startDate: Date, endDate: Date) {
    const emergencies = await this.prisma.emergencyRequest.findMany({
      where: { hospitalId: organizationId, createdAt: { gte: startDate, lte: endDate } },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const dataByDate = new Map<string, number>();
    emergencies.forEach((e: any) => {
      const dateKey = this.formatDateKey(e.createdAt);
      dataByDate.set(dateKey, (dataByDate.get(dateKey) || 0) + 1);
    });

    const data = Array.from(dataByDate.entries()).map(([date, value]) => ({ date, value }));
    return { data, period: 'daily', total: data.reduce((sum: number, d: any) => sum + d.value, 0) };
  }

  private async getRequestKpis(organizationId: string, startDate: Date, endDate: Date) {
    const [total, pending, fulfilled] = await Promise.all([
      this.prisma.bloodRequest.count({ where: { requestingOrganizationId: organizationId, createdAt: { gte: startDate, lte: endDate } } }),
      this.prisma.bloodRequest.count({ where: { requestingOrganizationId: organizationId, status: { in: ['SUBMITTED', 'UNDER_REVIEW'] }, createdAt: { gte: startDate, lte: endDate } } }),
      this.prisma.bloodRequest.count({ where: { requestingOrganizationId: organizationId, status: { in: ['DELIVERED', 'PARTIALLY_DELIVERED'] }, createdAt: { gte: startDate, lte: endDate } } }),
    ]);

    return {
      total: { value: total, previousValue: null, changePercent: null, trend: 'stable' as const, label: '' },
      pending: { value: pending, previousValue: null, changePercent: null, trend: 'stable' as const, label: '' },
      fulfilled: { value: fulfilled, previousValue: null, changePercent: null, trend: 'stable' as const, label: '' },
      fulfillmentRate: fulfilled > 0 && total > 0 ? Math.round((fulfilled / total) * 100) : null,
    };
  }

  private async getShipmentKpis(organizationId: string, startDate: Date, endDate: Date) {
    const activeStatuses: ShipmentStatus[] = [
      ShipmentStatus.COURIER_ASSIGNED,
      ShipmentStatus.COURIER_ACCEPTED,
      ShipmentStatus.PICKUP_STARTED,
      ShipmentStatus.PICKED_UP,
      ShipmentStatus.IN_TRANSIT,
      ShipmentStatus.ARRIVED_AT_HOSPITAL,
    ];

    const [total, inTransit, delivered, failed] = await Promise.all([
      this.prisma.shipment.count({
        where: {
          OR: [{ sourceOrganizationId: organizationId }, { destinationOrganizationId: organizationId }],
          createdAt: { gte: startDate, lte: endDate },
        },
      }),
      this.prisma.shipment.count({
        where: {
          OR: [{ sourceOrganizationId: organizationId }, { destinationOrganizationId: organizationId }],
          status: { in: activeStatuses },
          createdAt: { gte: startDate, lte: endDate },
        },
      }),
      this.prisma.shipment.count({
        where: {
          OR: [{ sourceOrganizationId: organizationId }, { destinationOrganizationId: organizationId }],
          status: ShipmentStatus.DELIVERED,
          createdAt: { gte: startDate, lte: endDate },
        },
      }),
      this.prisma.shipment.count({
        where: {
          OR: [{ sourceOrganizationId: organizationId }, { destinationOrganizationId: organizationId }],
          status: ShipmentStatus.FAILED,
          createdAt: { gte: startDate, lte: endDate },
        },
      }),
    ]);

    const deliveredShipments = await this.prisma.shipment.findMany({
      where: {
        OR: [{ sourceOrganizationId: organizationId }, { destinationOrganizationId: organizationId }],
        status: ShipmentStatus.DELIVERED,
        deliveredAt: { gte: startDate, lte: endDate },
      },
      select: { createdAt: true, deliveredAt: true },
    });

    let avgDeliveryTimeMinutes: number | null = null;
    if (deliveredShipments.length > 0) {
      const totalMinutes = deliveredShipments.reduce((sum, s) => {
        const diff = (s.deliveredAt!.getTime() - s.createdAt.getTime()) / 60000;
        return sum + diff;
      }, 0);
      avgDeliveryTimeMinutes = Math.round(totalMinutes / deliveredShipments.length);
    }

    return {
      total: { value: total, previousValue: null, changePercent: null, trend: 'stable' as const, label: '' },
      inTransit: { value: inTransit, previousValue: null, changePercent: null, trend: 'stable' as const, label: '' },
      delivered: { value: delivered, previousValue: null, changePercent: null, trend: 'stable' as const, label: '' },
      failed: { value: failed, previousValue: null, changePercent: null, trend: 'stable' as const, label: '' },
      avgDeliveryTimeMinutes,
    };
  }

  private async getRequestSummary(organizationId: string, startDate: Date, endDate: Date) {
    const [total, pending, approved, rejected, fulfilled, partialFulfilled] = await Promise.all([
      this.prisma.bloodRequest.count({ where: { requestingOrganizationId: organizationId, createdAt: { gte: startDate, lte: endDate } } }),
      this.prisma.bloodRequest.count({ where: { requestingOrganizationId: organizationId, status: { in: ['SUBMITTED', 'UNDER_REVIEW'] }, createdAt: { gte: startDate, lte: endDate } } }),
      this.prisma.bloodRequest.count({ where: { requestingOrganizationId: organizationId, status: 'APPROVED', createdAt: { gte: startDate, lte: endDate } } }),
      this.prisma.bloodRequest.count({ where: { requestingOrganizationId: organizationId, status: 'REJECTED', createdAt: { gte: startDate, lte: endDate } } }),
      this.prisma.bloodRequest.count({ where: { requestingOrganizationId: organizationId, status: 'DELIVERED', createdAt: { gte: startDate, lte: endDate } } }),
      this.prisma.bloodRequest.count({ where: { requestingOrganizationId: organizationId, status: 'PARTIALLY_DELIVERED', createdAt: { gte: startDate, lte: endDate } } }),
    ]);

    return {
      total,
      pending,
      approved,
      rejected,
      fulfilled,
      partialFulfilled,
      fulfillmentRate: fulfilled + partialFulfilled > 0 && total > 0 ? Math.round(((fulfilled + partialFulfilled) / total) * 100) : null,
      avgFulfillmentTimeHours: null,
      avgApprovalTimeHours: null,
    };
  }

  private async getRequestsByStatus(organizationId: string, startDate: Date, endDate: Date) {
    const requests = await this.prisma.bloodRequest.groupBy({
      by: ['status'],
      where: { requestingOrganizationId: organizationId, createdAt: { gte: startDate, lte: endDate } },
      _count: { id: true },
    });

    const total = requests.reduce((sum: number, r: any) => sum + r._count.id, 0);
    return requests.map((r: any) => ({
      status: r.status,
      count: r._count.id,
      percent: total > 0 ? Math.round((r._count.id / total) * 1000) / 10 : 0,
    }));
  }

  private async getRequestsByPriority(organizationId: string, startDate: Date, endDate: Date) {
    const requests = await this.prisma.bloodRequest.groupBy({
      by: ['priority'],
      where: { requestingOrganizationId: organizationId, createdAt: { gte: startDate, lte: endDate } },
      _count: { id: true },
    });

    return requests.map((r: any) => ({ priority: r.priority, count: r._count.id }));
  }

  private async getRequestTrends(organizationId: string, startDate: Date, endDate: Date) {
    const requests = await this.prisma.bloodRequest.findMany({
      where: { requestingOrganizationId: organizationId, createdAt: { gte: startDate, lte: endDate } },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const dataByDate = new Map<string, number>();
    requests.forEach((r: any) => {
      const dateKey = this.formatDateKey(r.createdAt);
      dataByDate.set(dateKey, (dataByDate.get(dateKey) || 0) + 1);
    });

    const data = Array.from(dataByDate.entries()).map(([date, value]) => ({ date, value }));
    return { data, period: 'daily', total: data.reduce((sum: number, d: any) => sum + d.value, 0) };
  }

  private async getAppointmentKpis(organizationId: string, startDate: Date, endDate: Date) {
    const [total, completed, cancelled] = await Promise.all([
      this.prisma.appointment.count({ where: { organizationId, createdAt: { gte: startDate, lte: endDate } } }),
      this.prisma.appointment.count({ where: { organizationId, status: 'COMPLETED', createdAt: { gte: startDate, lte: endDate } } }),
      this.prisma.appointment.count({ where: { organizationId, status: 'CANCELLED', createdAt: { gte: startDate, lte: endDate } } }),
    ]);

    return {
      total: { value: total, previousValue: null, changePercent: null, trend: 'stable' as const, label: '' },
      completed: { value: completed, previousValue: null, changePercent: null, trend: 'stable' as const, label: '' },
      cancelled: { value: cancelled, previousValue: null, changePercent: null, trend: 'stable' as const, label: '' },
      noShow: { value: 0, previousValue: null, changePercent: null, trend: 'stable' as const, label: '' },
      completionRate: completed > 0 && total > 0 ? Math.round((completed / total) * 100) : null,
    };
  }

  private async getAppointmentSummary(organizationId: string, startDate: Date, endDate: Date) {
    const [total, booked, confirmed, completed, cancelled, noShow] = await Promise.all([
      this.prisma.appointment.count({ where: { organizationId, createdAt: { gte: startDate, lte: endDate } } }),
      this.prisma.appointment.count({ where: { organizationId, status: { in: ['PENDING', 'CONFIRMED'] }, createdAt: { gte: startDate, lte: endDate } } }),
      this.prisma.appointment.count({ where: { organizationId, status: 'CONFIRMED', createdAt: { gte: startDate, lte: endDate } } }),
      this.prisma.appointment.count({ where: { organizationId, status: 'COMPLETED', createdAt: { gte: startDate, lte: endDate } } }),
      this.prisma.appointment.count({ where: { organizationId, status: 'CANCELLED', createdAt: { gte: startDate, lte: endDate } } }),
      this.prisma.appointment.count({ where: { organizationId, status: 'NO_SHOW', createdAt: { gte: startDate, lte: endDate } } }),
    ]);

    return {
      total,
      booked,
      confirmed,
      completed,
      cancelled,
      noShow,
      completionRate: completed > 0 && total > 0 ? Math.round((completed / total) * 100) : null,
      cancellationRate: cancelled > 0 && total > 0 ? Math.round((cancelled / total) * 100) : null,
      noShowRate: noShow > 0 && total > 0 ? Math.round((noShow / total) * 100) : null,
    };
  }

  private async getAppointmentsByStatus(organizationId: string, startDate: Date, endDate: Date) {
    const appointments = await this.prisma.appointment.groupBy({
      by: ['status'],
      where: { organizationId, createdAt: { gte: startDate, lte: endDate } },
      _count: { id: true },
    });

    const total = appointments.reduce((sum: number, a: any) => sum + a._count.id, 0);
    return appointments.map((a: any) => ({
      status: a.status,
      count: a._count.id,
      percent: total > 0 ? Math.round((a._count.id / total) * 1000) / 10 : 0,
    }));
  }

  private async getAppointmentsByType(organizationId: string, startDate: Date, endDate: Date) {
    const appointments = await this.prisma.appointment.groupBy({
      by: ['appointmentType'],
      where: { organizationId, createdAt: { gte: startDate, lte: endDate } },
      _count: { id: true },
    });

    return appointments.map((a: any) => ({ type: a.appointmentType, count: a._count.id }));
  }

  private async getAppointmentTrends(organizationId: string, startDate: Date, endDate: Date) {
    const appointments = await this.prisma.appointment.findMany({
      where: { organizationId, createdAt: { gte: startDate, lte: endDate } },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const dataByDate = new Map<string, number>();
    appointments.forEach((a: any) => {
      const dateKey = this.formatDateKey(a.createdAt);
      dataByDate.set(dateKey, (dataByDate.get(dateKey) || 0) + 1);
    });

    const data = Array.from(dataByDate.entries()).map(([date, value]) => ({ date, value }));
    return { data, period: 'daily', total: data.reduce((sum: number, d: any) => sum + d.value, 0) };
  }

  private async getLaboratorySummary(organizationId: string, startDate: Date, endDate: Date) {
    const [total, pending, completed] = await Promise.all([
      this.prisma.laboratoryResult.count({ where: { laboratoryId: organizationId, createdAt: { gte: startDate, lte: endDate } } }),
      // "Pending" means entered but not yet published -- i.e. awaiting review or
      // publication. This counted ['PENDING', 'PROCESSING'], and neither value
      // is ever written: a result is created as ENTERED, and PROCESSING is not
      // a status this system has. The figure was therefore always zero, which
      // typing the column is what exposed. PENDING stays in the list because it
      // remains the column default, so a row could still carry it.
      this.prisma.laboratoryResult.count({
        where: {
          laboratoryId: organizationId,
          status: {
            in: [
              LaboratoryResultStatus.PENDING,
              LaboratoryResultStatus.ENTERED,
              LaboratoryResultStatus.REVIEWED,
            ],
          },
          createdAt: { gte: startDate, lte: endDate },
        },
      }),
      this.prisma.laboratoryResult.count({ where: { laboratoryId: organizationId, status: LaboratoryResultStatus.PUBLISHED, createdAt: { gte: startDate, lte: endDate } } }),
    ]);

    return { totalTests: total, pendingTests: pending, completedTests: completed, avgProcessingTimeHours: null };
  }

  private async getLaboratoryByStatus(organizationId: string, startDate: Date, endDate: Date) {
    const results = await this.prisma.laboratoryResult.groupBy({
      by: ['status'],
      where: { laboratoryId: organizationId, createdAt: { gte: startDate, lte: endDate } },
      _count: { id: true },
    });

    const total = results.reduce((sum: number, r: any) => sum + r._count.id, 0);
    return results.map((r: any) => ({
      status: r.status,
      count: r._count.id,
      percent: total > 0 ? Math.round((r._count.id / total) * 1000) / 10 : 0,
    }));
  }

  private async getLaboratoryTrends(organizationId: string, startDate: Date, endDate: Date) {
    const results = await this.prisma.laboratoryResult.findMany({
      where: { laboratoryId: organizationId, createdAt: { gte: startDate, lte: endDate } },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const dataByDate = new Map<string, number>();
    results.forEach((r: any) => {
      const dateKey = this.formatDateKey(r.createdAt);
      dataByDate.set(dateKey, (dataByDate.get(dateKey) || 0) + 1);
    });

    const data = Array.from(dataByDate.entries()).map(([date, value]) => ({ date, value }));
    return { data, period: 'daily', total: data.reduce((sum: number, d: any) => sum + d.value, 0) };
  }

  private async getShipmentSummary(organizationId: string, startDate: Date, endDate: Date) {
    const shipmentWhere = {
      OR: [
        { sourceOrganizationId: organizationId },
        { destinationOrganizationId: organizationId },
      ],
      createdAt: { gte: startDate, lte: endDate },
    };

    const [total, active, delivered, failed] = await Promise.all([
      this.prisma.shipment.count({ where: shipmentWhere }),
      this.prisma.shipment.count({ where: { ...shipmentWhere, status: { in: ['CREATED', 'COURIER_ASSIGNED', 'COURIER_ACCEPTED', 'PICKUP_STARTED', 'PICKED_UP', 'IN_TRANSIT'] } } }),
      this.prisma.shipment.count({ where: { ...shipmentWhere, status: 'DELIVERED' } }),
      this.prisma.shipment.count({ where: { ...shipmentWhere, status: 'FAILED' } }),
    ]);

    return { total, active, delivered, delayed: 0, failed, avgDeliveryTimeHours: null, avgPickupTimeHours: null };
  }

  private async getShipmentsByStatus(organizationId: string, startDate: Date, endDate: Date) {
    const shipmentWhere = {
      OR: [
        { sourceOrganizationId: organizationId },
        { destinationOrganizationId: organizationId },
      ],
      createdAt: { gte: startDate, lte: endDate },
    };

    const shipments = await this.prisma.shipment.groupBy({
      by: ['status'],
      where: shipmentWhere,
      _count: { id: true },
    });

    const total = shipments.reduce((sum: number, s: any) => sum + (s._count?.id || 0), 0);
    return shipments.map((s: any) => ({
      status: s.status,
      count: s._count?.id || 0,
      percent: total > 0 ? Math.round(((s._count?.id || 0) / total) * 1000) / 10 : 0,
    }));
  }

  private async getShipmentTrends(organizationId: string, startDate: Date, endDate: Date) {
    const shipments = await this.prisma.shipment.findMany({
      where: {
        OR: [
          { sourceOrganizationId: organizationId },
          { destinationOrganizationId: organizationId },
        ],
        createdAt: { gte: startDate, lte: endDate },
      },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const dataByDate = new Map<string, number>();
    shipments.forEach((s: any) => {
      const dateKey = this.formatDateKey(s.createdAt);
      dataByDate.set(dateKey, (dataByDate.get(dateKey) || 0) + 1);
    });

    const data = Array.from(dataByDate.entries()).map(([date, value]) => ({ date, value }));
    return { data, period: 'daily', total: data.reduce((sum: number, d: any) => sum + d.value, 0) };
  }

  private async getAlertCounts(organizationId: string) {
    const alerts = await this.prisma.inventoryAlert.findMany({
      where: { organizationId, acknowledged: false },
    });

    return {
      critical: alerts.filter((a: any) => a.type === 'LOW_STOCK' && a.currentValue !== null && a.currentValue < 2).length,
      high: alerts.filter((a: any) => a.type === 'LOW_STOCK' && (a.currentValue === null || a.currentValue >= 2)).length,
      medium: alerts.filter((a: any) => a.type === 'EXPIRING_SOON').length,
      low: alerts.filter((a: any) => ['EXPIRED', 'QUARANTINED'].includes(a.type)).length,
    };
  }
}
