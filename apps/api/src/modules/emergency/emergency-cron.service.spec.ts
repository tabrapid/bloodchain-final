import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EmergencyMatchStatus, EmergencyStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { EmergencyCronService } from './emergency-cron.service';

describe('EmergencyCronService', () => {
  let service: EmergencyCronService;
  let prisma: any;
  let tx: any;
  let eventEmitter: { emit: jest.Mock };

  beforeEach(async () => {
    tx = {
      emergencyRequest: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      emergencyMatch: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    prisma = {
      emergencyRequest: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn().mockImplementation(async (cb: any) => cb(tx)),
    };

    eventEmitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmergencyCronService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: AuditLogsService, useValue: { log: jest.fn().mockResolvedValue({}) } },
      ],
    }).compile();

    service = module.get<EmergencyCronService>(EmergencyCronService);
  });

  describe('expireStaleEmergencies', () => {
    it('returns 0 immediately when nothing is past its deadline', async () => {
      const count = await service.expireStaleEmergencies();
      expect(count).toBe(0);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('expires a stale request, expires its pending matches, and emits one expiry event per notified donor', async () => {
      prisma.emergencyRequest.findMany.mockResolvedValue([{ id: 'req-1' }]);
      tx.emergencyMatch.findMany.mockResolvedValue([
        { id: 'match-1', donorId: 'donor-1' },
        { id: 'match-2', donorId: 'donor-2' },
      ]);

      const count = await service.expireStaleEmergencies();

      expect(count).toBe(1);
      expect(prisma.emergencyRequest.findMany).toHaveBeenCalledWith({
        where: {
          status: { in: [EmergencyStatus.ACTIVE, EmergencyStatus.MATCHING, EmergencyStatus.RESPONSES_RECEIVED] },
          requiredBefore: { lt: expect.any(Date) },
        },
        select: { id: true },
      });
      expect(tx.emergencyRequest.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'req-1',
          status: { in: [EmergencyStatus.ACTIVE, EmergencyStatus.MATCHING, EmergencyStatus.RESPONSES_RECEIVED] },
        },
        data: { status: EmergencyStatus.EXPIRED, closedAt: expect.any(Date) },
      });
      expect(tx.emergencyMatch.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['match-1', 'match-2'] } },
        data: { status: EmergencyMatchStatus.EXPIRED, expiredAt: expect.any(Date) },
      });
      expect(eventEmitter.emit).toHaveBeenCalledTimes(2);
      expect(eventEmitter.emit).toHaveBeenCalledWith('sos.request.expired', { requestId: 'req-1', recipientId: 'donor-1' });
      expect(eventEmitter.emit).toHaveBeenCalledWith('sos.request.expired', { requestId: 'req-1', recipientId: 'donor-2' });
    });

    it('does not count or emit anything for a request that already progressed before the claim landed', async () => {
      prisma.emergencyRequest.findMany.mockResolvedValue([{ id: 'req-1' }]);
      tx.emergencyRequest.updateMany.mockResolvedValue({ count: 0 });

      const count = await service.expireStaleEmergencies();

      expect(count).toBe(0);
      expect(tx.emergencyMatch.findMany).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('does not touch matches that already resolved (e.g. ACCEPTED) when a request expires', async () => {
      prisma.emergencyRequest.findMany.mockResolvedValue([{ id: 'req-1' }]);
      tx.emergencyMatch.findMany.mockResolvedValue([]);

      const count = await service.expireStaleEmergencies();

      expect(count).toBe(1);
      expect(tx.emergencyMatch.updateMany).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });
  });

  describe('runMaintenance', () => {
    it('audit-logs a summary only when something actually expired', async () => {
      const audit = { log: jest.fn().mockResolvedValue({}) };
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          EmergencyCronService,
          { provide: PrismaService, useValue: prisma },
          { provide: EventEmitter2, useValue: eventEmitter },
          { provide: AuditLogsService, useValue: audit },
        ],
      }).compile();
      const svc = module.get<EmergencyCronService>(EmergencyCronService);

      await svc.runMaintenance();
      expect(audit.log).not.toHaveBeenCalled();

      prisma.emergencyRequest.findMany.mockResolvedValue([{ id: 'req-1' }]);
      await svc.runMaintenance();
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'EMERGENCY_EXPIRATION_RUN', metadata: { requestsExpired: 1 } }),
      );
    });
  });
});
