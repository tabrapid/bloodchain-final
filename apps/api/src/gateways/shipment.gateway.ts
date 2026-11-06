import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../database/prisma.service';
import { LocationService } from '../modules/shipments/services/location.service';

import { AuthenticatedSocket, SessionSocketGateway } from './session-socket.gateway';

interface JoinRoomPayload {
  shipmentId: string;
}

interface LocationUpdatePayload {
  shipmentId: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
}

@WebSocketGateway({
  namespace: '/shipments',
  cors: {
    origin: (process.env.WEB_URL || 'http://localhost:3000').split(',').map((o) => o.trim()),
    credentials: true,
  },
})
export class ShipmentGateway extends SessionSocketGateway {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ShipmentGateway.name);
  constructor(
    jwtService: JwtService,
    db: PrismaService,
    private readonly locationService: LocationService,
  ) {
    super(jwtService, db);
  }

  @SubscribeMessage('ping')
  async handlePing(@ConnectedSocket() client: AuthenticatedSocket) {
    if (!(await this.authorizeClient(client)))
      return { success: false, error: 'Not authenticated' };
    client.lastHeartbeat = Date.now();
    return { event: 'pong', data: { timestamp: Date.now() } };
  }

  @SubscribeMessage('join')
  async handleJoin(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: JoinRoomPayload,
  ) {
    if (!(await this.authorizeClient(client))) {
      client.emit('error', { message: 'Not authenticated' });
      return { success: false, error: 'Not authenticated' };
    }

    if (
      !payload ||
      typeof payload.shipmentId !== 'string' ||
      !payload.shipmentId ||
      payload.shipmentId.length > 200
    ) {
      return { success: false, error: 'Invalid resource id' };
    }
    const { shipmentId } = payload;

    const hasAccess = await this.checkShipmentAccess(
      client.userId!,
      client.roles || [],
      shipmentId,
    );
    if (!hasAccess) {
      client.emit('error', { message: 'Access denied to this shipment' });
      return { success: false, error: 'Access denied' };
    }

    const roomName = `shipment:${shipmentId}`;
    await this.subscribe(client, roomName);

    this.logger.log(`Client ${client.id} joined room ${roomName}`);

    const shipment = await this.db.shipment.findUnique({
      where: { id: shipmentId },
      select: {
        id: true,
        shipmentReference: true,
        status: true,
        courier: {
          select: { id: true, displayName: true },
        },
      },
    });

    if (
      !(await this.authorizeClient(client)) ||
      !(await this.checkShipmentAccess(client.userId!, client.roles ?? [], shipmentId)) ||
      !this.roomSubscriptions.get(roomName)?.has(client.id)
    )
      return { success: false, error: 'Access denied' };

    client.emit('shipment_state', {
      shipmentId,
      status: shipment?.status,
      reference: shipment?.shipmentReference,
      courierName: shipment?.courier?.displayName,
    });

    return { success: true, room: roomName };
  }

  @SubscribeMessage('leave')
  handleLeave(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: JoinRoomPayload,
  ) {
    if (
      !payload ||
      typeof payload.shipmentId !== 'string' ||
      !payload.shipmentId ||
      payload.shipmentId.length > 200
    ) {
      return { success: false, error: 'Invalid resource id' };
    }
    const { shipmentId } = payload;
    const roomName = `shipment:${shipmentId}`;

    client.leave(roomName);

    const roomClients = this.roomSubscriptions.get(roomName);
    if (roomClients) {
      roomClients.delete(client.id);
      if (roomClients.size === 0) {
        this.roomSubscriptions.delete(roomName);
      }
    }

    this.logger.log(`Client ${client.id} left room ${roomName}`);
    return { success: true };
  }

  @SubscribeMessage('location_update')
  async handleLocationUpdate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: LocationUpdatePayload,
  ) {
    if (!(await this.authorizeClient(client))) {
      client.emit('error', { message: 'Not authenticated' });
      return { success: false, error: 'Not authenticated' };
    }

    if (
      !payload ||
      typeof payload.shipmentId !== 'string' ||
      !payload.shipmentId ||
      payload.shipmentId.length > 200
    )
      return { success: false, error: 'Invalid resource id' };
    const { shipmentId, latitude, longitude, accuracy, heading, speed } = payload;

    if (
      typeof latitude !== 'number' ||
      typeof longitude !== 'number' ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      return { success: false, error: 'Invalid coordinates' };
    }

    if (!client.roles?.includes('COURIER')) return { success: false, error: 'Access denied' };

    const courier = await this.db.courier.findUnique({
      where: { userId: client.userId },
    });

    if (!courier) {
      return { success: false, error: 'Courier profile not found' };
    }

    const access = await this.locationService.validateCourierShipmentAccess(courier.id, shipmentId);

    if (!access.valid) {
      return { success: false, error: access.error };
    }

    // Reject spoofed/corrupted GPS: out-of-range coordinates, physically
    // impossible jumps since the last known point, and stale/future
    // timestamps. Speed/accuracy issues are logged but don't block the
    // update, since GPS noise alone shouldn't drop a legitimate ping.
    const sanityCheck = await this.locationService.validateLocationUpdate(courier.id, shipmentId, {
      latitude,
      longitude,
      accuracy,
      heading,
      speed,
      timestamp: new Date(),
    });

    if (!sanityCheck.isValid) {
      this.logger.warn(
        `Rejected location update for shipment ${shipmentId} from courier ${courier.id}: ${sanityCheck.errors.join('; ')}`,
      );
      return { success: false, error: sanityCheck.errors.join('; ') };
    }

    if (sanityCheck.warnings.length > 0) {
      this.logger.warn(
        `Location update warnings for shipment ${shipmentId} from courier ${courier.id}: ${sanityCheck.warnings.join('; ')}`,
      );
    }

    const location = await this.db.shipmentLocation.create({
      data: {
        shipmentId,
        courierId: courier.id,
        latitude,
        longitude,
        accuracy: accuracy || null,
        heading: heading || null,
        speed: speed || null,
      },
    });

    await this.emitCourierLocation(shipmentId, {
      courierId: courier.id,
      latitude: Number(location.latitude),
      longitude: Number(location.longitude),
      accuracy: location.accuracy ? Number(location.accuracy) : null,
      heading: location.heading ? Number(location.heading) : null,
      speed: location.speed ? Number(location.speed) : null,
      recordedAt: location.recordedAt.toISOString(),
    });

    return { success: true };
  }

  /**
   * Broadcasts a courier's location to a shipment's room. Called both from
   * handleLocationUpdate above (the websocket path) and from
   * ShipmentsService.updateLocation (the REST fallback the mobile courier
   * app actually uses today) - without this, REST-submitted location
   * updates would never reach live-tracking web clients.
   */
  async emitCourierLocation(
    shipmentId: string,
    location: {
      courierId: string;
      latitude: number;
      longitude: number;
      accuracy?: number | null;
      heading?: number | null;
      speed?: number | null;
      recordedAt: string;
    },
  ) {
    const roomName = `shipment:${shipmentId}`;
    await this.emitShipment(shipmentId, roomName, 'courier_location', {
      shipmentId,
      ...location,
    });
  }

  async emitShipmentStatusChanged(
    shipmentId: string,
    status: string,
    metadata?: Record<string, unknown>,
  ) {
    const roomName = `shipment:${shipmentId}`;
    await this.emitShipment(shipmentId, roomName, 'shipment_status_changed', {
      shipmentId,
      status,
      metadata,
      timestamp: new Date().toISOString(),
    });
  }

  async emitShipmentUpdated(shipmentId: string, data: Record<string, unknown>) {
    const roomName = `shipment:${shipmentId}`;
    await this.emitShipment(shipmentId, roomName, 'shipment_updated', {
      shipmentId,
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  async emitEtaUpdated(shipmentId: string, etaMinutes: number, distanceKm: number) {
    const roomName = `shipment:${shipmentId}`;
    await this.emitShipment(shipmentId, roomName, 'eta_updated', {
      shipmentId,
      etaMinutes,
      distanceKm,
      timestamp: new Date().toISOString(),
    });
  }

  async emitDeliveryConfirmed(
    shipmentId: string,
    receivedUnits: number,
    receiverName: string,
    notes?: string,
  ) {
    const roomName = `shipment:${shipmentId}`;
    await this.emitShipment(shipmentId, roomName, 'delivery_confirmed', {
      shipmentId,
      receivedUnits,
      receiverName,
      notes,
      timestamp: new Date().toISOString(),
    });
  }

  private async emitShipment(id: string, room: string, event: string, data: unknown) {
    await this.emitAuthorized(room, event, data, (client) =>
      this.checkShipmentAccess(client.userId!, client.roles ?? [], id),
    );
  }

  private async checkShipmentAccess(
    userId: string,
    roles: string[],
    shipmentId: string,
  ): Promise<boolean> {
    if (roles.includes('SUPER_ADMIN')) {
      return true;
    }

    const shipment = await this.db.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        courier: { select: { userId: true } },
        sourceOrganization: { select: { id: true } },
        destinationOrganization: { select: { id: true } },
      },
    });

    if (!shipment) {
      return false;
    }

    if (roles.includes('COURIER') && shipment.courier?.userId === userId) {
      return true;
    }

    const user = await this.db.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          where: {
            status: 'ACTIVE',
            organization: { status: 'ACTIVE' },
            role: {
              code: {
                in: [
                  'HOSPITAL_ADMIN',
                  'HOSPITAL_STAFF',
                  'BLOOD_CENTER_ADMIN',
                  'BLOOD_CENTER_STAFF',
                ],
              },
            },
          },
        },
      },
    });

    if (!user) {
      return false;
    }

    const organizationIds = user.memberships.map((m) => m.organizationId);

    if (organizationIds.includes(shipment.sourceOrganizationId)) {
      return true;
    }

    if (organizationIds.includes(shipment.destinationOrganizationId)) {
      return true;
    }

    return false;
  }
}
