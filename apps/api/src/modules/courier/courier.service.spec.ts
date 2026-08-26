import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CourierStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CourierService } from './courier.service';

describe('CourierService', () => {
  let service: CourierService;
  let db: any;

  beforeEach(async () => {
    db = {
      courier: { findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
      shipment: { findMany: jest.fn(), count: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [CourierService, { provide: PrismaService, useValue: db }],
    }).compile();

    service = module.get<CourierService>(CourierService);
  });

  describe('getCourierByUserId', () => {
    it('throws NotFoundException when the user has no courier profile', async () => {
      db.courier.findUnique.mockResolvedValue(null);

      await expect(service.getCourierByUserId('user-1')).rejects.toThrow(NotFoundException);
    });

    it('flattens organizationName and currentShipmentId onto the response', async () => {
      db.courier.findUnique.mockResolvedValue({
        id: 'courier-1',
        displayName: 'Aziz',
        phone: '+998901234567',
        status: CourierStatus.AVAILABLE,
        organizationId: 'org-1',
        organization: { name: 'City Blood Center' },
        shipments: [{ id: 'shipment-1' }],
        user: { id: 'user-1', firstName: 'Aziz', lastName: 'K', email: 'a@x.com' },
      });

      const result = await service.getCourierByUserId('user-1');

      expect(result.organizationName).toBe('City Blood Center');
      expect(result.currentShipmentId).toBe('shipment-1');
    });

    it('returns null currentShipmentId when there is no active shipment', async () => {
      db.courier.findUnique.mockResolvedValue({
        id: 'courier-1',
        displayName: 'Aziz',
        phone: null,
        status: CourierStatus.OFFLINE,
        organizationId: 'org-1',
        organization: { name: 'City Blood Center' },
        shipments: [],
        user: { id: 'user-1' },
      });

      const result = await service.getCourierByUserId('user-1');

      expect(result.currentShipmentId).toBeNull();
    });
  });

  describe('getCourierById', () => {
    it('throws NotFoundException when the courier does not exist', async () => {
      db.courier.findUnique.mockResolvedValue(null);

      await expect(service.getCourierById('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateCourierStatus', () => {
    it('throws NotFoundException when the user has no courier profile', async () => {
      db.courier.findUnique.mockResolvedValue(null);

      await expect(
        service.updateCourierStatus('user-1', { status: CourierStatus.OFFLINE }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects going OFFLINE while an active shipment is assigned', async () => {
      db.courier.findUnique.mockResolvedValue({ status: CourierStatus.BUSY, shipments: [{ id: 's-1' }] });

      await expect(
        service.updateCourierStatus('user-1', { status: CourierStatus.OFFLINE }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects becoming AVAILABLE from BUSY while an active shipment is assigned', async () => {
      db.courier.findUnique.mockResolvedValue({ status: CourierStatus.BUSY, shipments: [{ id: 's-1' }] });

      await expect(
        service.updateCourierStatus('user-1', { status: CourierStatus.AVAILABLE }),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows becoming AVAILABLE from BUSY once there are no active shipments', async () => {
      db.courier.findUnique.mockResolvedValue({ status: CourierStatus.BUSY, shipments: [] });
      db.courier.update.mockResolvedValue({ id: 'courier-1', status: CourierStatus.AVAILABLE });

      const result = await service.updateCourierStatus('user-1', { status: CourierStatus.AVAILABLE });

      expect(result.status).toBe(CourierStatus.AVAILABLE);
      expect(result.previousStatus).toBe(CourierStatus.BUSY);
    });

    it('allows going OFFLINE when there are no active shipments', async () => {
      db.courier.findUnique.mockResolvedValue({ status: CourierStatus.AVAILABLE, shipments: [] });
      db.courier.update.mockResolvedValue({ id: 'courier-1', status: CourierStatus.OFFLINE });

      const result = await service.updateCourierStatus('user-1', { status: CourierStatus.OFFLINE });

      expect(result.status).toBe(CourierStatus.OFFLINE);
    });
  });

  describe('updateCourierProfile', () => {
    it('throws NotFoundException when the user has no courier profile', async () => {
      db.courier.findUnique.mockResolvedValue(null);

      await expect(
        service.updateCourierProfile('user-1', { displayName: 'New name' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('updates displayName and phone', async () => {
      db.courier.findUnique.mockResolvedValue({ id: 'courier-1' });
      db.courier.update.mockResolvedValue({ id: 'courier-1', displayName: 'New name', phone: '+1' });

      const result = await service.updateCourierProfile('user-1', { displayName: 'New name', phone: '+1' } as any);

      expect(result).toEqual({ id: 'courier-1', displayName: 'New name', phone: '+1' });
    });
  });

  describe('getCourierShipments', () => {
    it('scopes to the given courierId and applies default pagination', async () => {
      db.shipment.findMany.mockResolvedValue([]);
      db.shipment.count.mockResolvedValue(0);

      await service.getCourierShipments('courier-1');

      const call = db.shipment.findMany.mock.calls[0][0];
      expect(call.where).toEqual({ courierId: 'courier-1' });
      expect(call.take).toBe(20);
      expect(call.skip).toBe(0);
    });

    it('applies an optional status filter', async () => {
      db.shipment.findMany.mockResolvedValue([]);
      db.shipment.count.mockResolvedValue(0);

      await service.getCourierShipments('courier-1', { status: 'DELIVERED' });

      const call = db.shipment.findMany.mock.calls[0][0];
      expect(call.where).toEqual({ courierId: 'courier-1', status: 'DELIVERED' });
    });
  });

  describe('getActiveShipment', () => {
    it('throws NotFoundException when the courier does not exist', async () => {
      db.courier.findUnique.mockResolvedValue(null);

      await expect(service.getActiveShipment('missing')).rejects.toThrow(NotFoundException);
    });

    it('returns null when there is no active shipment', async () => {
      db.courier.findUnique.mockResolvedValue({ shipments: [] });

      expect(await service.getActiveShipment('courier-1')).toBeNull();
    });

    it('returns the single active shipment when present', async () => {
      db.courier.findUnique.mockResolvedValue({ shipments: [{ id: 'shipment-1' }] });

      const result = await service.getActiveShipment('courier-1');

      expect(result).toEqual({ id: 'shipment-1' });
    });
  });

  describe('getCourierStats', () => {
    it('computes active as total minus every terminal status', async () => {
      db.shipment.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(5) // completed
        .mockResolvedValueOnce(1) // failed
        .mockResolvedValueOnce(1); // cancelled
      db.shipment.findMany.mockResolvedValue([]);

      const result = await service.getCourierStats('courier-1');

      expect(result.active).toBe(3);
      expect(result.avgDeliveryTimeMinutes).toBeNull();
    });

    it('computes average delivery time in minutes across completed shipments', async () => {
      db.shipment.count.mockResolvedValue(0);
      db.shipment.findMany.mockResolvedValue([
        { pickedUpAt: new Date('2026-01-01T00:00:00Z'), deliveredAt: new Date('2026-01-01T00:30:00Z') },
        { pickedUpAt: new Date('2026-01-01T00:00:00Z'), deliveredAt: new Date('2026-01-01T01:30:00Z') },
      ]);

      const result = await service.getCourierStats('courier-1');

      expect(result.avgDeliveryTimeMinutes).toBe(60);
    });

    it('applies the optional date range to the where clause', async () => {
      db.shipment.count.mockResolvedValue(0);
      db.shipment.findMany.mockResolvedValue([]);
      const start = new Date('2026-01-01');
      const end = new Date('2026-02-01');

      await service.getCourierStats('courier-1', start, end);

      const call = db.shipment.count.mock.calls[0][0];
      expect(call.where.createdAt).toEqual({ gte: start, lte: end });
    });
  });

  describe('getAvailableCouriersForOrganization', () => {
    it('only returns AVAILABLE couriers for the given organization, with active shipment counts', async () => {
      db.courier.findMany.mockResolvedValue([
        { id: 'c-1', displayName: 'Aziz', phone: null, status: CourierStatus.AVAILABLE, shipments: [{ id: 's-1' }], user: {} },
      ]);

      const result = await service.getAvailableCouriersForOrganization('org-1');

      expect(db.courier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizationId: 'org-1', status: CourierStatus.AVAILABLE } }),
      );
      expect(result[0]!.activeShipments).toBe(1);
    });
  });
});
