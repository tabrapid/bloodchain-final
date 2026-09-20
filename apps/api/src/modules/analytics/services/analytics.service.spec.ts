import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { InventoryThresholdsService } from '../../inventory-thresholds/inventory-thresholds.service';
import { PrismaService } from '../../../database/prisma.service';
import { AnalyticsService, DateRangeType } from './analytics.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let prisma: any;
  let thresholds: any;

  beforeEach(async () => {
    prisma = {
      organizationMembership: { findFirst: jest.fn() },
      bloodUnit: { findMany: jest.fn(), groupBy: jest.fn() },
      inventoryMovement: { findMany: jest.fn(), groupBy: jest.fn() },
      donation: { count: jest.fn(), findMany: jest.fn(), groupBy: jest.fn() },
      emergencyRequest: { count: jest.fn(), findMany: jest.fn(), groupBy: jest.fn() },
      bloodRequest: { count: jest.fn(), findMany: jest.fn(), groupBy: jest.fn() },
      appointment: { count: jest.fn(), findMany: jest.fn(), groupBy: jest.fn() },
      laboratoryResult: { count: jest.fn(), findMany: jest.fn(), groupBy: jest.fn() },
      shipment: { count: jest.fn(), findMany: jest.fn(), groupBy: jest.fn() },
      inventoryAlert: { findMany: jest.fn() },
    };

    thresholds = {
      listRows: jest.fn().mockResolvedValue([]),
      resolveFrom: jest
        .fn()
        .mockReturnValue({ threshold: 5, source: 'DEVELOPMENT_FALLBACK', scopeKey: null }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: PrismaService, useValue: prisma },
        // Defaults to the development fallback these tests were written
        // against, so the existing assertions keep describing what they
        // described. Two tests below override it to say where the number comes
        // from.
        { provide: InventoryThresholdsService, useValue: thresholds },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('access control (shared by every public method)', () => {
    it('throws ForbiddenException when the user has no ACTIVE membership in the organization', async () => {
      prisma.organizationMembership.findFirst.mockResolvedValue(null);

      await expect(service.getAlerts('org-1', 'user-1')).rejects.toThrow(ForbiddenException);
      expect(prisma.organizationMembership.findFirst).toHaveBeenCalledWith({
        where: { organizationId: 'org-1', userId: 'user-1', status: 'ACTIVE' },
      });
    });

    it('proceeds when the user has an ACTIVE membership', async () => {
      prisma.organizationMembership.findFirst.mockResolvedValue({ id: 'membership-1' });
      prisma.inventoryAlert.findMany.mockResolvedValue([]);

      await expect(service.getAlerts('org-1', 'user-1')).resolves.toBeDefined();
    });
  });

  describe('getDateRange (private, exercised via getOverview)', () => {
    const fixedNow = new Date('2026-03-15T12:34:56.000Z');

    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(fixedNow);
      prisma.organizationMembership.findFirst.mockResolvedValue({ id: 'm-1' });
      jest.spyOn(service as any, 'getInventorySummary').mockResolvedValue({});
      jest.spyOn(service as any, 'getDonationKpis').mockResolvedValue({});
      jest.spyOn(service as any, 'getEmergencyKpis').mockResolvedValue({});
      jest.spyOn(service as any, 'getAppointmentKpis').mockResolvedValue({});
      jest.spyOn(service as any, 'getRequestKpis').mockResolvedValue({});
      jest.spyOn(service as any, 'getShipmentKpis').mockResolvedValue({});
      jest.spyOn(service as any, 'getAlertCounts').mockResolvedValue({});
    });

    function rangeUsedBy(spyName: string) {
      return (jest.spyOn(service as any, spyName) as jest.Mock).mock.calls[0];
    }

    it('TODAY resolves to the start and end of the current local day', async () => {
      await service.getOverview('org-1', 'user-1', { range: DateRangeType.TODAY });

      const [, startDate, endDate] = rangeUsedBy('getDonationKpis');
      expect(startDate.getHours()).toBe(0);
      expect(endDate.getHours()).toBe(23);
      expect(startDate.getDate()).toBe(fixedNow.getDate());
      expect(endDate.getDate()).toBe(fixedNow.getDate());
    });

    it('YESTERDAY resolves to the start and end of the previous local day', async () => {
      await service.getOverview('org-1', 'user-1', { range: DateRangeType.YESTERDAY });

      const [, startDate, endDate] = rangeUsedBy('getDonationKpis');
      const expectedDay = new Date(fixedNow);
      expectedDay.setDate(expectedDay.getDate() - 1);
      expect(startDate.getDate()).toBe(expectedDay.getDate());
      expect(endDate.getDate()).toBe(expectedDay.getDate());
      expect(startDate.getHours()).toBe(0);
      expect(endDate.getHours()).toBe(23);
    });

    it('LAST_7_DAYS spans 7 calendar days ending today (6 days back through today, inclusive)', async () => {
      await service.getOverview('org-1', 'user-1', { range: DateRangeType.LAST_7_DAYS });

      const [, startDate, endDate] = rangeUsedBy('getDonationKpis');
      const diffDays = Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000);
      expect(diffDays).toBe(7);
      expect(startDate.getDate()).toBe(new Date(fixedNow.getTime() - 6 * 86_400_000).getDate());
    });

    it('LAST_30_DAYS spans 30 calendar days ending today (29 days back through today, inclusive)', async () => {
      await service.getOverview('org-1', 'user-1', { range: DateRangeType.LAST_30_DAYS });

      const [, startDate, endDate] = rangeUsedBy('getDonationKpis');
      const diffDays = Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000);
      expect(diffDays).toBe(30);
    });

    it('LAST_90_DAYS spans 90 calendar days ending today (89 days back through today, inclusive)', async () => {
      await service.getOverview('org-1', 'user-1', { range: DateRangeType.LAST_90_DAYS });

      const [, startDate, endDate] = rangeUsedBy('getDonationKpis');
      const diffDays = Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000);
      expect(diffDays).toBe(90);
    });

    it('THIS_MONTH starts on the 1st of the current local month', async () => {
      await service.getOverview('org-1', 'user-1', { range: DateRangeType.THIS_MONTH });

      const [, startDate] = rangeUsedBy('getDonationKpis');
      expect(startDate.getDate()).toBe(1);
      expect(startDate.getMonth()).toBe(fixedNow.getMonth());
    });

    it('LAST_MONTH spans the entire previous calendar month', async () => {
      await service.getOverview('org-1', 'user-1', { range: DateRangeType.LAST_MONTH });

      const [, startDate, endDate] = rangeUsedBy('getDonationKpis');
      expect(startDate.getDate()).toBe(1);
      expect(endDate.getMonth()).toBe(startDate.getMonth());
      expect(startDate.getMonth()).toBe((fixedNow.getMonth() + 11) % 12);
    });

    it('THIS_YEAR starts on January 1st of the current local year', async () => {
      await service.getOverview('org-1', 'user-1', { range: DateRangeType.THIS_YEAR });

      const [, startDate] = rangeUsedBy('getDonationKpis');
      expect(startDate.getMonth()).toBe(0);
      expect(startDate.getDate()).toBe(1);
      expect(startDate.getFullYear()).toBe(fixedNow.getFullYear());
    });

    it('CUSTOM uses the given startDate/endDate when both are provided', async () => {
      await service.getOverview('org-1', 'user-1', {
        range: DateRangeType.CUSTOM,
        startDate: '2026-01-05',
        endDate: '2026-01-10',
      });

      const [, startDate, endDate] = rangeUsedBy('getDonationKpis');
      expect(startDate.getDate()).toBe(5);
      expect(endDate.getDate()).toBe(10);
    });

    it('CUSTOM without explicit dates falls back to the last 30 days', async () => {
      await service.getOverview('org-1', 'user-1', { range: DateRangeType.CUSTOM });

      const [, startDate, endDate] = rangeUsedBy('getDonationKpis');
      const diffDays = Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000);
      expect(diffDays).toBe(30);
    });

    it('an unrecognized/omitted range falls back to the last 30 days', async () => {
      await service.getOverview('org-1', 'user-1', {});

      const [, startDate, endDate] = rangeUsedBy('getDonationKpis');
      const diffDays = Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000);
      expect(diffDays).toBe(30);
    });

    it('defaults timezone to UTC when none is given', async () => {
      const getDateRange = (service as any).getDateRange.bind(service);
      const result = getDateRange(DateRangeType.TODAY, undefined, undefined, undefined);

      expect(result.timezone).toBe('UTC');
    });
  });

  describe('getOverview (orchestration)', () => {
    it('validates access, composes every KPI section, and returns the combined shape', async () => {
      prisma.organizationMembership.findFirst.mockResolvedValue({ id: 'm-1' });
      jest.spyOn(service as any, 'getInventorySummary').mockResolvedValue({ totalUnits: 1 });
      jest.spyOn(service as any, 'getDonationKpis').mockResolvedValue({ total: 2 });
      jest.spyOn(service as any, 'getEmergencyKpis').mockResolvedValue({ total: 3 });
      jest.spyOn(service as any, 'getAppointmentKpis').mockResolvedValue({ total: 4 });
      jest.spyOn(service as any, 'getRequestKpis').mockResolvedValue({ total: 5 });
      jest.spyOn(service as any, 'getShipmentKpis').mockResolvedValue({ total: 6 });
      jest.spyOn(service as any, 'getAlertCounts').mockResolvedValue({ critical: 0 });

      const result = await service.getOverview('org-1', 'user-1', {});

      expect(result).toEqual({
        inventory: { totalUnits: 1 },
        donations: { total: 2 },
        emergencies: { total: 3 },
        appointments: { total: 4 },
        requests: { total: 5 },
        shipments: { total: 6 },
        alerts: { critical: 0 },
      });
    });
  });

  describe('getInventoryAnalytics (orchestration)', () => {
    it('validates access and composes the inventory-specific shape', async () => {
      prisma.organizationMembership.findFirst.mockResolvedValue({ id: 'm-1' });
      jest.spyOn(service as any, 'getInventorySummary').mockResolvedValue({ totalUnits: 1 });
      jest.spyOn(service as any, 'getInventoryByBloodGroup').mockResolvedValue([]);
      jest.spyOn(service as any, 'getInventoryByComponent').mockResolvedValue([]);
      jest.spyOn(service as any, 'getInventoryTrends').mockResolvedValue({ data: [] });
      jest.spyOn(service as any, 'getInventoryMovements').mockResolvedValue([]);

      const result = await service.getInventoryAnalytics('org-1', 'user-1', {});

      expect(result).toEqual({
        summary: { totalUnits: 1 },
        byBloodGroup: [],
        byComponent: [],
        trends: { data: [] },
        movements: [],
      });
    });
  });

  describe('getActivityFeed', () => {
    it('merges donations and emergencies, sorted by timestamp descending', async () => {
      prisma.organizationMembership.findFirst.mockResolvedValue({ id: 'm-1' });
      prisma.donation.findMany.mockResolvedValue([
        { id: 'd-1', status: 'COMPLETED', updatedAt: new Date('2026-01-01T00:00:00Z') },
      ]);
      prisma.emergencyRequest.findMany.mockResolvedValue([
        { id: 'e-1', status: 'ACTIVE', updatedAt: new Date('2026-01-02T00:00:00Z') },
      ]);

      const result = await service.getActivityFeed('org-1', 'user-1', {});

      expect(result.total).toBe(2);
      expect(result.items[0]!.id).toBe('e-1');
      expect(result.items[1]!.id).toBe('d-1');
    });

    it('swallows a donation-query failure and still returns emergency activity', async () => {
      prisma.organizationMembership.findFirst.mockResolvedValue({ id: 'm-1' });
      prisma.donation.findMany.mockRejectedValue(new Error('db down'));
      prisma.emergencyRequest.findMany.mockResolvedValue([
        { id: 'e-1', status: 'ACTIVE', updatedAt: new Date() },
      ]);

      const result = await service.getActivityFeed('org-1', 'user-1', {});

      expect(result.total).toBe(1);
      expect(result.items[0]!.id).toBe('e-1');
    });

    it('swallows an emergency-query failure and still returns donation activity', async () => {
      prisma.organizationMembership.findFirst.mockResolvedValue({ id: 'm-1' });
      prisma.donation.findMany.mockResolvedValue([
        { id: 'd-1', status: 'COMPLETED', updatedAt: new Date() },
      ]);
      prisma.emergencyRequest.findMany.mockRejectedValue(new Error('db down'));

      const result = await service.getActivityFeed('org-1', 'user-1', {});

      expect(result.total).toBe(1);
      expect(result.items[0]!.id).toBe('d-1');
    });

    it('caps the returned items at 50 even when more activities exist', async () => {
      prisma.organizationMembership.findFirst.mockResolvedValue({ id: 'm-1' });
      const donations = Array.from({ length: 60 }, (_, i) => ({
        id: `d-${i}`,
        status: 'COMPLETED',
        updatedAt: new Date(Date.now() - i * 1000),
      }));
      prisma.donation.findMany.mockResolvedValue(donations);
      prisma.emergencyRequest.findMany.mockResolvedValue([]);

      const result = await service.getActivityFeed('org-1', 'user-1', {});

      expect(result.items).toHaveLength(50);
      expect(result.total).toBe(60);
    });

    it('passes a custom limit through to each underlying query', async () => {
      prisma.organizationMembership.findFirst.mockResolvedValue({ id: 'm-1' });
      prisma.donation.findMany.mockResolvedValue([]);
      prisma.emergencyRequest.findMany.mockResolvedValue([]);

      await service.getActivityFeed('org-1', 'user-1', { limit: '10' });

      expect(prisma.donation.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 10 }));
      expect(prisma.emergencyRequest.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 10 }));
    });
  });

  describe('getAlerts', () => {
    it('marks an alert CRITICAL when currentValue is below 2, HIGH otherwise', async () => {
      prisma.organizationMembership.findFirst.mockResolvedValue({ id: 'm-1' });
      prisma.inventoryAlert.findMany.mockResolvedValue([
        { id: 'a-1', type: 'LOW_STOCK', currentValue: 1, message: 'low', acknowledged: false, createdAt: new Date() },
        { id: 'a-2', type: 'LOW_STOCK', currentValue: 4, message: 'low-ish', acknowledged: false, createdAt: new Date() },
      ]);

      const result = await service.getAlerts('org-1', 'user-1');

      expect(result.alerts[0]!.priority).toBe('CRITICAL');
      expect(result.alerts[1]!.priority).toBe('HIGH');
      expect(result.critical).toBe(1);
      expect(result.high).toBe(1);
    });

    it('treats a null currentValue as HIGH, not CRITICAL', async () => {
      prisma.organizationMembership.findFirst.mockResolvedValue({ id: 'm-1' });
      prisma.inventoryAlert.findMany.mockResolvedValue([
        { id: 'a-1', type: 'EXPIRING_SOON', currentValue: null, message: 'soon', acknowledged: false, createdAt: new Date() },
      ]);

      const result = await service.getAlerts('org-1', 'user-1');

      expect(result.alerts[0]!.priority).toBe('HIGH');
    });

    it('only queries unacknowledged alerts', async () => {
      prisma.organizationMembership.findFirst.mockResolvedValue({ id: 'm-1' });
      prisma.inventoryAlert.findMany.mockResolvedValue([]);

      await service.getAlerts('org-1', 'user-1');

      expect(prisma.inventoryAlert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizationId: 'org-1', acknowledged: false } }),
      );
    });
  });

  describe('getInventorySummary (private, exercised via getInventoryAnalytics)', () => {
    async function callGetInventorySummary(units: any[]) {
      prisma.bloodUnit.findMany.mockResolvedValue(units);
      return (service as any).getInventorySummary('org-1');
    }

    it('counts units by status', async () => {
      const result = await callGetInventorySummary([
        { status: 'AVAILABLE', bloodType: 'O', rhFactor: 'POSITIVE' },
        { status: 'RESERVED', bloodType: 'A', rhFactor: 'POSITIVE' },
        { status: 'QUARANTINED', bloodType: 'B', rhFactor: 'NEGATIVE' },
      ]);

      expect(result.totalUnits).toBe(3);
      expect(result.availableUnits).toBe(1);
      expect(result.reservedUnits).toBe(1);
      expect(result.quarantinedUnits).toBe(1);
    });

    it('counts EXPIRED units separately from quarantined ones', async () => {
      const result = await callGetInventorySummary([
        { status: 'EXPIRED', bloodType: 'O', rhFactor: 'POSITIVE' },
        { status: 'EXPIRED', bloodType: 'A', rhFactor: 'POSITIVE' },
        { status: 'QUARANTINED', bloodType: 'B', rhFactor: 'NEGATIVE' },
      ]);

      expect(result.expiredUnits).toBe(2);
      expect(result.quarantinedUnits).toBe(1);
    });

    it('flags a blood group with zero available units as critical, not merely low', async () => {
      const result = await callGetInventorySummary([]);

      expect(result.criticalGroups).toContain('O+');
      expect(result.lowStockGroups).not.toContain('O+');
    });

    it('flags a blood group with 1-4 available units as low stock, not critical', async () => {
      const units = Array.from({ length: 3 }, () => ({ status: 'AVAILABLE', bloodType: 'O', rhFactor: 'POSITIVE' }));
      const result = await callGetInventorySummary(units);

      expect(result.lowStockGroups).toContain('O+');
      expect(result.criticalGroups).not.toContain('O+');
    });

    it('does not flag a blood group with 5+ available units at all', async () => {
      const units = Array.from({ length: 5 }, () => ({ status: 'AVAILABLE', bloodType: 'O', rhFactor: 'POSITIVE' }));
      const result = await callGetInventorySummary(units);

      expect(result.lowStockGroups).not.toContain('O+');
      expect(result.criticalGroups).not.toContain('O+');
    });

    /**
     * The three tests above describe a threshold of five, which is what the
     * stubbed service answers. These two say where the five comes from -- the
     * dashboard used to carry its own `count < 5`, a second copy of the
     * constant the alert engine used, and the two could disagree about whether
     * a group was low.
     */
    it('uses the threshold the organisation configured, not a number of its own', async () => {
      thresholds.resolveFrom.mockReturnValue({
        threshold: 20,
        source: 'CONFIGURED',
        scopeKey: 'TYPE:O:POSITIVE',
      });
      const units = Array.from({ length: 12 }, () => ({ status: 'AVAILABLE', bloodType: 'O', rhFactor: 'POSITIVE' }));

      const result = await callGetInventorySummary(units);

      // Twelve units: comfortably above five, and low against this site's
      // own threshold of twenty.
      expect(result.lowStockGroups).toContain('O+');
    });

    it('flags nothing as low in production when no threshold is configured', async () => {
      thresholds.resolveFrom.mockReturnValue({ threshold: null, source: 'NOT_CONFIGURED', scopeKey: null });
      const units = Array.from({ length: 1 }, () => ({ status: 'AVAILABLE', bloodType: 'O', rhFactor: 'POSITIVE' }));

      const result = await callGetInventorySummary(units);

      // One unit, and the dashboard says nothing -- because nobody has said
      // what low means here, and guessing is what this sprint removed.
      expect(result.lowStockGroups).not.toContain('O+');
      // Zero would still be critical: no configuration is needed to know that
      // none is none.
      expect(result.criticalGroups).not.toContain('O+');
    });
  });

  describe('getInventoryByBloodGroup (private, exercised via getInventoryAnalytics)', () => {
    it('matches the shared BloodGroupCountDto shape, with percent computed against the group total', async () => {
      prisma.bloodUnit.groupBy.mockResolvedValue([
        { bloodType: 'O', rhFactor: 'POSITIVE', _count: { id: 0 } },
        { bloodType: 'A', rhFactor: 'POSITIVE', _count: { id: 3 } },
        { bloodType: 'B', rhFactor: 'NEGATIVE', _count: { id: 7 } },
      ]);

      const result = await (service as any).getInventoryByBloodGroup('org-1');

      expect(result.find((g: any) => g.bloodGroup === 'O')).toEqual({
        bloodGroup: 'O',
        rhFactor: 'POSITIVE',
        fullName: 'O+',
        count: 0,
        percent: 0,
      });
      expect(result.find((g: any) => g.bloodGroup === 'A')).toEqual({
        bloodGroup: 'A',
        rhFactor: 'POSITIVE',
        fullName: 'A+',
        count: 3,
        percent: 30,
      });
      expect(result.find((g: any) => g.bloodGroup === 'B')).toEqual({
        bloodGroup: 'B',
        rhFactor: 'NEGATIVE',
        fullName: 'B-',
        count: 7,
        percent: 70,
      });
    });
  });

  describe('getInventoryByComponent (private, exercised via getInventoryAnalytics)', () => {
    it('joins total/available/reserved counts per component type', async () => {
      prisma.bloodUnit.groupBy
        .mockResolvedValueOnce([
          { componentType: 'WHOLE_BLOOD', _count: { id: 10 } },
          { componentType: 'PLASMA', _count: { id: 4 } },
        ])
        .mockResolvedValueOnce([{ componentType: 'WHOLE_BLOOD', _count: { id: 6 } }])
        .mockResolvedValueOnce([{ componentType: 'PLASMA', _count: { id: 2 } }]);

      const result = await (service as any).getInventoryByComponent('org-1');

      expect(result).toEqual([
        { componentType: 'WHOLE_BLOOD', count: 10, available: 6, reserved: 0 },
        { componentType: 'PLASMA', count: 4, available: 0, reserved: 2 },
      ]);
    });
  });

  describe('getDonationSummary (private, exercised via getDonationAnalytics)', () => {
    it('counts NO_SHOW donations separately and computes completionRate from completed/total', async () => {
      prisma.donation.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(7) // completed
        .mockResolvedValueOnce(2); // noShow
      prisma.donation.findMany.mockResolvedValue([{ volumeMl: 450 }, { volumeMl: 450 }]);

      const result = await (service as any).getDonationSummary('org-1', new Date(), new Date());

      expect(result.noShows).toBe(2);
      expect(result.completionRate).toBe(70);
      expect(prisma.donation.count).toHaveBeenNthCalledWith(3, expect.objectContaining({
        where: expect.objectContaining({ status: 'NO_SHOW' }),
      }));
    });

    it('returns a null completionRate when there are no donations in range', async () => {
      prisma.donation.count.mockResolvedValue(0);
      prisma.donation.findMany.mockResolvedValue([]);

      const result = await (service as any).getDonationSummary('org-1', new Date(), new Date());

      expect(result.completionRate).toBeNull();
    });
  });

  describe('getEmergenciesByBloodGroup (private, exercised via getEmergencyAnalytics)', () => {
    it('matches the shared BloodGroupCountDto shape', async () => {
      prisma.emergencyRequest.groupBy.mockResolvedValue([
        { bloodType: 'O', rhFactor: 'NEGATIVE', _count: { id: 3 } },
        { bloodType: 'A', rhFactor: 'POSITIVE', _count: { id: 1 } },
      ]);

      const result = await (service as any).getEmergenciesByBloodGroup('org-1', new Date(), new Date());

      expect(result).toEqual([
        { bloodGroup: 'O', rhFactor: 'NEGATIVE', fullName: 'O-', count: 3, percent: 75 },
        { bloodGroup: 'A', rhFactor: 'POSITIVE', fullName: 'A+', count: 1, percent: 25 },
      ]);
    });
  });

  describe('getAlertCounts (private, exercised via getOverview)', () => {
    it('buckets LOW_STOCK alerts into critical/high by currentValue, and EXPIRING_SOON/EXPIRED/QUARANTINED into medium/low', async () => {
      prisma.inventoryAlert.findMany.mockResolvedValue([
        { type: 'LOW_STOCK', currentValue: 1 },
        { type: 'LOW_STOCK', currentValue: 3 },
        { type: 'LOW_STOCK', currentValue: null },
        { type: 'EXPIRING_SOON', currentValue: null },
        { type: 'EXPIRED', currentValue: null },
        { type: 'QUARANTINED', currentValue: null },
      ]);

      const result = await (service as any).getAlertCounts('org-1');

      expect(result).toEqual({ critical: 1, high: 2, medium: 1, low: 2 });
    });
  });

  describe('percent-rounding pattern (representative of every groupBy-based *ByStatus/*ByPriority helper)', () => {
    it('rounds percent to one decimal place across a non-evenly-divisible split', async () => {
      prisma.donation.groupBy.mockResolvedValue([
        { status: 'COMPLETED', _count: { id: 2 } },
        { status: 'CANCELLED', _count: { id: 1 } },
      ]);

      const result = await (service as any).getDonationsByStatus('org-1', new Date(), new Date());

      const completed = result.find((r: any) => r.status === 'COMPLETED');
      const cancelled = result.find((r: any) => r.status === 'CANCELLED');
      expect(completed.percent).toBe(66.7);
      expect(cancelled.percent).toBe(33.3);
    });

    it('returns 0 percent for an empty result set rather than dividing by zero', async () => {
      prisma.donation.groupBy.mockResolvedValue([]);

      const result = await (service as any).getDonationsByStatus('org-1', new Date(), new Date());

      expect(result).toEqual([]);
    });
  });
});
