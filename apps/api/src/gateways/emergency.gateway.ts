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
    const hasAccess = await this.checkEmergencyAccess(
      client.userId,
      client.roles || [],
      emergencyRequestId,
    );

    if (!hasAccess) {
      client.emit('error', { message: 'Access denied to this emergency' });
      return { success: false, error: 'Access denied' };
    }

    const roomName = `emergency:${emergencyRequestId}`;
    client.join(roomName);

    if (!this.roomSubscriptions.has(roomName)) {
      this.roomSubscriptions.set(roomName, new Set());
    }
    this.roomSubscriptions.get(roomName)!.add(client.id);

    this.logger.log(`Client ${client.id} joined room ${roomName}`);
    return { success: true, room: roomName };
  }

  @SubscribeMessage('leave')
  handleLeave(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: JoinRoomPayload,
  ) {
    const roomName = `emergency:${payload.emergencyRequestId}`;
    client.leave(roomName);

    const roomClients = this.roomSubscriptions.get(roomName);
    if (roomClients) {
      roomClients.delete(client.id);
      if (roomClients.size === 0) {
        this.roomSubscriptions.delete(roomName);
      }
    }

    return { success: true };
  }

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
    this.server.to(`emergency:${emergencyRequestId}`).emit('donor_location', {
      emergencyRequestId,
      ...data,
    });
  }

  emitResponseStatusChanged(
    emergencyRequestId: string,
    data: { responseId: string; donorId: string; status: string },
  ) {
    this.server.to(`emergency:${emergencyRequestId}`).emit('response_status_changed', {
      emergencyRequestId,
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  private async checkEmergencyAccess(
    userId: string,
    roles: string[],
    emergencyRequestId: string,
  ): Promise<boolean> {
    if (roles.includes('SUPER_ADMIN')) {
      return true;
    }

    const emergency = await this.db.emergencyRequest.findUnique({
      where: { id: emergencyRequestId },
      select: { hospitalId: true, responses: { select: { donorId: true } } },
    });

    if (!emergency) {
      return false;
    }

    if (emergency.responses.some((r) => r.donorId === userId)) {
      return true;
    }

    const membership = await this.db.organizationMembership.findFirst({
      where: { userId, organizationId: emergency.hospitalId, status: 'ACTIVE' },
    });

    return !!membership;
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
