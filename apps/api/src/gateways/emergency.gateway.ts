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

import { AuthenticatedSocket, SessionSocketGateway } from './session-socket.gateway';

interface JoinRoomPayload {
  emergencyRequestId: string;
}

@WebSocketGateway({
  namespace: '/emergency',
  cors: {
    origin: (process.env.WEB_URL || 'http://localhost:3000').split(',').map((o) => o.trim()),
    credentials: true,
  },
})
export class EmergencyGateway extends SessionSocketGateway {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(EmergencyGateway.name);
  constructor(jwtService: JwtService, db: PrismaService) {
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
      typeof payload.emergencyRequestId !== 'string' ||
      !payload.emergencyRequestId ||
      payload.emergencyRequestId.length > 200
    ) {
      return { success: false, error: 'Invalid resource id' };
    }
    const { emergencyRequestId } = payload;
    const access = await this.resolveEmergencyAccess(
      client.userId!,
      client.roles || [],
      emergencyRequestId,
    );

    if (!access) {
      client.emit('error', { message: 'Access denied to this emergency' });
      return { success: false, error: 'Access denied' };
    }

    const roomName = access.room;
    await this.subscribe(client, roomName);

    this.logger.log(`Client ${client.id} joined room ${roomName} (${access.kind})`);
    return { success: true, room: roomName };
  }

  @SubscribeMessage('leave')
  handleLeave(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: JoinRoomPayload,
  ) {
    if (
      !payload ||
      typeof payload.emergencyRequestId !== 'string' ||
      !payload.emergencyRequestId ||
      payload.emergencyRequestId.length > 200
    ) {
      return { success: false, error: 'Invalid resource id' };
    }
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
  async emitDonorLocationUpdate(
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
    await this.emitEmergency(
      emergencyRequestId,
      this.hospitalRoom(emergencyRequestId),
      'donor_location',
      {
        emergencyRequestId,
        ...data,
      },
    );
  }

  /**
   * Broadcasts a response status change to the hospital, plus the specific
   * donor whose response changed (so they see their own status live) —
   * never to other donors responding to the same emergency.
   */
  async emitResponseStatusChanged(
    emergencyRequestId: string,
    data: { responseId: string; donorId: string; status: string },
  ) {
    const payload = {
      emergencyRequestId,
      ...data,
      timestamp: new Date().toISOString(),
    };
    await this.emitEmergency(
      emergencyRequestId,
      this.hospitalRoom(emergencyRequestId),
      'response_status_changed',
      payload,
    );
    await this.emitEmergency(
      emergencyRequestId,
      this.donorRoom(emergencyRequestId, data.donorId),
      'response_status_changed',
      payload,
    );
  }

  private async emitEmergency(id: string, room: string, event: string, data: unknown) {
    await this.emitAuthorized(
      room,
      event,
      data,
      async (client) =>
        (await this.resolveEmergencyAccess(client.userId!, client.roles ?? [], id))?.room === room,
    );
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
      where: {
        userId,
        organizationId: emergency.hospitalId,
        status: 'ACTIVE',
        organization: { status: 'ACTIVE' },
        role: { code: { in: ['HOSPITAL_ADMIN', 'HOSPITAL_STAFF'] } },
      },
    });

    if (membership) {
      return { room: this.hospitalRoom(emergencyRequestId), kind: 'hospital' };
    }

    if (roles.includes('DONOR') && emergency.responses.some((r) => r.donorId === userId)) {
      return { room: this.donorRoom(emergencyRequestId, userId), kind: 'donor' };
    }

    return null;
  }
}
