import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../database/prisma.service';
import { EmergencyGateway } from './emergency.gateway';

type MockPrisma = {
  emergencyRequest: { findUnique: jest.Mock };
  organizationMembership: { findFirst: jest.Mock };
};

function makeClient(userId: string, roles: string[] = []) {
  return {
    id: `socket-${userId}`,
    userId,
    roles,
    join: jest.fn(),
    leave: jest.fn(),
    emit: jest.fn(),
  } as any;
}

describe('EmergencyGateway', () => {
  let gateway: EmergencyGateway;
  let prisma: MockPrisma;
  let serverEmit: jest.Mock;
  let serverTo: jest.Mock;

  beforeEach(async () => {
    prisma = {
      emergencyRequest: { findUnique: jest.fn() },
      organizationMembership: { findFirst: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmergencyGateway,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: { verify: jest.fn() } },
      ],
    }).compile();

    gateway = module.get<EmergencyGateway>(EmergencyGateway);

    serverEmit = jest.fn();
    serverTo = jest.fn().mockReturnValue({ emit: serverEmit });
    (gateway as any).server = { to: serverTo };
  });

  describe('room isolation between donors and hospital staff', () => {
    it('puts hospital staff in the shared hospital room', async () => {
      prisma.emergencyRequest.findUnique.mockResolvedValue({
        hospitalId: 'org-1',
        responses: [],
      });
      prisma.organizationMembership.findFirst.mockResolvedValue({ id: 'm1' });

      const client = makeClient('staff-1', ['HOSPITAL_STAFF']);
      const result = await gateway.handleJoin(client, { emergencyRequestId: 'em-1' });

      expect(result).toEqual({ success: true, room: 'emergency:em-1:hospital' });
      expect(client.join).toHaveBeenCalledWith('emergency:em-1:hospital');
    });

    it('puts a responding donor in their own private room, not the hospital room', async () => {
      prisma.emergencyRequest.findUnique.mockResolvedValue({
        hospitalId: 'org-1',
        responses: [{ donorId: 'donor-a' }],
      });
      prisma.organizationMembership.findFirst.mockResolvedValue(null);

      const client = makeClient('donor-a', ['DONOR']);
      const result = await gateway.handleJoin(client, { emergencyRequestId: 'em-1' });

      expect(result).toEqual({ success: true, room: 'emergency:em-1:donor:donor-a' });
      expect(client.join).toHaveBeenCalledWith('emergency:em-1:donor:donor-a');
      expect(client.join).not.toHaveBeenCalledWith('emergency:em-1:hospital');
    });

    it('gives two different responding donors two different rooms', async () => {
      prisma.emergencyRequest.findUnique.mockResolvedValue({
        hospitalId: 'org-1',
        responses: [{ donorId: 'donor-a' }, { donorId: 'donor-b' }],
      });
      prisma.organizationMembership.findFirst.mockResolvedValue(null);

      const clientA = makeClient('donor-a', ['DONOR']);
      const clientB = makeClient('donor-b', ['DONOR']);

      const resultA = await gateway.handleJoin(clientA, { emergencyRequestId: 'em-1' });
      const resultB = await gateway.handleJoin(clientB, { emergencyRequestId: 'em-1' });

      expect(resultA).toEqual({ success: true, room: 'emergency:em-1:donor:donor-a' });
      expect(resultB).toEqual({ success: true, room: 'emergency:em-1:donor:donor-b' });
    });

    it('denies access to a user who is neither hospital staff nor a responding donor', async () => {
      prisma.emergencyRequest.findUnique.mockResolvedValue({
        hospitalId: 'org-1',
        responses: [{ donorId: 'donor-a' }],
      });
      prisma.organizationMembership.findFirst.mockResolvedValue(null);

      const client = makeClient('stranger', ['DONOR']);
      const result = await gateway.handleJoin(client, { emergencyRequestId: 'em-1' });

      expect(result).toEqual({ success: false, error: 'Access denied' });
      expect(client.join).not.toHaveBeenCalled();
    });

    it('grants SUPER_ADMIN the hospital room without a membership lookup', async () => {
      prisma.emergencyRequest.findUnique.mockResolvedValue({
        hospitalId: 'org-1',
        responses: [],
      });

      const client = makeClient('admin-1', ['SUPER_ADMIN']);
      const result = await gateway.handleJoin(client, { emergencyRequestId: 'em-1' });

      expect(result).toEqual({ success: true, room: 'emergency:em-1:hospital' });
      expect(prisma.emergencyRequest.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('donor_location broadcast scope', () => {
    it('only ever targets the hospital room, never a donor room', () => {
      gateway.emitDonorLocationUpdate('em-1', {
        responseId: 'r1',
        donorId: 'donor-a',
        latitude: 41.3,
        longitude: 69.2,
        recordedAt: new Date().toISOString(),
      });

      expect(serverTo).toHaveBeenCalledTimes(1);
      expect(serverTo).toHaveBeenCalledWith('emergency:em-1:hospital');
      expect(serverEmit).toHaveBeenCalledWith('donor_location', expect.objectContaining({
        emergencyRequestId: 'em-1',
        donorId: 'donor-a',
      }));
    });
  });

  describe('response_status_changed broadcast scope', () => {
    it('targets the hospital room and only the affected donor\'s own room', () => {
      gateway.emitResponseStatusChanged('em-1', {
        responseId: 'r1',
        donorId: 'donor-a',
        status: 'ACCEPTED',
      });

      expect(serverTo).toHaveBeenCalledTimes(2);
      expect(serverTo).toHaveBeenCalledWith('emergency:em-1:hospital');
      expect(serverTo).toHaveBeenCalledWith('emergency:em-1:donor:donor-a');
      expect(serverTo).not.toHaveBeenCalledWith(expect.stringContaining('donor:donor-b'));
    });
  });
});
