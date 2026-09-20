import { Test, TestingModule } from '@nestjs/testing';
import { BloodUnitStatus, ReservationStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { InventoryService } from './inventory.service';
import { InventoryThresholdsService } from '../inventory-thresholds/inventory-thresholds.service';
import { InventoryCronService } from './inventory-cron.service';
import { CustodyLedgerService } from '../custody/custody-ledger.service';

describe('InventoryCronService', () => {
  let service: InventoryCronService;
  let prisma: any;
  let tx: any;
  let inventory: { ensureAlert: jest.Mock };

  beforeEach(async () => {
    tx = {
      bloodUnit: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      inventoryMovement: {
        create: jest.fn().mockResolvedValue({}),
        // The custody ledger reads the unit's highest sequence before appending.
        aggregate: jest.fn().mockResolvedValue({ _max: { sequence: null } }),
      },
      bloodUnitReservation: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };

    prisma = {
      bloodUnit: { findMany: jest.fn().mockResolvedValue([]), groupBy: jest.fn().mockResolvedValue([]) },
      bloodUnitReservation: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn().mockImplementation(async (cb: any) => cb(tx)),
    };

    inventory = { ensureAlert: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryCronService,
        CustodyLedgerService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogsService, useValue: { log: jest.fn().mockResolvedValue({}) } },
        { provide: InventoryService, useValue: inventory },
        // The threshold service, stubbed to the development fallback these
        // tests were written against, so they keep asserting what they were
        // written to assert: which groups cross a threshold, not where the
        // number comes from. That it now comes from configuration is proved in
        // inventory-thresholds.service.spec.ts.
        {
          provide: InventoryThresholdsService,
          useValue: {
            listRows: jest.fn().mockResolvedValue([]),
            resolveFrom: jest.fn().mockReturnValue({
              threshold: 5,
              source: 'DEVELOPMENT_FALLBACK',
              scopeKey: null,
            }),
          },
        },
      ],
    }).compile();

    service = module.get<InventoryCronService>(InventoryCronService);
  });

  describe('expireUnits', () => {
    it('expires each candidate, releases its active reservation, and raises one alert per organization', async () => {
      prisma.bloodUnit.findMany.mockResolvedValue([
        { id: 'unit-1', organizationId: 'org-1', bloodType: 'O', rhFactor: 'NEGATIVE' },
        { id: 'unit-2', organizationId: 'org-1', bloodType: 'A', rhFactor: 'POSITIVE' },
        { id: 'unit-3', organizationId: 'org-2', bloodType: 'B', rhFactor: 'POSITIVE' },
      ]);

      const count = await service.expireUnits();

      expect(count).toBe(3);
      expect(tx.bloodUnit.updateMany).toHaveBeenCalledTimes(3);
      expect(tx.bloodUnit.updateMany).toHaveBeenCalledWith({
        where: { id: 'unit-1', status: { in: [BloodUnitStatus.COLLECTED, BloodUnitStatus.AVAILABLE, BloodUnitStatus.RESERVED, BloodUnitStatus.QUARANTINED] } },
        data: { status: BloodUnitStatus.EXPIRED },
      });
      expect(tx.bloodUnitReservation.updateMany).toHaveBeenCalledWith({
        where: { bloodUnitId: 'unit-1', status: ReservationStatus.ACTIVE },
        data: { status: ReservationStatus.EXPIRED, releasedAt: expect.any(Date) },
      });
      // org-1 had two units expire, org-2 had one - one alert call per org
      expect(inventory.ensureAlert).toHaveBeenCalledTimes(2);
      expect(inventory.ensureAlert).toHaveBeenCalledWith('org-1', 'EXPIRED', expect.any(String), null, null, 2);
      expect(inventory.ensureAlert).toHaveBeenCalledWith('org-2', 'EXPIRED', expect.any(String), null, null, 1);
    });

    it('does not count or alert on a unit that already changed status before the claim landed', async () => {
      prisma.bloodUnit.findMany.mockResolvedValue([{ id: 'unit-1', organizationId: 'org-1', bloodType: 'O', rhFactor: 'NEGATIVE' }]);
      tx.bloodUnit.updateMany.mockResolvedValue({ count: 0 });

      const count = await service.expireUnits();

      expect(count).toBe(0);
      expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
      expect(inventory.ensureAlert).not.toHaveBeenCalled();
    });

    it('returns 0 immediately when there is nothing to expire', async () => {
      prisma.bloodUnit.findMany.mockResolvedValue([]);
      const count = await service.expireUnits();
      expect(count).toBe(0);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('releaseExpiredReservations', () => {
    it('releases each expired reservation and bounces its unit back to AVAILABLE', async () => {
      prisma.bloodUnitReservation.findMany.mockResolvedValue([
        { id: 'res-1', bloodUnitId: 'unit-1', organizationId: 'org-1' },
      ]);

      const count = await service.releaseExpiredReservations();

      expect(count).toBe(1);
      expect(tx.bloodUnitReservation.updateMany).toHaveBeenCalledWith({
        where: { id: 'res-1', status: ReservationStatus.ACTIVE },
        data: { status: ReservationStatus.EXPIRED, releasedAt: expect.any(Date) },
      });
      expect(tx.bloodUnit.updateMany).toHaveBeenCalledWith({
        where: { id: 'unit-1', status: BloodUnitStatus.RESERVED },
        data: { status: BloodUnitStatus.AVAILABLE },
      });
      expect(tx.inventoryMovement.create).toHaveBeenCalled();
    });

    it('does not create a movement when the unit already expired out from under the reservation', async () => {
      prisma.bloodUnitReservation.findMany.mockResolvedValue([
        { id: 'res-1', bloodUnitId: 'unit-1', organizationId: 'org-1' },
      ]);
      tx.bloodUnit.updateMany.mockResolvedValue({ count: 0 });

      const count = await service.releaseExpiredReservations();

      expect(count).toBe(1);
      expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
    });
  });

  describe('checkStockLevels', () => {
    it('raises a LOW_STOCK alert only for groups below the threshold', async () => {
      prisma.bloodUnit.groupBy
        .mockResolvedValueOnce([
          { organizationId: 'org-1', bloodType: 'O', rhFactor: 'NEGATIVE', _count: { _all: 2 } },
          { organizationId: 'org-1', bloodType: 'A', rhFactor: 'POSITIVE', _count: { _all: 20 } },
        ])
        .mockResolvedValueOnce([]);

      await service.checkStockLevels();

      expect(inventory.ensureAlert).toHaveBeenCalledTimes(1);
      expect(inventory.ensureAlert).toHaveBeenCalledWith(
        'org-1', 'LOW_STOCK', expect.any(String), 'O', 'NEGATIVE', 2, 5,
      );
    });

    it('raises an EXPIRING_SOON alert for units expiring within the window', async () => {
      prisma.bloodUnit.groupBy
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { organizationId: 'org-1', bloodType: 'B', rhFactor: 'POSITIVE', _count: { _all: 4 } },
        ]);

      await service.checkStockLevels();

      expect(inventory.ensureAlert).toHaveBeenCalledWith(
        'org-1', 'EXPIRING_SOON', expect.any(String), 'B', 'POSITIVE', 4,
      );
    });
  });

  describe('runMaintenance', () => {
    it('audit-logs a summary only when something actually happened', async () => {
      const audit = { log: jest.fn().mockResolvedValue({}) };
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          InventoryCronService,
        CustodyLedgerService,
          { provide: PrismaService, useValue: prisma },
          { provide: AuditLogsService, useValue: audit },
          { provide: InventoryService, useValue: inventory },
          {
            provide: InventoryThresholdsService,
            useValue: {
              listRows: jest.fn().mockResolvedValue([]),
              resolveFrom: jest.fn().mockReturnValue({
                threshold: 5,
                source: 'DEVELOPMENT_FALLBACK',
                scopeKey: null,
              }),
            },
          },
        ],
      }).compile();
      const svc = module.get<InventoryCronService>(InventoryCronService);

      await svc.runMaintenance();
      expect(audit.log).not.toHaveBeenCalled();

      prisma.bloodUnit.findMany.mockResolvedValue([{ id: 'unit-1', organizationId: 'org-1', bloodType: 'O', rhFactor: 'NEGATIVE' }]);
      await svc.runMaintenance();
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'INVENTORY_MAINTENANCE_RUN' }),
      );
    });
  });
});
