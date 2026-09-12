import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EmergencyResponseStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { EmergencyCronService } from './emergency-cron.service';

/**
 * A donor's movements are among the most sensitive things this system records,
 * and they were kept forever: rows survived the response closing, so the
 * database accumulated a movement history of identifiable people with nothing
 * ever removing it.
 *
 * The retention period itself is deliberately NOT asserted here as a correct
 * value -- it is configuration, and what is lawful is a legal question this
 * sprint does not answer. What is asserted is that the window is honoured and
 * that an active journey is never touched.
 */
describe('EmergencyCronService.pruneExpiredLocationHistory', () => {
  let service: EmergencyCronService;
  let prisma: any;
  let config: { get: jest.Mock };

  const RETENTION_HOURS = 72;

  beforeEach(async () => {
    prisma = {
      emergencyLocation: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      emergencyRequest: { findMany: jest.fn().mockResolvedValue([]) },
    };
    config = { get: jest.fn((key: string, fallback: number) => (key === 'EMERGENCY_LOCATION_RETENTION_HOURS' ? RETENTION_HOURS : fallback)) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmergencyCronService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: AuditLogsService, useValue: { log: jest.fn() } },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    service = module.get(EmergencyCronService);
  });

  function deleteFilter() {
    return prisma.emergencyLocation.deleteMany.mock.calls[0][0].where.emergencyResponse;
  }

  /**
   * The single most important property of this job. A donor stuck in traffic
   * for four hours still needs the hospital to see where they are, however old
   * the retention window -- so eligibility for deletion is decided by the
   * response being over, never by the age of the point.
   */
  it('only ever deletes points belonging to a closed response', async () => {
    await service.pruneExpiredLocationHistory();

    const statuses = deleteFilter().status.in;
    expect(statuses).toEqual(
      expect.arrayContaining([
        EmergencyResponseStatus.COMPLETED,
        EmergencyResponseStatus.CANCELLED,
        EmergencyResponseStatus.FAILED,
      ]),
    );
    for (const active of [
      EmergencyResponseStatus.ACCEPTED,
      EmergencyResponseStatus.EN_ROUTE,
      EmergencyResponseStatus.ARRIVED,
      EmergencyResponseStatus.DONATION_STARTED,
    ]) {
      expect(statuses).not.toContain(active);
    }
  });

  it('measures the window from when the journey closed, not from each point', async () => {
    const now = new Date('2026-09-12T12:00:00Z');
    await service.pruneExpiredLocationHistory(now);

    const filter = deleteFilter();
    // The cutoff constrains the response's own timestamp, so a journey's track
    // is removed as one piece rather than eroding from the front while it is
    // still readable.
    expect(filter.updatedAt.lt).toEqual(new Date('2026-09-09T12:00:00Z'));
  });

  it('honours a reconfigured retention window', async () => {
    config.get.mockImplementation((key: string, fallback: number) =>
      key === 'EMERGENCY_LOCATION_RETENTION_HOURS' ? 1 : fallback,
    );
    const now = new Date('2026-09-12T12:00:00Z');

    await service.pruneExpiredLocationHistory(now);

    expect(deleteFilter().updatedAt.lt).toEqual(new Date('2026-09-12T11:00:00Z'));
  });

  it('reports how many points it removed', async () => {
    prisma.emergencyLocation.deleteMany.mockResolvedValue({ count: 42 });
    expect(await service.pruneExpiredLocationHistory()).toBe(42);
  });

  it('runs as part of scheduled maintenance and audits a non-empty prune', async () => {
    prisma.emergencyLocation.deleteMany.mockResolvedValue({ count: 7 });
    const audit = service['audit'] as unknown as { log: jest.Mock };

    await service.runMaintenance();

    expect(prisma.emergencyLocation.deleteMany).toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'EMERGENCY_LOCATION_PRUNE_RUN',
        metadata: expect.objectContaining({ pointsDeleted: 7, retentionHours: RETENTION_HOURS }),
      }),
    );
  });

  it('does not write an audit record when there was nothing to prune', async () => {
    prisma.emergencyLocation.deleteMany.mockResolvedValue({ count: 0 });
    const audit = service['audit'] as unknown as { log: jest.Mock };

    await service.runMaintenance();

    expect(audit.log).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: 'EMERGENCY_LOCATION_PRUNE_RUN' }),
    );
  });
});
