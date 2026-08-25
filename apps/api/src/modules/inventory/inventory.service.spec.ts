import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { BloodUnitStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { InventoryService } from './inventory.service';

function makeUnit(overrides: Record<string, any> = {}) {
  return {
    id: 'unit-1',
    organizationId: 'org-1',
    unitReference: 'BU-2026-000001',
    status: BloodUnitStatus.COLLECTED,
    locationId: 'loc-1',
    ...overrides,
  };
}

describe('InventoryService unit status transitions', () => {
  let service: InventoryService;
  let prisma: any;
  let tx: any;

  beforeEach(async () => {
    tx = {
      bloodUnit: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue(makeUnit()),
        findUniqueOrThrow: jest.fn().mockImplementation(async () => makeUnit()),
      },
      inventoryMovement: { create: jest.fn().mockResolvedValue({}) },
    };

    prisma = {
      bloodUnit: { findFirst: jest.fn() },
      inventoryLocation: { findFirst: jest.fn() },
      $transaction: jest.fn().mockImplementation(async (cb: any) => cb(tx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogsService, useValue: { log: jest.fn().mockResolvedValue({}) } },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
  });

  describe('releaseUnit', () => {
    it('claims the transition atomically when the unit is COLLECTED or QUARANTINED', async () => {
      prisma.bloodUnit.findFirst.mockResolvedValue(makeUnit({ status: BloodUnitStatus.COLLECTED }));

      await service.releaseUnit('org-1', 'unit-1', 'user-1', { reason: 'ok' } as any);

      expect(tx.bloodUnit.updateMany).toHaveBeenCalledWith({
        where: { id: 'unit-1', status: { in: [BloodUnitStatus.COLLECTED, BloodUnitStatus.QUARANTINED] } },
        data: { status: BloodUnitStatus.AVAILABLE },
      });
      expect(tx.inventoryMovement.create).toHaveBeenCalled();
    });

    it('throws ConflictException and skips the movement record when the claim loses the race', async () => {
      prisma.bloodUnit.findFirst.mockResolvedValue(makeUnit({ status: BloodUnitStatus.COLLECTED }));
      tx.bloodUnit.updateMany.mockResolvedValue({ count: 0 });
      tx.bloodUnit.findUnique.mockResolvedValue({ status: BloodUnitStatus.DISCARDED });

      await expect(
        service.releaseUnit('org-1', 'unit-1', 'user-1', { reason: 'ok' } as any),
      ).rejects.toThrow(ConflictException);
      expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
    });
  });

  describe('quarantineUnit', () => {
    it('claims the transition atomically when the unit is AVAILABLE or COLLECTED', async () => {
      prisma.bloodUnit.findFirst.mockResolvedValue(makeUnit({ status: BloodUnitStatus.AVAILABLE }));

      await service.quarantineUnit('org-1', 'unit-1', 'user-1', { reason: 'ok' } as any);

      expect(tx.bloodUnit.updateMany).toHaveBeenCalledWith({
        where: { id: 'unit-1', status: { in: [BloodUnitStatus.AVAILABLE, BloodUnitStatus.COLLECTED] } },
        data: { status: BloodUnitStatus.QUARANTINED },
      });
    });

    it('throws ConflictException and skips the movement record when the claim loses the race', async () => {
      prisma.bloodUnit.findFirst.mockResolvedValue(makeUnit({ status: BloodUnitStatus.AVAILABLE }));
      tx.bloodUnit.updateMany.mockResolvedValue({ count: 0 });
      tx.bloodUnit.findUnique.mockResolvedValue({ status: BloodUnitStatus.RESERVED });

      await expect(
        service.quarantineUnit('org-1', 'unit-1', 'user-1', { reason: 'ok' } as any),
      ).rejects.toThrow(ConflictException);
      expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
    });
  });

  describe('discardUnit', () => {
    it('claims the transition atomically when the unit has not been used', async () => {
      prisma.bloodUnit.findFirst.mockResolvedValue(makeUnit({ status: BloodUnitStatus.AVAILABLE }));

      await service.discardUnit('org-1', 'unit-1', 'user-1', { reason: 'expired' } as any);

      expect(tx.bloodUnit.updateMany).toHaveBeenCalledWith({
        where: { id: 'unit-1', status: { not: BloodUnitStatus.USED } },
        data: { status: BloodUnitStatus.DISCARDED },
      });
    });

    it('throws ConflictException and skips the movement record when the claim loses the race', async () => {
      prisma.bloodUnit.findFirst.mockResolvedValue(makeUnit({ status: BloodUnitStatus.AVAILABLE }));
      tx.bloodUnit.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.discardUnit('org-1', 'unit-1', 'user-1', { reason: 'expired' } as any),
      ).rejects.toThrow(ConflictException);
      expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
    });
  });

  describe('moveUnit', () => {
    beforeEach(() => {
      prisma.inventoryLocation.findFirst.mockResolvedValue({ id: 'loc-2', organizationId: 'org-1', active: true });
    });

    it('claims the transition atomically when the unit is movable', async () => {
      prisma.bloodUnit.findFirst.mockResolvedValue(makeUnit({ status: BloodUnitStatus.AVAILABLE }));

      await service.moveUnit('org-1', 'unit-1', 'user-1', { toLocationId: 'loc-2', reason: 'restock' } as any);

      expect(tx.bloodUnit.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'unit-1',
          status: { notIn: [BloodUnitStatus.USED, BloodUnitStatus.DISCARDED, BloodUnitStatus.EXPIRED] },
        },
        data: { locationId: 'loc-2' },
      });
    });

    it('throws ConflictException and skips the movement record when the claim loses the race', async () => {
      prisma.bloodUnit.findFirst.mockResolvedValue(makeUnit({ status: BloodUnitStatus.AVAILABLE }));
      tx.bloodUnit.updateMany.mockResolvedValue({ count: 0 });
      tx.bloodUnit.findUnique.mockResolvedValue({ status: BloodUnitStatus.USED });

      await expect(
        service.moveUnit('org-1', 'unit-1', 'user-1', { toLocationId: 'loc-2', reason: 'restock' } as any),
      ).rejects.toThrow(ConflictException);
      expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
    });
  });
});
