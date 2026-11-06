import { OnModuleDestroy } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { PrismaService } from '../database/prisma.service';
import { resolveSessionUser } from '../modules/auth/session-authorization';

export interface AuthenticatedSocket extends Socket {
  userId?: string;
  roles?: string[];
  lastHeartbeat?: number;
}

/** Single-process fanout: rooms identify subscriptions, never authorization. */
export abstract class SessionSocketGateway implements OnModuleDestroy {
  protected readonly connectedClients = new Map<string, AuthenticatedSocket>();
  protected readonly roomSubscriptions = new Map<string, Set<string>>();
  private readonly tokens = new Map<string, string>();
  private heartbeatInterval?: ReturnType<typeof setInterval>;
  private checking = false;

  constructor(
    protected readonly jwtService: JwtService,
    protected readonly db: PrismaService,
  ) {}

  afterInit() {
    this.heartbeatInterval = setInterval(() => void this.checkConnections(), 30_000);
    this.heartbeatInterval.unref();
  }

  async checkConnections() {
    if (this.checking) return;
    this.checking = true;
    try {
      await Promise.all(
        [...this.connectedClients.values()].map(async (client) => {
          if (!client.lastHeartbeat || Date.now() - client.lastHeartbeat > 90_000) {
            this.dropClient(client);
            return;
          }
          await this.authorizeClient(client);
        }),
      );
    } finally {
      this.checking = false;
    }
  }

  onModuleDestroy() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    for (const client of this.connectedClients.values()) this.dropClient(client);
  }

  async handleConnection(client: AuthenticatedSocket) {
    const token =
      client.handshake.auth?.token ??
      client.handshake.headers.authorization?.replace(/^Bearer /, '');
    if (typeof token !== 'string' || !token || token.length > 8192) {
      this.dropClient(client);
      return;
    }
    this.tokens.set(client.id, token);
    if (!(await this.authorizeClient(client))) return;
    this.connectedClients.set(client.id, client);
    client.lastHeartbeat = Date.now();
    client.emit('connected', { userId: client.userId });
  }

  protected async authorizeClient(client: AuthenticatedSocket): Promise<boolean> {
    try {
      const token = this.tokens.get(client.id);
      if (!token || !client.connected) throw new Error('Disconnected');
      const claims = this.jwtService.verify(token);
      const user = await resolveSessionUser(this.db, claims);
      // A disconnect/leave may occur while a database query is in flight.
      if (!client.connected || this.tokens.get(client.id) !== token) return false;
      client.userId = user.sub;
      client.roles = user.roles;
      return true;
    } catch {
      this.dropClient(client);
      return false;
    }
  }

  protected dropClient(client: AuthenticatedSocket) {
    this.handleDisconnect(client);
    client.emit('error', { message: 'Authentication or access expired' });
    client.disconnect(true);
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.tokens.delete(client.id);
    this.connectedClients.delete(client.id);
    for (const [room, clients] of this.roomSubscriptions) {
      clients.delete(client.id);
      if (!clients.size) this.roomSubscriptions.delete(room);
    }
  }

  protected async subscribe(client: AuthenticatedSocket, room: string) {
    await client.join(room);
    if (!client.connected || !this.connectedClients.has(client.id)) return;
    if (!this.roomSubscriptions.has(room)) this.roomSubscriptions.set(room, new Set());
    this.roomSubscriptions.get(room)!.add(client.id);
  }

  protected async emitAuthorized(
    room: string,
    event: string,
    data: unknown,
    hasAccess: (client: AuthenticatedSocket) => Promise<boolean>,
  ) {
    await Promise.all(
      [...(this.roomSubscriptions.get(room) ?? [])].map(async (id) => {
        const client = this.connectedClients.get(id);
        if (!client || !(await this.authorizeClient(client))) return;
        try {
          if (!(await hasAccess(client))) {
            this.dropClient(client);
            return;
          }
          if (
            client.connected &&
            this.connectedClients.get(id) === client &&
            this.roomSubscriptions.get(room)?.has(id)
          )
            client.emit(event, data);
        } catch {
          this.dropClient(client);
        }
      }),
    );
  }

  getConnectionState() {
    return {
      totalConnections: this.connectedClients.size,
      rooms: [...this.roomSubscriptions].map(([room, clients]) => ({
        room,
        subscribers: clients.size,
      })),
    };
  }
}
