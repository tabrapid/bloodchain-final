import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../database/prisma.service';
import { LocationService } from '../modules/shipments/services/location.service';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  organizationId?: string;
  roles?: string[];
  lastHeartbeat?: number;
}

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

interface ShipmentUpdatePayload {
  shipmentId: string;
  status: string;
  timestamp: string;
}

const HEARTBEAT_INTERVAL = 30000;
const CONNECTION_TIMEOUT = 90000;

@WebSocketGateway({
  namespace: '/shipments',
  cors: {
    origin: process.env.WEB_URL || 'http://localhost:3000',
    credentials: true,
  },
})
export class ShipmentGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ShipmentGateway.name);
  private readonly connectedClients = new Map<string, AuthenticatedSocket>();
  private readonly roomSubscriptions = new Map<string, Set<string>>();
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly jwtService: JwtService,
    private readonly db: PrismaService,
    private readonly locationService: LocationService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('ShipmentGateway initialized');
    this.startHeartbeat();
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      this.connectedClients.forEach((client, clientId) => {
        if (client.lastHeartbeat && now - client.lastHeartbeat > CONNECTION_TIMEOUT) {
          this.logger.warn(`Client ${clientId} heartbeat timeout, disconnecting`);
          client.emit('timeout', { message: 'Connection timeout' });
          client.disconnect();
        }
      });
    }, HEARTBEAT_INTERVAL);
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(`Client ${client.id} connected without token`);
        client.emit('error', { message: 'Authentication required' });
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      const user = await this.db.user.findUnique({
        where: { id: payload.sub },
        include: {
          memberships: {
            include: { role: true },
          },
          courier: true,
        },
      });

      if (!user) {
        client.emit('error', { message: 'User not found' });
        client.disconnect();
        return;
      }

      client.userId = user.id;
      client.roles = user.memberships.map((m: any) => m.role.code);
      client.lastHeartbeat = Date.now();

      const bloodCenterMembership = user.memberships.find((m: any) => m.organization?.type === 'BLOOD_CENTER');
      const hospitalMembership = user.memberships.find((m: any) => m.organization?.type === 'HOSPITAL');

      client.organizationId = bloodCenterMembership?.organizationId || hospitalMembership?.organizationId;

      this.connectedClients.set(client.id, client);

      this.logger.log(`Client ${client.id} connected as user ${user.id}`);
      client.emit('connected', { userId: user.id });
    } catch (error) {
      this.logger.warn(`Client ${client.id} authentication failed: ${(error as Error).message}`);
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    const userId = client.userId;
    this.connectedClients.delete(client.id);

    this.roomSubscriptions.forEach((clients, roomId) => {
      clients.delete(client.id);
      if (clients.size === 0) {
        this.roomSubscriptions.delete(roomId);
      }
    });

    this.logger.log(`Client ${client.id} (user: ${userId}) disconnected`);
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: AuthenticatedSocket) {
    client.lastHeartbeat = Date.now();
    return { event: 'pong', data: { timestamp: Date.now() } };
  }

  @SubscribeMessage('join')
  async handleJoin(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: JoinRoomPayload,
  ) {
    if (!client.userId) {
      client.emit('error', { message: 'Not authenticated' });
      return { success: false, error: 'Not authenticated' };
    }

    const { shipmentId } = payload;

    const hasAccess = await this.checkShipmentAccess(client.userId, client.roles || [], shipmentId);
    if (!hasAccess) {
      client.emit('error', { message: 'Access denied to this shipment' });
      return { success: false, error: 'Access denied' };
    }

    const roomName = `shipment:${shipmentId}`;
    client.join(roomName);

    if (!this.roomSubscriptions.has(roomName)) {
      this.roomSubscriptions.set(roomName, new Set());
    }
    this.roomSubscriptions.get(roomName)!.add(client.id);

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
    if (!client.userId) {
      client.emit('error', { message: 'Not authenticated' });
      return { success: false, error: 'Not authenticated' };
    }

    const { shipmentId, latitude, longitude, accuracy, heading, speed } = payload;

    if (
      typeof latitude !== 'number' ||
      typeof longitude !== 'number' ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      return { success: false, error: 'Invalid coordinates' };
    }

    const courier = await this.db.courier.findUnique({
      where: { userId: client.userId },
    });

    if (!courier) {
      return { success: false, error: 'Courier profile not found' };
    }

    const access = await this.locationService.validateCourierShipmentAccess(
      courier.id,
      shipmentId,
    );

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

    const roomName = `shipment:${shipmentId}`;
    this.server.to(roomName).emit('courier_location', {
      shipmentId,
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

  emitShipmentStatusChanged(
    shipmentId: string,
    status: string,
    metadata?: Record<string, unknown>,
  ) {
    const roomName = `shipment:${shipmentId}`;
    this.server.to(roomName).emit('shipment_status_changed', {
      shipmentId,
      status,
      metadata,
      timestamp: new Date().toISOString(),
    });
  }

  emitShipmentUpdated(shipmentId: string, data: Record<string, unknown>) {
    const roomName = `shipment:${shipmentId}`;
    this.server.to(roomName).emit('shipment_updated', {
      shipmentId,
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  emitEtaUpdated(shipmentId: string, etaMinutes: number, distanceKm: number) {
    const roomName = `shipment:${shipmentId}`;
    this.server.to(roomName).emit('eta_updated', {
      shipmentId,
      etaMinutes,
      distanceKm,
      timestamp: new Date().toISOString(),
    });
  }

  emitDeliveryConfirmed(
    shipmentId: string,
    receivedUnits: number,
    receiverName: string,
    notes?: string,
  ) {
    const roomName = `shipment:${shipmentId}`;
    this.server.to(roomName).emit('delivery_confirmed', {
      shipmentId,
      receivedUnits,
      receiverName,
      notes,
      timestamp: new Date().toISOString(),
    });
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
          },
        },
      },
    });

    if (!user) {
      return false;
    }

    const organizationIds = user.memberships.map((m: any) => m.organizationId);

    if (organizationIds.includes(shipment.sourceOrganizationId)) {
      return true;
    }

    if (organizationIds.includes(shipment.destinationOrganizationId)) {
      return true;
    }

    return false;
  }

  getConnectionState() {
    return {
      totalConnections: this.connectedClients.size,
      rooms: Array.from(this.roomSubscriptions.keys()).map((room) => ({
        room,
        subscribers: this.roomSubscriptions.get(room)?.size || 0,
      })),
    };
  }
}
