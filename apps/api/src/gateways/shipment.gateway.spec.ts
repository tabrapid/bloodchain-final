import { RoleCode } from '@prisma/client';
import { ShipmentGateway } from './shipment.gateway';
import { LocationService } from '../modules/shipments/services/location.service';
import { socketFixture } from './socket.test-helper';

describe('ShipmentGateway live recipient authorization', () => {
  let f: ReturnType<typeof socketFixture>;
  let gateway: ShipmentGateway;
  beforeEach(() => {
    f = socketFixture();
    gateway = new ShipmentGateway(f.jwtService, f.prisma, {} as LocationService);
    f.db.shipment.findUnique.mockResolvedValue({
      id: 'shp-1',
      status: 'IN_TRANSIT',
      shipmentReference: 'REF-1',
      sourceOrganizationId: 'source-1',
      destinationOrganizationId: 'hospital-1',
      courier: { userId: 'courier' },
    });
    f.db.user.findUnique.mockResolvedValue({ memberships: [{ organizationId: 'hospital-1' }] });
  });
  afterEach(() => gateway.onModuleDestroy());
  async function join(id: string, roles: RoleCode[]) {
    const client = f.client(id, roles);
    await gateway.handleConnection(client);
    await gateway.handleJoin(client, { shipmentId: 'shp-1' });
    return client;
  }
  it('delivers shipment events only to a current authorized subscriber', async () => {
    const staff = await join('staff', [RoleCode.HOSPITAL_STAFF]);
    await gateway.emitShipmentStatusChanged('shp-1', 'IN_TRANSIT', { note: 'departed' });
    expect(staff.emit).toHaveBeenCalledWith(
      'shipment_status_changed',
      expect.objectContaining({
        shipmentId: 'shp-1',
        status: 'IN_TRANSIT',
        metadata: { note: 'departed' },
      }),
    );
    await gateway.emitEtaUpdated('shp-1', 12, 4.5);
    expect(staff.emit).toHaveBeenCalledWith(
      'eta_updated',
      expect.objectContaining({ etaMinutes: 12 }),
    );
    await gateway.emitDeliveryConfirmed('shp-1', 3, 'Receiver');
    expect(staff.emit).toHaveBeenCalledWith(
      'delivery_confirmed',
      expect.objectContaining({ receivedUnits: 3 }),
    );
    await gateway.emitShipmentUpdated('shp-1', { status: 'DELIVERED' });
    expect(staff.emit).toHaveBeenCalledWith('shipment_updated', expect.anything());
  });
  it('denies an unassigned courier after reassignment, even if already joined', async () => {
    const courier = await join('courier', [RoleCode.COURIER]);
    f.db.shipment.findUnique.mockResolvedValue({
      sourceOrganizationId: 'source-1',
      destinationOrganizationId: 'hospital-1',
      courier: { userId: 'new-courier' },
    });
    f.db.user.findUnique.mockResolvedValue({ memberships: [] });
    await gateway.emitCourierLocation('shp-1', {
      courierId: 'new-courier',
      latitude: 41,
      longitude: 69,
      recordedAt: '2026-11-06T00:00:00Z',
    });
    expect(courier.emit).not.toHaveBeenCalledWith('courier_location', expect.anything());
    expect(courier.disconnect).toHaveBeenCalled();
  });
  it('does not send after session revocation', async () => {
    const staff = await join('staff', [RoleCode.HOSPITAL_STAFF]);
    f.records.get('staff')!.revokedAt = new Date();
    await gateway.emitShipmentStatusChanged('shp-1', 'DELIVERED');
    expect(staff.emit).not.toHaveBeenCalledWith('shipment_status_changed', expect.anything());
  });
  it('blocks new location writes from revoked sessions before touching courier data', async () => {
    const courier = await join('courier', [RoleCode.COURIER]);
    f.records.get('courier')!.revokedAt = new Date();
    const result = await gateway.handleLocationUpdate(courier, {
      shipmentId: 'shp-1',
      latitude: 41,
      longitude: 69,
    });
    expect(result.success).toBe(false);
    expect(f.db.courier.findUnique).not.toHaveBeenCalled();
    expect(f.db.shipmentLocation.create).not.toHaveBeenCalled();
  });
  it('does not send after a subscriber leaves while an access query is pending', async () => {
    const staff = await join('staff', [RoleCode.HOSPITAL_STAFF]);
    let release!: (value: unknown) => void;
    f.db.shipment.findUnique.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const delivery = gateway.emitShipmentStatusChanged('shp-1', 'DELIVERED');
    await new Promise((resolve) => setImmediate(resolve));
    gateway.handleLeave(staff, { shipmentId: 'shp-1' });
    release({ sourceOrganizationId: 'source-1', destinationOrganizationId: 'hospital-1' });
    await delivery;
    expect(staff.emit).not.toHaveBeenCalledWith('shipment_status_changed', expect.anything());
  });
});
