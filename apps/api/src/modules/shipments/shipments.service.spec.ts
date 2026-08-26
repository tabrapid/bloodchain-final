import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrganizationStatus, OrganizationType, Prisma, RoleCode, ShipmentStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { LocationService } from './services/location.service';
import { ShipmentStateMachine } from './services/shipment-state.service';
import { ShipmentsService } from './shipments.service';
import { ShipmentGateway } from '../../gateways/shipment.gateway';

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
  let shipmentGateway: { emitShipmentStatusChanged: jest.Mock; emitCourierLocation: jest.Mock };
  let locationService: { validateCourierShipmentAccess: jest.Mock; validateLocationUpdate: jest.Mock };
  let eventEmitter: { emit: jest.Mock };

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
      courier: {
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      bloodRequest: { update: jest.fn().mockResolvedValue({}) },
      bloodRequestEvent: { create: jest.fn().mockResolvedValue({}) },
    };

    prisma = {
      shipment: { findUnique: jest.fn() },
      user: { findMany: jest.fn().mockResolvedValue([]) },
      courier: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn().mockImplementation(async (cb: any) => cb(tx)),
    };

    shipmentGateway = {
      emitShipmentStatusChanged: jest.fn(),
      emitCourierLocation: jest.fn(),
    };
    locationService = {
      validateCourierShipmentAccess: jest.fn().mockResolvedValue({ valid: true }),
      validateLocationUpdate: jest.fn().mockResolvedValue({ isValid: true, errors: [], warnings: [] }),
    };
    eventEmitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShipmentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogsService, useValue: { log: jest.fn().mockResolvedValue({}) } },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: LocationService, useValue: locationService },
        { provide: ShipmentGateway, useValue: shipmentGateway },
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
        where: {
          id: 'shp-1',
          status: { in: ShipmentStateMachine.getSourceStatuses(ShipmentStatus.COURIER_ACCEPTED) },
        },
        data: expect.objectContaining({ status: ShipmentStatus.COURIER_ACCEPTED }),
      });
      expect(tx.shipmentEvent.create).toHaveBeenCalled();
      expect(shipmentGateway.emitShipmentStatusChanged).toHaveBeenCalledWith(
        'shp-1',
        ShipmentStatus.COURIER_ACCEPTED,
      );
    });

    it('throws ConflictException and skips side effects when the claim loses the race', async () => {
      prisma.shipment.findUnique.mockResolvedValue(makeShipment({ status: ShipmentStatus.COURIER_ASSIGNED }));
      tx.shipment.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.acceptShipment('user-1', 'shp-1')).rejects.toThrow(ConflictException);
      expect(tx.shipmentEvent.create).not.toHaveBeenCalled();
      expect(shipmentGateway.emitShipmentStatusChanged).not.toHaveBeenCalled();
    });
  });

  describe('declineShipment', () => {
    it('claims the transition atomically when the shipment is COURIER_ASSIGNED', async () => {
      prisma.shipment.findUnique.mockResolvedValue(makeShipment({ status: ShipmentStatus.COURIER_ASSIGNED }));

      await service.declineShipment('user-1', 'shp-1', 'traffic');

      expect(tx.shipment.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'shp-1',
          status: { in: ShipmentStateMachine.getSourceStatuses(ShipmentStatus.COURIER_DECLINED) },
        },
        data: expect.objectContaining({ status: ShipmentStatus.COURIER_DECLINED, courierId: null }),
      });
      expect(tx.courier.update).toHaveBeenCalled();
      expect(shipmentGateway.emitShipmentStatusChanged).toHaveBeenCalledWith(
        'shp-1',
        ShipmentStatus.COURIER_DECLINED,
        { reason: 'traffic' },
      );
    });

    it('throws ConflictException and skips side effects when the claim loses the race', async () => {
      prisma.shipment.findUnique.mockResolvedValue(makeShipment({ status: ShipmentStatus.COURIER_ASSIGNED }));
      tx.shipment.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.declineShipment('user-1', 'shp-1', 'traffic')).rejects.toThrow(ConflictException);
      expect(tx.courier.update).not.toHaveBeenCalled();
      expect(shipmentGateway.emitShipmentStatusChanged).not.toHaveBeenCalled();
    });

    it('notifies the blood center that the courier declined, unlike every other transition this used to skip', async () => {
      prisma.shipment.findUnique.mockResolvedValue(makeShipment({ status: ShipmentStatus.COURIER_ASSIGNED }));
      prisma.user.findMany.mockResolvedValue([{ id: 'bc-staff-1' }, { id: 'bc-staff-2' }]);

      await service.declineShipment('user-1', 'shp-1', 'traffic');

      expect(eventEmitter.emit).toHaveBeenCalledWith('shipment.event', {
        shipmentId: 'shp-1',
        eventType: 'declined',
        recipientIds: ['bc-staff-1', 'bc-staff-2'],
      });
    });
  });

  describe('startPickup', () => {
    it('claims the transition atomically when the shipment is COURIER_ACCEPTED', async () => {
      prisma.shipment.findUnique.mockResolvedValue(makeShipment({ status: ShipmentStatus.COURIER_ACCEPTED }));

      await service.startPickup('user-1', 'shp-1');

      expect(tx.shipment.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'shp-1',
          status: { in: ShipmentStateMachine.getSourceStatuses(ShipmentStatus.PICKUP_STARTED) },
        },
        data: expect.objectContaining({ status: ShipmentStatus.PICKUP_STARTED }),
      });
      expect(shipmentGateway.emitShipmentStatusChanged).toHaveBeenCalledWith(
        'shp-1',
        ShipmentStatus.PICKUP_STARTED,
      );
    });

    it('throws ConflictException when the claim loses the race', async () => {
      prisma.shipment.findUnique.mockResolvedValue(makeShipment({ status: ShipmentStatus.COURIER_ACCEPTED }));
      tx.shipment.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.startPickup('user-1', 'shp-1')).rejects.toThrow(ConflictException);
      expect(tx.shipmentEvent.create).not.toHaveBeenCalled();
      expect(shipmentGateway.emitShipmentStatusChanged).not.toHaveBeenCalled();
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
        where: {
          id: 'shp-1',
          status: { in: ShipmentStateMachine.getSourceStatuses(ShipmentStatus.PICKED_UP) },
        },
        data: expect.objectContaining({ status: ShipmentStatus.PICKED_UP }),
      });
      expect(tx.shipmentUnit.update).toHaveBeenCalledTimes(1);
      expect(tx.inventoryMovement.create).toHaveBeenCalledTimes(1);
      expect(shipmentGateway.emitShipmentStatusChanged).toHaveBeenCalledWith('shp-1', ShipmentStatus.PICKED_UP);
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
        where: {
          id: 'shp-1',
          status: { in: ShipmentStateMachine.getSourceStatuses(ShipmentStatus.IN_TRANSIT) },
        },
        data: expect.objectContaining({ status: ShipmentStatus.IN_TRANSIT }),
      });
      expect(shipmentGateway.emitShipmentStatusChanged).toHaveBeenCalledWith('shp-1', ShipmentStatus.IN_TRANSIT);
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
        where: {
          id: 'shp-1',
          status: { in: ShipmentStateMachine.getSourceStatuses(ShipmentStatus.ARRIVED_AT_HOSPITAL) },
        },
        data: expect.objectContaining({ status: ShipmentStatus.ARRIVED_AT_HOSPITAL }),
      });
      expect(shipmentGateway.emitShipmentStatusChanged).toHaveBeenCalledWith(
        'shp-1',
        ShipmentStatus.ARRIVED_AT_HOSPITAL,
      );
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
        where: {
          id: 'shp-1',
          status: { in: ShipmentStateMachine.getSourceStatuses(ShipmentStatus.DELIVERED) },
        },
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
        where: {
          id: 'shp-1',
          status: { in: ShipmentStateMachine.getSourceStatuses(ShipmentStatus.FAILED) },
        },
        data: expect.objectContaining({ status: ShipmentStatus.FAILED }),
      });
      expect(tx.shipmentUnit.update).toHaveBeenCalledTimes(1);
      expect(shipmentGateway.emitShipmentStatusChanged).toHaveBeenCalledWith('shp-1', ShipmentStatus.FAILED);
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
          status: { in: ShipmentStateMachine.getSourceStatuses(ShipmentStatus.CANCELLED) },
        },
        data: expect.objectContaining({ status: ShipmentStatus.CANCELLED }),
      });
      expect(tx.shipmentUnit.update).toHaveBeenCalledTimes(1);
      expect(shipmentGateway.emitShipmentStatusChanged).toHaveBeenCalledWith(
        'shp-1',
        ShipmentStatus.CANCELLED,
        { reason: 'no longer needed' },
      );
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
        where: {
          id: 'shp-1',
          status: { in: ShipmentStateMachine.getSourceStatuses(ShipmentStatus.DELIVERED) },
        },
        data: expect.objectContaining({ status: ShipmentStatus.DELIVERED }),
      });
      expect(tx.bloodUnitReservation.update).toHaveBeenCalledTimes(1);
      expect(shipmentGateway.emitShipmentStatusChanged).toHaveBeenCalledWith(
        'shp-1',
        ShipmentStatus.DELIVERED,
        expect.objectContaining({ unitsDelivered: 1 }),
      );
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
      expect(shipmentGateway.emitShipmentStatusChanged).not.toHaveBeenCalled();
    });
  });

  describe('assignCourier', () => {
    const newCourier = {
      id: 'courier-2',
      userId: 'user-2',
      organizationId: 'org-source',
      status: 'AVAILABLE',
      displayName: 'Jane Courier',
    };

    it('claims both the shipment and the courier atomically when both are available', async () => {
      prisma.shipment.findUnique.mockResolvedValue(makeShipment({ status: 'CREATED', courierId: null }));
      prisma.courier.findUnique.mockResolvedValue(newCourier);

      await service.assignCourier('org-source', 'bc-user-1', 'shp-1', 'courier-2');

      expect(tx.shipment.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'shp-1',
          status: { in: ShipmentStateMachine.getSourceStatuses(ShipmentStatus.COURIER_ASSIGNED) },
        },
        data: expect.objectContaining({ courierId: 'courier-2', status: ShipmentStatus.COURIER_ASSIGNED }),
      });
      expect(tx.courier.updateMany).toHaveBeenCalledWith({
        where: { id: 'courier-2', status: 'AVAILABLE' },
        data: { status: 'BUSY' },
      });
      expect(shipmentGateway.emitShipmentStatusChanged).toHaveBeenCalledWith(
        'shp-1',
        ShipmentStatus.COURIER_ASSIGNED,
      );
    });

    it('throws ConflictException and skips the courier claim when the shipment claim loses the race', async () => {
      prisma.shipment.findUnique.mockResolvedValue(makeShipment({ status: 'CREATED', courierId: null }));
      prisma.courier.findUnique.mockResolvedValue(newCourier);
      tx.shipment.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.assignCourier('org-source', 'bc-user-1', 'shp-1', 'courier-2'),
      ).rejects.toThrow(ConflictException);
      expect(tx.courier.updateMany).not.toHaveBeenCalled();
      expect(shipmentGateway.emitShipmentStatusChanged).not.toHaveBeenCalled();
    });

    it('throws ConflictException and rolls back when the courier claim loses the race', async () => {
      prisma.shipment.findUnique.mockResolvedValue(makeShipment({ status: 'CREATED', courierId: null }));
      prisma.courier.findUnique.mockResolvedValue(newCourier);
      tx.courier.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.assignCourier('org-source', 'bc-user-1', 'shp-1', 'courier-2'),
      ).rejects.toThrow(ConflictException);
      expect(tx.shipmentEvent.create).not.toHaveBeenCalled();
      expect(shipmentGateway.emitShipmentStatusChanged).not.toHaveBeenCalled();
    });
  });

  describe('reassignCourier', () => {
    const newCourier = {
      id: 'courier-2',
      userId: 'user-2',
      organizationId: 'org-source',
      status: 'AVAILABLE',
      displayName: 'Jane Courier',
    };

    it('claims both the shipment and the new courier atomically, then frees the old courier', async () => {
      prisma.shipment.findUnique.mockResolvedValue(
        makeShipment({ status: ShipmentStatus.FAILED, courierId: 'courier-1' }),
      );
      prisma.courier.findUnique.mockResolvedValue(newCourier);

      await service.reassignCourier('org-source', 'bc-user-1', 'shp-1', 'courier-2');

      expect(tx.shipment.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'shp-1',
          status: { in: ShipmentStateMachine.getSourceStatuses(ShipmentStatus.COURIER_ASSIGNED) },
        },
        data: expect.objectContaining({ courierId: 'courier-2', status: ShipmentStatus.COURIER_ASSIGNED }),
      });
      expect(tx.courier.updateMany).toHaveBeenCalledWith({
        where: { id: 'courier-2', status: 'AVAILABLE' },
        data: { status: 'BUSY' },
      });
      expect(tx.courier.update).toHaveBeenCalledWith({
        where: { id: 'courier-1' },
        data: { status: 'AVAILABLE' },
      });
      expect(shipmentGateway.emitShipmentStatusChanged).toHaveBeenCalledWith(
        'shp-1',
        ShipmentStatus.COURIER_ASSIGNED,
        { courierId: 'courier-2' },
      );
    });

    it('throws ConflictException and never frees the old courier when the shipment claim loses the race', async () => {
      prisma.shipment.findUnique.mockResolvedValue(
        makeShipment({ status: ShipmentStatus.FAILED, courierId: 'courier-1' }),
      );
      prisma.courier.findUnique.mockResolvedValue(newCourier);
      tx.shipment.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.reassignCourier('org-source', 'bc-user-1', 'shp-1', 'courier-2'),
      ).rejects.toThrow(ConflictException);
      expect(tx.courier.update).not.toHaveBeenCalled();
      expect(tx.courier.updateMany).not.toHaveBeenCalled();
      expect(shipmentGateway.emitShipmentStatusChanged).not.toHaveBeenCalled();
    });
  });

  describe('getCourierRoster', () => {
    it('returns every courier for the org regardless of status', async () => {
      prisma.courier.findMany = jest.fn().mockResolvedValue([
        {
          id: 'courier-1',
          displayName: 'Alice',
          phone: '+1000',
          status: 'AVAILABLE',
          createdAt: new Date('2026-01-01'),
          user: { email: 'alice@example.com' },
          shipments: [{ id: 'shp-1' }],
          _count: { shipments: 4 },
        },
        {
          id: 'courier-2',
          displayName: 'Bob',
          phone: '+2000',
          status: 'OFFLINE',
          createdAt: new Date('2026-01-02'),
          user: { email: 'bob@example.com' },
          shipments: [],
          _count: { shipments: 0 },
        },
      ]);

      const result = await service.getCourierRoster('org-source', 'bc-user-1');

      expect(prisma.courier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizationId: 'org-source' } }),
      );
      expect(result.data).toEqual([
        expect.objectContaining({ id: 'courier-1', status: 'AVAILABLE', activeShipments: 1, completedShipments: 4 }),
        expect.objectContaining({ id: 'courier-2', status: 'OFFLINE', activeShipments: 0, completedShipments: 0 }),
      ]);
    });
  });

  describe('updateLocation', () => {
    // Mirrors the REST location-update path the mobile courier app actually
    // uses (as opposed to the gateway's own `location_update` socket event)
    // - without broadcasting here, live-tracking web clients would never
    // see a courier's position move.
    it('broadcasts the new position to the shipment room via the gateway', async () => {
      const recordedAt = new Date('2026-01-01T00:00:00.000Z');
      prisma.shipmentLocation = {
        create: jest.fn().mockResolvedValue({
          latitude: 40.7128,
          longitude: -74.006,
          accuracy: 5,
          heading: null,
          speed: null,
          recordedAt,
        }),
      };
      prisma.shipmentEvent = { create: jest.fn().mockResolvedValue({}) };

      await service.updateLocation('user-1', 'shp-1', { latitude: 40.7128, longitude: -74.006, accuracy: 5 });

      expect(shipmentGateway.emitCourierLocation).toHaveBeenCalledWith('shp-1', {
        courierId: 'courier-1',
        latitude: 40.7128,
        longitude: -74.006,
        accuracy: 5,
        heading: null,
        speed: null,
        recordedAt: recordedAt.toISOString(),
      });
    });
  });
});

describe('ShipmentsService organization-status access checks', () => {
  let service: ShipmentsService;
  let prisma: any;

  const makeMembership = (organizationId: string, roleCode: string) => ({
    organizationId,
    status: 'ACTIVE',
    role: { code: roleCode },
  });

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn() },
      organization: { findUnique: jest.fn() },
      courier: { findUnique: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShipmentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogsService, useValue: { log: jest.fn().mockResolvedValue({}) } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: LocationService, useValue: {} },
        { provide: ShipmentGateway, useValue: {} },
      ],
    }).compile();

    service = module.get<ShipmentsService>(ShipmentsService);
  });

  describe('checkHospitalAccess', () => {
    it('allows a hospital staff member when the hospital is ACTIVE', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        memberships: [makeMembership('hosp-1', RoleCode.HOSPITAL_ADMIN)],
      });
      prisma.organization.findUnique.mockResolvedValue({
        id: 'hosp-1',
        type: OrganizationType.HOSPITAL,
        status: OrganizationStatus.ACTIVE,
      });

      await expect(service.checkHospitalAccess('user-1', 'hosp-1')).resolves.toBeDefined();
    });

    it.each([OrganizationStatus.PENDING_APPROVAL, OrganizationStatus.SUSPENDED, OrganizationStatus.DEACTIVATED])(
      'rejects a hospital staff member when the hospital is %s',
      async (status) => {
        prisma.user.findUnique.mockResolvedValue({
          id: 'user-1',
          memberships: [makeMembership('hosp-1', RoleCode.HOSPITAL_ADMIN)],
        });
        prisma.organization.findUnique.mockResolvedValue({ id: 'hosp-1', type: OrganizationType.HOSPITAL, status });

        await expect(service.checkHospitalAccess('user-1', 'hosp-1')).rejects.toThrow(ForbiddenException);
      },
    );
  });

  describe('checkBloodCenterAccess', () => {
    it('allows blood center staff when the blood center is ACTIVE', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        memberships: [makeMembership('bc-1', RoleCode.BLOOD_CENTER_STAFF)],
      });
      prisma.organization.findUnique.mockResolvedValue({
        id: 'bc-1',
        type: OrganizationType.BLOOD_CENTER,
        status: OrganizationStatus.ACTIVE,
      });

      await expect(service.checkBloodCenterAccess('user-1', 'bc-1')).resolves.toBeDefined();
    });

    it('rejects blood center staff when the blood center is SUSPENDED', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        memberships: [makeMembership('bc-1', RoleCode.BLOOD_CENTER_STAFF)],
      });
      prisma.organization.findUnique.mockResolvedValue({
        id: 'bc-1',
        type: OrganizationType.BLOOD_CENTER,
        status: OrganizationStatus.SUSPENDED,
      });

      await expect(service.checkBloodCenterAccess('user-1', 'bc-1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('checkCourierAccess', () => {
    it('allows a courier whose organization is ACTIVE', async () => {
      prisma.courier.findUnique.mockResolvedValue({
        id: 'courier-1',
        userId: 'user-1',
        organization: { id: 'bc-1', status: OrganizationStatus.ACTIVE },
      });

      await expect(service.checkCourierAccess('user-1')).resolves.toBeDefined();
    });

    it('rejects a courier whose organization is no longer ACTIVE', async () => {
      prisma.courier.findUnique.mockResolvedValue({
        id: 'courier-1',
        userId: 'user-1',
        organization: { id: 'bc-1', status: OrganizationStatus.SUSPENDED },
      });

      await expect(service.checkCourierAccess('user-1')).rejects.toThrow(ForbiddenException);
    });
  });
});

describe('ShipmentsService.getShipmentTracking', () => {
  let service: ShipmentsService;
  let prisma: any;

  function makeTrackedShipment(overrides: Record<string, any> = {}) {
    return {
      id: 'shp-1',
      shipmentReference: 'SHP-2026-000001',
      status: 'IN_TRANSIT',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      sourceOrganizationId: 'org-source',
      destinationOrganizationId: 'org-dest',
      pickupLatitude: '40.7128',
      pickupLongitude: '-74.006',
      destinationLatitude: '40.73',
      destinationLongitude: '-74.0',
      bloodRequest: { id: 'req-1', requestReference: 'REQ-2026-000001', priority: 'ROUTINE' },
      sourceOrganization: { id: 'org-source', name: 'Blood Center', address: '1 Main St' },
      destinationOrganization: { id: 'org-dest', name: 'Hospital', address: '2 Main St' },
      courier: { id: 'courier-1', displayName: 'Jane Courier', phone: '+1555' },
      units: [],
      ...overrides,
    };
  }

  beforeEach(async () => {
    prisma = {
      shipment: { findUnique: jest.fn() },
      courier: { findUnique: jest.fn().mockResolvedValue(null) },
      user: { findUnique: jest.fn().mockResolvedValue({ memberships: [{ organizationId: 'org-source' }] }) },
      shipmentLocation: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
      shipmentEvent: { findFirst: jest.fn().mockResolvedValue(null) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShipmentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogsService, useValue: { log: jest.fn().mockResolvedValue({}) } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: LocationService, useValue: {} },
        { provide: ShipmentGateway, useValue: {} },
      ],
    }).compile();

    service = module.get<ShipmentsService>(ShipmentsService);
  });

  it('summarizes the real blood types actually loaded on the shipment', async () => {
    prisma.shipment.findUnique.mockResolvedValue(
      makeTrackedShipment({
        units: [
          { id: 'su-1', bloodUnit: { bloodType: 'O', rhFactor: 'POSITIVE' } },
          { id: 'su-2', bloodUnit: { bloodType: 'O', rhFactor: 'POSITIVE' } },
          { id: 'su-3', bloodUnit: { bloodType: 'A', rhFactor: 'NEGATIVE' } },
        ],
      }),
    );

    const result = await service.getShipmentTracking('shp-1', 'user-1');

    expect(result.bloodGroup).toBe('2 O+, 1 A-');
    expect(result.bloodGroup).not.toBe('Available after delivery confirmation');
  });

  it('reports no units assigned yet instead of the old hardcoded placeholder', async () => {
    prisma.shipment.findUnique.mockResolvedValue(makeTrackedShipment({ units: [] }));

    const result = await service.getShipmentTracking('shp-1', 'user-1');

    expect(result.bloodGroup).toBe('No units assigned yet');
  });

  it("uses the courier's own recent average speed for the ETA when available", async () => {
    prisma.shipment.findUnique.mockResolvedValue(makeTrackedShipment());
    prisma.shipmentLocation.findFirst.mockResolvedValue({
      latitude: '40.72',
      longitude: '-74.01',
      recordedAt: new Date(),
    });
    prisma.shipmentLocation.findMany.mockResolvedValue([
      { speed: '60' },
      { speed: '80' },
    ]);

    const result = await service.getShipmentTracking('shp-1', 'user-1');

    // Average speed of 70 km/h (of the two samples), not the old flat 40 km/h assumption.
    expect(result.eta!.note).toContain("courier's own recent average speed");
    expect(result.eta!.etaMinutes).toBe(1);
  });

  it('falls back to the default speed assumption when there is no usable recent speed data', async () => {
    prisma.shipment.findUnique.mockResolvedValue(makeTrackedShipment());
    prisma.shipmentLocation.findFirst.mockResolvedValue({
      latitude: '40.72',
      longitude: '-74.01',
      recordedAt: new Date(),
    });
    prisma.shipmentLocation.findMany.mockResolvedValue([]);

    const result = await service.getShipmentTracking('shp-1', 'user-1');

    expect(result.eta!.note).toContain('a default average speed');
    expect(result.eta!.etaMinutes).toBe(2);
  });
});

function uniqueConstraintError(field: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { target: [field] },
  });
}

describe('ShipmentsService reference-number collision retry', () => {
  let service: ShipmentsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          memberships: [{ organizationId: 'org-1', status: 'ACTIVE', role: { code: RoleCode.HOSPITAL_ADMIN } }],
        }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      organization: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'org-1',
          type: OrganizationType.HOSPITAL,
          status: OrganizationStatus.ACTIVE,
        }),
      },
      bloodRequest: { findUnique: jest.fn() },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShipmentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogsService, useValue: { log: jest.fn().mockResolvedValue({}) } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: LocationService, useValue: {} },
        { provide: ShipmentGateway, useValue: { emitShipmentStatusChanged: jest.fn() } },
      ],
    }).compile();

    service = module.get<ShipmentsService>(ShipmentsService);
  });

  it('retries createRequest on a requestReference collision and succeeds with a fresh reference', async () => {
    const tx = {
      bloodRequest: { create: jest.fn().mockResolvedValue({ id: 'req-1', requestReference: 'REQ-2026-000002' }) },
      bloodRequestItem: { create: jest.fn().mockResolvedValue({}) },
      bloodRequestEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    prisma.$transaction
      .mockImplementationOnce(async () => {
        throw uniqueConstraintError('requestReference');
      })
      .mockImplementationOnce(async (cb: any) => cb(tx));

    const result = await service.createRequest('org-1', 'user-1', {
      items: [{ bloodType: 'O', rhFactor: 'POSITIVE', unitsRequested: 2 }],
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(result.id).toBe('req-1');
  });

  it('retries createShipment on a shipmentReference collision and succeeds with a fresh reference', async () => {
    prisma.organization.findUnique.mockImplementation(async ({ where: { id } }: any) =>
      id === 'org-1'
        ? { id: 'org-1', type: OrganizationType.BLOOD_CENTER, status: OrganizationStatus.ACTIVE }
        : { id: 'org-dest', name: 'Dest Hospital', address: '1 Main St', latitude: null, longitude: null },
    );
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      memberships: [{ organizationId: 'org-1', status: 'ACTIVE', role: { code: RoleCode.BLOOD_CENTER_ADMIN } }],
    });
    prisma.bloodRequest.findUnique.mockResolvedValue({
      id: 'req-1',
      status: 'READY_FOR_PICKUP',
      shipment: null,
      fulfillingOrganizationId: 'org-1',
      requestingOrganizationId: 'org-dest',
      deliveryAddress: null,
      deliveryLatitude: null,
      deliveryLongitude: null,
      items: [],
    });
    const tx = {
      shipment: { create: jest.fn().mockResolvedValue({ id: 'shp-1', shipmentReference: 'SHP-2026-000002' }) },
      shipmentUnit: { create: jest.fn().mockResolvedValue({}) },
      shipmentEvent: { create: jest.fn().mockResolvedValue({}) },
      bloodRequestEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    prisma.$transaction
      .mockImplementationOnce(async () => {
        throw uniqueConstraintError('shipmentReference');
      })
      .mockImplementationOnce(async (cb: any) => cb(tx));

    const result = await service.createShipment('org-1', 'user-1', 'req-1', {});

    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(result.id).toBe('shp-1');
  });
});
