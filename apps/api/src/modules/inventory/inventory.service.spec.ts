import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { BloodUnitStatus, ComponentType, OrganizationStatus, ReservationStatus } from '@prisma/client';
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
    organization: { id: 'org-1', status: OrganizationStatus.ACTIVE },
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
      bloodUnitReservation: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };

    prisma = {
      bloodUnit: { findFirst: jest.fn(), count: jest.fn().mockResolvedValue(0) },
      inventoryLocation: { findFirst: jest.fn() },
      inventoryAlert: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn().mockImplementation(async (cb: any) => cb(tx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
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

  describe('issueUnit', () => {
    it('claims the transition atomically when the unit is AVAILABLE or RESERVED and fulfills any active reservation', async () => {
      prisma.bloodUnit.findFirst.mockResolvedValue(makeUnit({ status: BloodUnitStatus.RESERVED }));

      await service.issueUnit('org-1', 'unit-1', 'user-1', { reason: 'Transfused to patient MRN-1234' } as any);

      expect(tx.bloodUnit.updateMany).toHaveBeenCalledWith({
        where: { id: 'unit-1', status: { in: [BloodUnitStatus.AVAILABLE, BloodUnitStatus.RESERVED] } },
        data: { status: BloodUnitStatus.USED },
      });
      expect(tx.bloodUnitReservation.updateMany).toHaveBeenCalledWith({
        where: { bloodUnitId: 'unit-1', status: ReservationStatus.ACTIVE },
        data: { status: ReservationStatus.FULFILLED, fulfilledAt: expect.any(Date) },
      });
      expect(tx.inventoryMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ type: 'USED' }) }),
      );
    });

    it('rejects issuing a unit that is already used', async () => {
      prisma.bloodUnit.findFirst.mockResolvedValue(makeUnit({ status: BloodUnitStatus.USED }));

      await expect(
        service.issueUnit('org-1', 'unit-1', 'user-1', { reason: 'x' } as any),
      ).rejects.toThrow(BadRequestException);
      expect(tx.bloodUnit.updateMany).not.toHaveBeenCalled();
    });

    it('throws ConflictException and skips the movement record when the claim loses the race', async () => {
      prisma.bloodUnit.findFirst.mockResolvedValue(makeUnit({ status: BloodUnitStatus.AVAILABLE }));
      tx.bloodUnit.updateMany.mockResolvedValue({ count: 0 });
      tx.bloodUnit.findUnique.mockResolvedValue({ status: BloodUnitStatus.DISCARDED });

      await expect(
        service.issueUnit('org-1', 'unit-1', 'user-1', { reason: 'x' } as any),
      ).rejects.toThrow(ConflictException);
      expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
    });
  });

  describe('adjustUnit', () => {
    it('updates only the provided fields and logs an ADJUSTED movement', async () => {
      prisma.bloodUnit.findFirst.mockResolvedValue(makeUnit({ status: BloodUnitStatus.AVAILABLE, volumeMl: 450, componentType: ComponentType.WHOLE_BLOOD }));
      tx.bloodUnit.findUniqueOrThrow.mockResolvedValue(makeUnit({ status: BloodUnitStatus.AVAILABLE, volumeMl: 400 }));

      await service.adjustUnit('org-1', 'unit-1', 'user-1', { reason: 'Correcting clerical entry error', volumeMl: 400 } as any);

      expect(tx.bloodUnit.updateMany).toHaveBeenCalledWith({
        where: { id: 'unit-1', status: { notIn: [BloodUnitStatus.USED, BloodUnitStatus.DISCARDED, BloodUnitStatus.EXPIRED] } },
        data: { volumeMl: 400 },
      });
      expect(tx.inventoryMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ type: 'ADJUSTED', reason: 'Correcting clerical entry error' }) }),
      );
    });

    it('rejects adjusting a unit that has already been used', async () => {
      prisma.bloodUnit.findFirst.mockResolvedValue(makeUnit({ status: BloodUnitStatus.USED }));

      await expect(
        service.adjustUnit('org-1', 'unit-1', 'user-1', { reason: 'x', volumeMl: 400 } as any),
      ).rejects.toThrow(BadRequestException);
      expect(tx.bloodUnit.updateMany).not.toHaveBeenCalled();
    });

    it('rejects a request with no fields to adjust', async () => {
      prisma.bloodUnit.findFirst.mockResolvedValue(makeUnit({ status: BloodUnitStatus.AVAILABLE }));

      await expect(
        service.adjustUnit('org-1', 'unit-1', 'user-1', { reason: 'x' } as any),
      ).rejects.toThrow(BadRequestException);
      expect(tx.bloodUnit.updateMany).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the claim loses the race', async () => {
      prisma.bloodUnit.findFirst.mockResolvedValue(makeUnit({ status: BloodUnitStatus.AVAILABLE }));
      tx.bloodUnit.updateMany.mockResolvedValue({ count: 0 });
      tx.bloodUnit.findUnique.mockResolvedValue({ status: BloodUnitStatus.USED });

      await expect(
        service.adjustUnit('org-1', 'unit-1', 'user-1', { reason: 'x', volumeMl: 400 } as any),
      ).rejects.toThrow(ConflictException);
      expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
    });
  });

  describe('quarantineUnit alerting', () => {
    it('creates a QUARANTINED alert reflecting the current quarantined count', async () => {
      prisma.bloodUnit.findFirst.mockResolvedValue(makeUnit({ status: BloodUnitStatus.AVAILABLE, bloodType: 'O', rhFactor: 'NEGATIVE' }));
      prisma.bloodUnit.count.mockResolvedValue(3);

      await service.quarantineUnit('org-1', 'unit-1', 'user-1', { reason: 'contamination suspected' } as any);

      expect(prisma.inventoryAlert.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ organizationId: 'org-1', type: 'QUARANTINED', currentValue: 3 }),
        }),
      );
    });

    it('refreshes an existing unacknowledged alert instead of creating a duplicate', async () => {
      prisma.bloodUnit.findFirst.mockResolvedValue(makeUnit({ status: BloodUnitStatus.AVAILABLE, bloodType: 'O', rhFactor: 'NEGATIVE' }));
      prisma.bloodUnit.count.mockResolvedValue(4);
      prisma.inventoryAlert.findFirst.mockResolvedValue({ id: 'alert-1' });

      await service.quarantineUnit('org-1', 'unit-1', 'user-1', { reason: 'contamination suspected' } as any);

      expect(prisma.inventoryAlert.create).not.toHaveBeenCalled();
      expect(prisma.inventoryAlert.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'alert-1' }, data: expect.objectContaining({ currentValue: 4 }) }),
      );
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

describe('InventoryService organization-status access checks', () => {
  let service: InventoryService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      bloodUnit: { findFirst: jest.fn(), count: jest.fn().mockResolvedValue(0) },
      bloodUnitReservation: { findFirst: jest.fn() },
      user: { findUnique: jest.fn() },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogsService, useValue: { log: jest.fn().mockResolvedValue({}) } },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
  });

  it.each([OrganizationStatus.PENDING_APPROVAL, OrganizationStatus.SUSPENDED, OrganizationStatus.DEACTIVATED])(
    'rejects a unit mutation when the owning organization is %s',
    async (status) => {
      prisma.bloodUnit.findFirst.mockResolvedValue(makeUnit({ organization: { id: 'org-1', status } }));

      await expect(
        service.releaseUnit('org-1', 'unit-1', 'user-1', { reason: 'ok' } as any),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    },
  );

  it.each([OrganizationStatus.PENDING_APPROVAL, OrganizationStatus.SUSPENDED, OrganizationStatus.DEACTIVATED])(
    'rejects staff of a %s organization from reading its own inventory',
    async (status) => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        memberships: [
          {
            organizationId: 'org-1',
            role: { code: 'HOSPITAL_STAFF' },
            organization: { id: 'org-1', status },
          },
        ],
      });

      await expect(service.getInventorySummary('org-1', 'user-1')).rejects.toThrow(ForbiddenException);
    },
  );

  it('allows super admins to read inventory regardless of the organization status', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'admin-1',
      memberships: [
        {
          organizationId: 'org-other',
          role: { code: 'SUPER_ADMIN' },
          organization: { id: 'org-other', status: OrganizationStatus.ACTIVE },
        },
      ],
    });
    prisma.bloodUnit.findMany = jest.fn().mockResolvedValue([]);
    prisma.inventoryLocation = { findMany: jest.fn().mockResolvedValue([]) };

    await expect(service.getInventorySummary('org-1', 'admin-1')).resolves.toBeDefined();
  });

  it('rejects releasing a reservation when the organization is no longer ACTIVE', async () => {
    prisma.bloodUnitReservation.findFirst.mockResolvedValue({
      id: 'res-1',
      bloodUnitId: 'unit-1',
      bloodUnit: makeUnit(),
      organization: { id: 'org-1', status: OrganizationStatus.SUSPENDED },
    });

    await expect(
      service.releaseReservation('org-1', 'res-1', 'user-1', { reason: 'ok' } as any),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
