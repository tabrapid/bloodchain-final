/* global jest */
import { JwtService } from '@nestjs/jwt';
import { RoleCode } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuthenticatedSocket } from './session-socket.gateway';

export function socketFixture() {
  const records = new Map<string, ReturnType<typeof record>>();
  const db = {
    session: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(records.get(where.id) ?? null),
      ),
    },
    emergencyRequest: { findUnique: jest.fn() },
    organizationMembership: { findFirst: jest.fn() },
    shipment: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
    courier: { findUnique: jest.fn() },
    shipmentLocation: { create: jest.fn() },
  };
  const jwt = { verify: jest.fn((token: string) => ({ sub: token, sid: token })) };
  function record(id: string, roles: RoleCode[]) {
    return {
      userId: id,
      revokedAt: null as Date | null,
      expiresAt: new Date(Date.now() + 60_000),
      user: {
        status: 'ACTIVE',
        memberships: roles.map((code) => ({
          organization: { status: 'ACTIVE' },
          role: { code, permissions: [] },
        })),
      },
    };
  }
  function client(id: string, roles: RoleCode[] = [RoleCode.DONOR]) {
    records.set(id, record(id, roles));
    const socket = {
      id,
      connected: true,
      handshake: { auth: { token: id }, headers: {} },
      emit: jest.fn(),
      join: jest.fn(),
      leave: jest.fn(),
      disconnect: jest.fn(() => {
        socket.connected = false;
      }),
    };
    return socket as unknown as AuthenticatedSocket;
  }
  return {
    db,
    jwt,
    records,
    client,
    prisma: db as unknown as PrismaService,
    jwtService: jwt as unknown as JwtService,
  };
}
