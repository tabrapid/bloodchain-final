import { Test, TestingModule } from '@nestjs/testing';
import { ShipmentStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { LocationService } from './location.service';

type MockPrisma = {
  courier: { findUnique: jest.Mock };
  shipment: { findUnique: jest.Mock };
  shipmentLocation: { findFirst: jest.Mock; findMany: jest.Mock; deleteMany: jest.Mock };
};

describe('LocationService', () => {
  let service: LocationService;
  let prisma: MockPrisma;

  beforeEach(async () => {
    prisma = {
      courier: { findUnique: jest.fn() },
      shipment: { findUnique: jest.fn() },
      shipmentLocation: { findFirst: jest.fn(), findMany: jest.fn(), deleteMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [LocationService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<LocationService>(LocationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateLocationUpdate', () => {
    it('rejects out-of-range latitude', async () => {
      prisma.shipmentLocation.findFirst.mockResolvedValue(null);

      const result = await service.validateLocationUpdate('c1', 's1', {
        latitude: 200,
        longitude: 0,
        timestamp: new Date(),
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.join(' ')).toMatch(/latitude/i);
    });

    it('rejects out-of-range longitude', async () => {
      prisma.shipmentLocation.findFirst.mockResolvedValue(null);

      const result = await service.validateLocationUpdate('c1', 's1', {
        latitude: 0,
        longitude: -200,
        timestamp: new Date(),
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.join(' ')).toMatch(/longitude/i);
    });

    it('accepts a plausible first-ever location with no prior history', async () => {
      prisma.shipmentLocation.findFirst.mockResolvedValue(null);

      const result = await service.validateLocationUpdate('c1', 's1', {
        latitude: 41.3,
        longitude: 69.2,
        timestamp: new Date(),
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects a physically impossible jump since the last known point', async () => {
      const now = new Date();
      prisma.shipmentLocation.findFirst.mockResolvedValue({
        latitude: '41.3',
        longitude: '69.2',
        recordedAt: new Date(now.getTime() - 60 * 1000),
      });

      // ~2900km away a minute later — impossible for any ground courier.
      const result = await service.validateLocationUpdate('c1', 's1', {
        latitude: 51.5,
        longitude: 0,
        timestamp: now,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.join(' ')).toMatch(/impossible location jump/i);
    });

    it('accepts a reasonable move since the last known point', async () => {
      const now = new Date();
      prisma.shipmentLocation.findFirst.mockResolvedValue({
        latitude: '41.3',
        longitude: '69.2',
        recordedAt: new Date(now.getTime() - 5 * 60 * 1000),
      });

      const result = await service.validateLocationUpdate('c1', 's1', {
        latitude: 41.31,
        longitude: 69.21,
        timestamp: now,
      });

      expect(result.isValid).toBe(true);
    });

    it('rejects a stale timestamp older than the retention window', async () => {
      prisma.shipmentLocation.findFirst.mockResolvedValue(null);

      const result = await service.validateLocationUpdate('c1', 's1', {
        latitude: 41.3,
        longitude: 69.2,
        timestamp: new Date(Date.now() - 25 * 60 * 60 * 1000),
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.join(' ')).toMatch(/hours old/i);
    });

    it('rejects a timestamp in the future', async () => {
      prisma.shipmentLocation.findFirst.mockResolvedValue(null);

      const result = await service.validateLocationUpdate('c1', 's1', {
        latitude: 41.3,
        longitude: 69.2,
        timestamp: new Date(Date.now() + 60 * 60 * 1000),
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.join(' ')).toMatch(/future/i);
    });

    it('warns but does not invalidate on an unreasonably high reported speed', async () => {
      prisma.shipmentLocation.findFirst.mockResolvedValue(null);

      const result = await service.validateLocationUpdate('c1', 's1', {
        latitude: 41.3,
        longitude: 69.2,
        speed: 300,
        timestamp: new Date(),
      });

      expect(result.isValid).toBe(true);
      expect(result.warnings.join(' ')).toMatch(/speed/i);
    });
  });

  describe('validateCourierShipmentAccess', () => {
    it('rejects when the courier does not exist', async () => {
      prisma.courier.findUnique.mockResolvedValue(null);

      const result = await service.validateCourierShipmentAccess('c1', 's1');

      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/courier not found/i);
    });

    it('rejects when the shipment is not assigned to this courier', async () => {
      prisma.courier.findUnique.mockResolvedValue({ id: 'c1', user: {} });
      prisma.shipment.findUnique.mockResolvedValue({ id: 's1', courierId: 'someone-else' });

      const result = await service.validateCourierShipmentAccess('c1', 's1');

      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/not assigned/i);
    });

    it('rejects when the shipment is in a non-trackable state', async () => {
      prisma.courier.findUnique.mockResolvedValue({ id: 'c1', user: {} });
      prisma.shipment.findUnique.mockResolvedValue({
        id: 's1',
        courierId: 'c1',
        status: ShipmentStatus.DELIVERED,
      });

      const result = await service.validateCourierShipmentAccess('c1', 's1');

      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/location tracking is not allowed/i);
    });

    it('accepts an in-transit shipment assigned to this courier', async () => {
      prisma.courier.findUnique.mockResolvedValue({ id: 'c1', user: {} });
      prisma.shipment.findUnique.mockResolvedValue({
        id: 's1',
        courierId: 'c1',
        status: ShipmentStatus.IN_TRANSIT,
      });

      const result = await service.validateCourierShipmentAccess('c1', 's1');

      expect(result.valid).toBe(true);
    });
  });
});
