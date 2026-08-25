import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ShipmentStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { LocationService } from './services/location.service';
import { ShipmentsService } from './shipments.service';

function makeShipment(overrides: Record<string, any> = {}) {
  return {
    id: 'shp-1',
    shipmentReference: 'SHP-2026-000001',
    status: ShipmentStatus.COURIER_ASSIGNED,
    courierId: 'courier-1',
    sourceOrganizationId: 'org-source',
    destinationOrganizationId: 'org-dest',
    bloodRequestId: 'req-1',
    bloodRequest: { requestReference: 'REQ-2026-000001' },
    units: [],
    ...overrides,
  };
}

describe('ShipmentsService status transitions', () => {
  let service: ShipmentsService;
  let prisma: any;
  let tx: any;

  const courier = { id: 'courier-1', userId: 'user-1', organizationId: 'org-source' };

  beforeEach(async () => {
    tx = {
      shipment: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockImplementation(async () => makeShipment()),
      },
      shipmentEvent: { create: jest.fn().mockResolvedValue({}) },
      shipmentUnit: { update: jest.fn().mockResolvedValue({}) },
      bloodUnit: { update: jest.fn().mockResolvedValue({}) },
      bloodUnitReservation: { update: jest.fn().mockResolvedValue({}) },
      inventoryMovement: { create: jest.fn().mockResolvedValue({}) },
      courier: { update: jest.fn().mockResolvedValue({}) },
      bloodRequest: { update: jest.fn().mockResolvedValue({}) },
      bloodRequestEvent: { create: jest.fn().mockResolvedValue({}) },
    };

    prisma = {
      shipment: { findUnique: jest.fn() },
      user: { findMany: jest.fn().mockResolvedValue([]) },
      courier: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn().mockImplementation(async (cb: any) => cb(tx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShipmentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogsService, useValue: { log: jest.fn().mockResolvedValue({}) } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: LocationService, useValue: {} },
      ],
    }).compile();

    service = module.get<ShipmentsService>(ShipmentsService);

    jest.spyOn(service, 'checkCourierAccess').mockResolvedValue(courier as any);
    jest.spyOn(service, 'checkHospitalAccess').mockResolvedValue({ user: { id: 'hosp-user-1' } } as any);
    jest.spyOn(service, 'checkBloodCenterAccess').mockResolvedValue({ user: { id: 'bc-user-1' } } as any);
  });

  describe('acceptShipment', () => {
    it('claims the transition atomically when the shipment is COURIER_ASSIGNED', async () => {
      prisma.shipment.findUnique.mockResolvedValue(makeShipment({ status: ShipmentStatus.COURIER_ASSIGNED }));

      await service.acceptShipment('user-1', 'shp-1');

      expect(tx.shipment.updateMany).toHaveBeenCalledWith({
        where: { id: 'shp-1', status: ShipmentStatus.COURIER_ASSIGNED },
        data: expect.objectContaining({ status: ShipmentStatus.COURIER_ACCEPTED }),
      });
      expect(tx.shipmentEvent.create).toHaveBeenCalled();
    });

    it('throws ConflictException and skips side effects when the claim loses the race', async () => {
      prisma.shipment.findUnique.mockResolvedValue(makeShipment({ status: ShipmentStatus.COURIER_ASSIGNED }));
      tx.shipment.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.acceptShipment('user-1', 'shp-1')).rejects.toThrow(ConflictException);
      expect(tx.shipmentEvent.create).not.toHaveBeenCalled();
    });
  });

  describe('declineShipment', () => {
    it('claims the transition atomically when the shipment is COURIER_ASSIGNED', async () => {
      prisma.shipment.findUnique.mockResolvedValue(makeShipment({ status: ShipmentStatus.COURIER_ASSIGNED }));

      await service.declineShipment('user-1', 'shp-1', 'traffic');

      expect(tx.shipment.updateMany).toHaveBeenCalledWith({
        where: { id: 'shp-1', status: ShipmentStatus.COURIER_ASSIGNED },
        data: expect.objectContaining({ status: ShipmentStatus.COURIER_DECLINED, courierId: null }),
      });
      expect(tx.courier.update).toHaveBeenCalled();
    });

    it('throws ConflictException and skips side effects when the claim loses the race', async () => {
      prisma.shipment.findUnique.mockResolvedValue(makeShipment({ status: ShipmentStatus.COURIER_ASSIGNED }));
      tx.shipment.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.declineShipment('user-1', 'shp-1', 'traffic')).rejects.toThrow(ConflictException);
      expect(tx.courier.update).not.toHaveBeenCalled();
    });
  });

  describe('startPickup', () => {
    it('claims the transition atomically when the shipment is COURIER_ACCEPTED', async () => {
      prisma.shipment.findUnique.mockResolvedValue(makeShipment({ status: ShipmentStatus.COURIER_ACCEPTED }));

      await service.startPickup('user-1', 'shp-1');

      expect(tx.shipment.updateMany).toHaveBeenCalledWith({
        where: { id: 'shp-1', status: ShipmentStatus.COURIER_ACCEPTED },
        data: expect.objectContaining({ status: ShipmentStatus.PICKUP_STARTED }),
      });
    });

    it('throws ConflictException when the claim loses the race', async () => {
      prisma.shipment.findUnique.mockResolvedValue(makeShipment({ status: ShipmentStatus.COURIER_ACCEPTED }));
      tx.shipment.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.startPickup('user-1', 'shp-1')).rejects.toThrow(ConflictException);
      expect(tx.shipmentEvent.create).not.toHaveBeenCalled();
    });
  });

  describe('confirmPickup', () => {
    const units = [
      { id: 'su-1', bloodUnitId: 'bu-1', bloodUnit: { locationId: 'loc-1' }, reservation: {} },
    ];

    it('claims the transition first, then updates each unit', async () => {
      prisma.shipment.findUnique.mockResolvedValue(
        makeShipment({ status: ShipmentStatus.PICKUP_STARTED, units }),
      );

      await service.confirmPickup('user-1', 'shp-1');

      expect(tx.shipment.updateMany).toHaveBeenCalledWith({
        where: { id: 'shp-1', status: ShipmentStatus.PICKUP_STARTED },
        data: expect.objectContaining({ status: ShipmentStatus.PICKED_UP }),
      });
      expect(tx.shipmentUnit.update).toHaveBeenCalledTimes(1);
      expect(tx.inventoryMovement.create).toHaveBeenCalledTimes(1);
    });

    it('throws ConflictException and never touches units when the claim loses the race', async () => {
      prisma.shipment.findUnique.mockResolvedValue(
        makeShipment({ status: ShipmentStatus.PICKUP_STARTED, units }),
      );
      tx.shipment.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.confirmPickup('user-1', 'shp-1')).rejects.toThrow(ConflictException);
      expect(tx.shipmentUnit.update).not.toHaveBeenCalled();
      expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
    });
  });

  describe('startDelivery', () => {
    it('claims the transition atomically when the shipment is PICKED_UP', async () => {
      prisma.shipment.findUnique.mockResolvedValue(makeShipment({ status: ShipmentStatus.PICKED_UP }));

      await service.startDelivery('user-1', 'shp-1');

      expect(tx.shipment.updateMany).toHaveBeenCalledWith({
        where: { id: 'shp-1', status: ShipmentStatus.PICKED_UP },
        data: expect.objectContaining({ status: ShipmentStatus.IN_TRANSIT }),
      });
    });

    it('throws ConflictException when the claim loses the race', async () => {
      prisma.shipment.findUnique.mockResolvedValue(makeShipment({ status: ShipmentStatus.PICKED_UP }));
      tx.shipment.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.startDelivery('user-1', 'shp-1')).rejects.toThrow(ConflictException);
      expect(tx.shipmentEvent.create).not.toHaveBeenCalled();
    });
  });

  describe('arriveAtHospital', () => {
    it('claims the transition atomically when the shipment is IN_TRANSIT', async () => {
      prisma.shipment.findUnique.mockResolvedValue(makeShipment({ status: ShipmentStatus.IN_TRANSIT }));

      await service.arriveAtHospital('user-1', 'shp-1');

      expect(tx.shipment.updateMany).toHaveBeenCalledWith({
        where: { id: 'shp-1', status: ShipmentStatus.IN_TRANSIT },
        data: expect.objectContaining({ status: ShipmentStatus.ARRIVED_AT_HOSPITAL }),
      });
    });

    it('throws ConflictException when the claim loses the race', async () => {
      prisma.shipment.findUnique.mockResolvedValue(makeShipment({ status: ShipmentStatus.IN_TRANSIT }));
      tx.shipment.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.arriveAtHospital('user-1', 'shp-1')).rejects.toThrow(ConflictException);
      expect(tx.shipmentEvent.create).not.toHaveBeenCalled();
    });
  });

  describe('confirmDelivery', () => {
    const units = [
      { id: 'su-1', bloodUnitId: 'bu-1', reservationId: 'res-1', bloodUnit: {}, reservation: {} },
    ];

    it('claims the transition first, then fulfils each unit', async () => {
      prisma.shipment.findUnique.mockResolvedValue(
        makeShipment({ status: ShipmentStatus.ARRIVED_AT_HOSPITAL, units, courierId: 'courier-1' }),
      );

      await service.confirmDelivery('org-dest', 'hosp-user-1', 'shp-1', {});

      expect(tx.shipment.updateMany).toHaveBeenCalledWith({
        where: { id: 'shp-1', status: ShipmentStatus.ARRIVED_AT_HOSPITAL },
        data: expect.objectContaining({ status: ShipmentStatus.DELIVERED }),
      });
      expect(tx.bloodUnitReservation.update).toHaveBeenCalledTimes(1);
      expect(tx.bloodRequest.update).toHaveBeenCalled();
    });

    it('throws ConflictException and never touches units when the claim loses the race', async () => {
      prisma.shipment.findUnique.mockResolvedValue(
        makeShipment({ status: ShipmentStatus.ARRIVED_AT_HOSPITAL, units, courierId: 'courier-1' }),
      );
      tx.shipment.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.confirmDelivery('org-dest', 'hosp-user-1', 'shp-1', {})).rejects.toThrow(
        ConflictException,
      );
      expect(tx.bloodUnitReservation.update).not.toHaveBeenCalled();
      expect(tx.bloodRequest.update).not.toHaveBeenCalled();
    });
  });

  describe('failShipment', () => {
    const units = [{ id: 'su-1', bloodUnitId: 'bu-1', bloodUnit: {}, reservation: {} }];

    it('claims the transition when the shipment is in a failable state', async () => {
      prisma.shipment.findUnique.mockResolvedValue(
        makeShipment({ status: ShipmentStatus.IN_TRANSIT, units }),
      );

      await service.failShipment('user-1', 'shp-1', { reason: 'ACCIDENT' as any });

      expect(tx.shipment.updateMany).toHaveBeenCalledWith({
        where: { id: 'shp-1', status: { in: expect.arrayContaining([ShipmentStatus.IN_TRANSIT]) } },
        data: expect.objectContaining({ status: ShipmentStatus.FAILED }),
      });
      expect(tx.shipmentUnit.update).toHaveBeenCalledTimes(1);
    });

    it('throws ConflictException and never touches units when the claim loses the race', async () => {
      prisma.shipment.findUnique.mockResolvedValue(
        makeShipment({ status: ShipmentStatus.IN_TRANSIT, units }),
      );
      tx.shipment.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.failShipment('user-1', 'shp-1', { reason: 'ACCIDENT' as any }),
      ).rejects.toThrow(ConflictException);
      expect(tx.shipmentUnit.update).not.toHaveBeenCalled();
    });
  });

  describe('cancelShipment', () => {
    const units = [{ id: 'su-1' }];

    it('claims the transition when the shipment is not already delivered or cancelled', async () => {
      prisma.shipment.findUnique.mockResolvedValue(
        makeShipment({ status: ShipmentStatus.COURIER_ASSIGNED, units }),
      );

      await service.cancelShipment('org-source', 'bc-user-1', 'shp-1', 'no longer needed');

      expect(tx.shipment.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'shp-1',
          status: { notIn: [ShipmentStatus.DELIVERED, ShipmentStatus.CANCELLED] },
        },
        data: expect.objectContaining({ status: ShipmentStatus.CANCELLED }),
      });
      expect(tx.shipmentUnit.update).toHaveBeenCalledTimes(1);
    });

    it('throws ConflictException and never touches units when the claim loses the race', async () => {
      prisma.shipment.findUnique.mockResolvedValue(
        makeShipment({ status: ShipmentStatus.COURIER_ASSIGNED, units }),
      );
      tx.shipment.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.cancelShipment('org-source', 'bc-user-1', 'shp-1', 'no longer needed'),
      ).rejects.toThrow(ConflictException);
      expect(tx.shipmentUnit.update).not.toHaveBeenCalled();
    });
  });

  describe('confirmDeliveryFull', () => {
    const units = [
      { id: 'su-1', bloodUnitId: 'bu-1', reservationId: 'res-1', bloodUnit: {}, reservation: {} },
    ];

    it('claims the transition first, then reconciles received units', async () => {
      prisma.shipment.findUnique.mockResolvedValue(
        makeShipment({ status: ShipmentStatus.ARRIVED_AT_HOSPITAL, units, courierId: 'courier-1' }),
      );

      await service.confirmDeliveryFull('org-dest', 'hosp-user-1', 'shp-1', { unitsReceived: 1 });

      expect(tx.shipment.updateMany).toHaveBeenCalledWith({
        where: { id: 'shp-1', status: ShipmentStatus.ARRIVED_AT_HOSPITAL },
        data: expect.objectContaining({ status: ShipmentStatus.DELIVERED }),
      });
      expect(tx.bloodUnitReservation.update).toHaveBeenCalledTimes(1);
    });

    it('throws ConflictException and never touches units when the claim loses the race', async () => {
      prisma.shipment.findUnique.mockResolvedValue(
        makeShipment({ status: ShipmentStatus.ARRIVED_AT_HOSPITAL, units, courierId: 'courier-1' }),
      );
      tx.shipment.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.confirmDeliveryFull('org-dest', 'hosp-user-1', 'shp-1', { unitsReceived: 1 }),
      ).rejects.toThrow(ConflictException);
      expect(tx.bloodUnitReservation.update).not.toHaveBeenCalled();
    });
  });
});
