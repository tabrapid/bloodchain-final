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
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../database/prisma.service';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  roles?: string[];
  lastHeartbeat?: number;
}

interface JoinRoomPayload {
  emergencyRequestId: string;
}

const HEARTBEAT_INTERVAL = 30000;
const CONNECTION_TIMEOUT = 90000;

@WebSocketGateway({
  namespace: '/emergency',
  cors: {
    origin: (process.env.WEB_URL || 'http://localhost:3000').split(',').map((o) => o.trim()),
    credentials: true,
  },
})
export class EmergencyGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(EmergencyGateway.name);
  private readonly connectedClients = new Map<string, AuthenticatedSocket>();
  private readonly roomSubscriptions = new Map<string, Set<string>>();
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly jwtService: JwtService,
    private readonly db: PrismaService,
  ) {}

  afterInit() {
    this.logger.log('EmergencyGateway initialized');
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
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        client.emit('error', { message: 'Authentication required' });
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      const user = await this.db.user.findUnique({
        where: { id: payload.sub },
        include: { memberships: { include: { role: true } } },
      });

      if (!user) {
        client.emit('error', { message: 'User not found' });
        client.disconnect();
        return;
      }

      client.userId = user.id;
      client.roles = user.memberships.map((m) => m.role.code);
      client.lastHeartbeat = Date.now();

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
    this.connectedClients.delete(client.id);
    this.roomSubscriptions.forEach((clients, roomId) => {
      clients.delete(client.id);
      if (clients.size === 0) {
        this.roomSubscriptions.delete(roomId);
      }
    });
    this.logger.log(`Client ${client.id} disconnected`);
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

    const { emergencyRequestId } = payload;
    const access = await this.resolveEmergencyAccess(
      client.userId,
      client.roles || [],
      emergencyRequestId,
    );

    if (!access) {
      client.emit('error', { message: 'Access denied to this emergency' });
      return { success: false, error: 'Access denied' };
    }

    const roomName = access.room;
    client.join(roomName);

    if (!this.roomSubscriptions.has(roomName)) {
      this.roomSubscriptions.set(roomName, new Set());
    }
    this.roomSubscriptions.get(roomName)!.add(client.id);

    this.logger.log(`Client ${client.id} joined room ${roomName} (${access.kind})`);
    return { success: true, room: roomName };
  }

  @SubscribeMessage('leave')
  handleLeave(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: JoinRoomPayload,
  ) {
    const { emergencyRequestId } = payload;
    // A client only ever holds one of these rooms (hospital or its own donor
    // room, never both), but leaving a room it isn't in is a harmless no-op —
    // so it's simplest and safest to clear both without re-resolving access.
    const candidateRooms = [this.hospitalRoom(emergencyRequestId)];
    if (client.userId) {
      candidateRooms.push(this.donorRoom(emergencyRequestId, client.userId));
    }

    for (const roomName of candidateRooms) {
      client.leave(roomName);
      const roomClients = this.roomSubscriptions.get(roomName);
      if (roomClients) {
        roomClients.delete(client.id);
        if (roomClients.size === 0) {
          this.roomSubscriptions.delete(roomName);
        }
      }
    }

    return { success: true };
  }

  /**
   * Broadcasts a donor's live location. This must only ever reach the
   * requesting hospital's staff — never other donors responding to the same
   * emergency — so it is scoped to the hospital-only room.
   */
  emitDonorLocationUpdate(
    emergencyRequestId: string,
    data: {
      responseId: string;
      donorId: string;
      latitude: number;
      longitude: number;
      accuracy?: number | null;
      heading?: number | null;
      speed?: number | null;
      recordedAt: string;
    },
  ) {
    this.server.to(this.hospitalRoom(emergencyRequestId)).emit('donor_location', {
      emergencyRequestId,
      ...data,
    });
  }

  /**
   * Broadcasts a response status change to the hospital, plus the specific
   * donor whose response changed (so they see their own status live) —
   * never to other donors responding to the same emergency.
   */
  emitResponseStatusChanged(
    emergencyRequestId: string,
    data: { responseId: string; donorId: string; status: string },
  ) {
    const payload = {
      emergencyRequestId,
      ...data,
      timestamp: new Date().toISOString(),
    };
    this.server.to(this.hospitalRoom(emergencyRequestId)).emit('response_status_changed', payload);
    this.server
      .to(this.donorRoom(emergencyRequestId, data.donorId))
      .emit('response_status_changed', payload);
  }

  private hospitalRoom(emergencyRequestId: string): string {
    return `emergency:${emergencyRequestId}:hospital`;
  }

  private donorRoom(emergencyRequestId: string, donorId: string): string {
    return `emergency:${emergencyRequestId}:donor:${donorId}`;
  }

  /**
   * Determines which room (if any) a user may join for this emergency.
   * Hospital staff (and SUPER_ADMIN) get the shared hospital room, which
   * receives every donor's location and status. A responding donor only
   * ever gets their own private room, which receives their own status
   * changes and never another donor's location or status.
   */
  private async resolveEmergencyAccess(
    userId: string,
    roles: string[],
    emergencyRequestId: string,
  ): Promise<{ room: string; kind: 'hospital' | 'donor' } | null> {
    if (roles.includes('SUPER_ADMIN')) {
      return { room: this.hospitalRoom(emergencyRequestId), kind: 'hospital' };
    }

    const emergency = await this.db.emergencyRequest.findUnique({
      where: { id: emergencyRequestId },
      select: { hospitalId: true, responses: { select: { donorId: true } } },
    });

    if (!emergency) {
      return null;
    }

    const membership = await this.db.organizationMembership.findFirst({
      where: { userId, organizationId: emergency.hospitalId, status: 'ACTIVE' },
    });

    if (membership) {
      return { room: this.hospitalRoom(emergencyRequestId), kind: 'hospital' };
    }

    if (emergency.responses.some((r) => r.donorId === userId)) {
      return { room: this.donorRoom(emergencyRequestId, userId), kind: 'donor' };
    }

    return null;
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
