import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../database/prisma.service';
import { LocationService } from '../modules/shipments/services/location.service';
import { ShipmentGateway } from './shipment.gateway';

describe('ShipmentGateway broadcasts', () => {
  let gateway: ShipmentGateway;
  let serverEmit: jest.Mock;
  let serverTo: jest.Mock;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShipmentGateway,
        { provide: PrismaService, useValue: {} },
        { provide: JwtService, useValue: { verify: jest.fn() } },
        { provide: LocationService, useValue: {} },
      ],
    }).compile();

    gateway = module.get<ShipmentGateway>(ShipmentGateway);

    serverEmit = jest.fn();
    serverTo = jest.fn().mockReturnValue({ emit: serverEmit });
    (gateway as any).server = { to: serverTo };
  });

  it('emitShipmentStatusChanged targets the shipment room with status and metadata', () => {
    gateway.emitShipmentStatusChanged('shp-1', 'IN_TRANSIT', { note: 'left the depot' });

    expect(serverTo).toHaveBeenCalledWith('shipment:shp-1');
    expect(serverEmit).toHaveBeenCalledWith('shipment_status_changed', {
      shipmentId: 'shp-1',
      status: 'IN_TRANSIT',
      metadata: { note: 'left the depot' },
      timestamp: expect.any(String),
    });
  });

  it('emitCourierLocation targets the shipment room with the courier position', () => {
    gateway.emitCourierLocation('shp-1', {
      courierId: 'courier-1',
      latitude: 40.7128,
      longitude: -74.006,
      accuracy: 5,
      heading: null,
      speed: null,
      recordedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(serverTo).toHaveBeenCalledWith('shipment:shp-1');
    expect(serverEmit).toHaveBeenCalledWith('courier_location', {
      shipmentId: 'shp-1',
      courierId: 'courier-1',
      latitude: 40.7128,
      longitude: -74.006,
      accuracy: 5,
      heading: null,
      speed: null,
      recordedAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('emitEtaUpdated targets the shipment room with eta and distance', () => {
    gateway.emitEtaUpdated('shp-1', 12, 4.5);

    expect(serverTo).toHaveBeenCalledWith('shipment:shp-1');
    expect(serverEmit).toHaveBeenCalledWith('eta_updated', {
      shipmentId: 'shp-1',
      etaMinutes: 12,
      distanceKm: 4.5,
      timestamp: expect.any(String),
    });
  });

  it('emitDeliveryConfirmed targets the shipment room with delivery details', () => {
    gateway.emitDeliveryConfirmed('shp-1', 3, 'Dr. Smith', 'all good');

    expect(serverTo).toHaveBeenCalledWith('shipment:shp-1');
    expect(serverEmit).toHaveBeenCalledWith('delivery_confirmed', {
      shipmentId: 'shp-1',
      receivedUnits: 3,
      receiverName: 'Dr. Smith',
      notes: 'all good',
      timestamp: expect.any(String),
    });
  });
});
