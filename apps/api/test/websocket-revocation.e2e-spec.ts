import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { io, Socket } from 'socket.io-client';
import { PrismaService } from '../src/database/prisma.service';
import { EmergencyGateway } from '../src/gateways/emergency.gateway';
import { ShipmentGateway } from '../src/gateways/shipment.gateway';
import { createTestApp, createTestDonor, seededOrganizations, TestDonor } from './utils/e2e';

function event(socket: Socket, name: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(name, done);
      reject(new Error(`Missing socket event: ${name}`));
    }, 5000);
    const done = (data: unknown) => {
      clearTimeout(timer);
      resolve(data);
    };
    socket.once(name, done);
  });
}

describe('real WebSocket session revocation', () => {
  let app: INestApplication;
  let db: PrismaService;
  let origin: string;
  let donor: TestDonor;
  let emergencyId: string;
  let shipmentId: string;
  let requestId: string;
  const sockets: Socket[] = [];
  const position = {
    responseId: 'synthetic-response',
    donorId: 'synthetic-donor',
    latitude: 41,
    longitude: 69,
    recordedAt: '2026-11-06T00:00:00Z',
  };
  const sid = () => app.get(JwtService).decode(donor.token).sid as string;
  function connect(namespace: string) {
    const socket = io(`${origin}/${namespace}`, {
      auth: { token: donor.token },
      transports: ['websocket'],
      reconnection: false,
      autoConnect: false,
    });
    sockets.push(socket);
    return socket;
  }
  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(PrismaService);
    await app.listen(0, '127.0.0.1');
    origin = await app.getUrl();
  });
  beforeEach(async () => {
    const { hospital, bloodCenter } = await seededOrganizations(app);
    donor = await createTestDonor(app, { label: 'ws-revocation', organizationId: hospital.id });
    const role = await db.role.findUniqueOrThrow({ where: { code: 'HOSPITAL_STAFF' } });
    await db.organizationMembership.updateMany({
      where: { userId: donor.id },
      data: { roleId: role.id },
    });
    const reference = `WS-${donor.id}`;
    emergencyId = (
      await db.emergencyRequest.create({
        data: {
          emergencyReference: reference,
          hospitalId: hospital.id,
          createdBy: donor.id,
          bloodType: 'O',
          rhFactor: 'POSITIVE',
          unitsRequired: 1,
        },
      })
    ).id;
    requestId = (
      await db.bloodRequest.create({
        data: { requestReference: reference, requestingOrganizationId: hospital.id },
      })
    ).id;
    shipmentId = (
      await db.shipment.create({
        data: {
          shipmentReference: reference,
          bloodRequestId: requestId,
          sourceOrganizationId: bloodCenter.id,
          destinationOrganizationId: hospital.id,
        },
      })
    ).id;
  });
  afterEach(async () => {
    for (const socket of sockets.splice(0)) socket.disconnect();
    if (requestId) await db.bloodRequest.deleteMany({ where: { id: requestId } });
    if (donor) await donor.cleanup();
  });
  afterAll(async () => {
    await app.close();
  });

  it('stops location delivery to a revoked, already joined emergency socket', async () => {
    const socket = connect('emergency');
    const accepted = event(socket, 'connected');
    socket.connect();
    await accepted;
    expect(
      await socket.timeout(5000).emitWithAck('join', { emergencyRequestId: emergencyId }),
    ).toMatchObject({ success: true });
    const first = event(socket, 'donor_location');
    await app.get(EmergencyGateway).emitDonorLocationUpdate(emergencyId, position);
    await first;
    const received = jest.fn();
    socket.on('donor_location', received);
    await db.session.update({ where: { id: sid() }, data: { revokedAt: new Date() } });
    const disconnected = event(socket, 'disconnect');
    await app.get(EmergencyGateway).emitDonorLocationUpdate(emergencyId, position);
    await disconnected;
    expect(received).not.toHaveBeenCalled();
    expect(socket.connected).toBe(false);
  });
  it('stops shipment delivery after the staff membership is removed', async () => {
    const socket = connect('shipments');
    const accepted = event(socket, 'connected');
    socket.connect();
    await accepted;
    expect(await socket.timeout(5000).emitWithAck('join', { shipmentId })).toMatchObject({
      success: true,
    });
    const first = event(socket, 'shipment_status_changed');
    await app.get(ShipmentGateway).emitShipmentStatusChanged(shipmentId, 'IN_TRANSIT');
    await first;
    const received = jest.fn();
    socket.on('shipment_status_changed', received);
    await db.organizationMembership.updateMany({
      where: { userId: donor.id },
      data: { status: 'INACTIVE' },
    });
    const disconnected = event(socket, 'disconnect');
    await app.get(ShipmentGateway).emitShipmentStatusChanged(shipmentId, 'DELIVERED');
    await disconnected;
    expect(received).not.toHaveBeenCalled();
  });
  it.each(['emergency', 'shipments'])(
    'refuses a revoked token at the %s handshake',
    async (namespace) => {
      await db.session.update({ where: { id: sid() }, data: { revokedAt: new Date() } });
      const socket = connect(namespace);
      const connected = jest.fn();
      socket.on('connected', connected);
      const disconnected = event(socket, 'disconnect');
      socket.connect();
      await disconnected;
      expect(connected).not.toHaveBeenCalled();
    },
  );
  it.each(['emergency', 'shipments'])(
    'refuses an expired signed JWT at the %s handshake',
    async (namespace) => {
      donor.token = await app.get(JwtService).signAsync(
        { sub: donor.id, sid: sid() },
        {
          secret: app.get(ConfigService).getOrThrow<string>('JWT_ACCESS_SECRET'),
          expiresIn: -1,
        },
      );
      const socket = connect(namespace);
      const connected = jest.fn();
      socket.on('connected', connected);
      const disconnected = event(socket, 'disconnect');
      socket.connect();
      await disconnected;
      expect(connected).not.toHaveBeenCalled();
    },
  );
});
