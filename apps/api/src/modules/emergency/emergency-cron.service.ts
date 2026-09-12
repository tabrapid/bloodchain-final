import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EmergencyMatchStatus, EmergencyResponseStatus, EmergencyStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

const SOS_REQUEST_EXPIRED_EVENT = 'sos.request.expired';

const OPEN_EMERGENCY_STATUSES: EmergencyStatus[] = [
  EmergencyStatus.ACTIVE,
  EmergencyStatus.MATCHING,
  EmergencyStatus.RESPONSES_RECEIVED,
];

const OPEN_MATCH_STATUSES: EmergencyMatchStatus[] = [
  EmergencyMatchStatus.MATCHED,
  EmergencyMatchStatus.NOTIFIED,
  EmergencyMatchStatus.VIEWED,
];

/**
 * The statuses in which a journey is over.
 *
 * Listed positively rather than as "not the active ones" so that adding a new
 * response status defaults to *keeping* its location data. Getting that
 * backwards would silently start deleting the track of a journey still under
 * way, which is the one thing this job must never do.
 */
const CLOSED_RESPONSE_STATUSES: EmergencyResponseStatus[] = [
  EmergencyResponseStatus.COMPLETED,
  EmergencyResponseStatus.CANCELLED,
  EmergencyResponseStatus.FAILED,
];

@Injectable()
export class EmergencyCronService {
  private readonly logger = new Logger(EmergencyCronService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly audit: AuditLogsService,
    private readonly config: ConfigService,
  ) {}

  private get locationRetentionHours(): number {
    return this.config.get<number>('EMERGENCY_LOCATION_RETENTION_HOURS', 72);
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async runMaintenance(): Promise<void> {
    const expired = await this.expireStaleEmergencies();

    if (expired > 0) {
      this.logger.log(`Emergency maintenance: ${expired} emergency request(s) expired past their deadline.`);
      await this.audit.log({
        action: 'EMERGENCY_EXPIRATION_RUN',
        entityType: 'EmergencyRequest',
        metadata: { requestsExpired: expired },
      });
    }

    const locationsPruned = await this.pruneExpiredLocationHistory();

    if (locationsPruned > 0) {
      this.logger.log(`Emergency maintenance: pruned ${locationsPruned} expired location point(s).`);
      await this.audit.log({
        action: 'EMERGENCY_LOCATION_PRUNE_RUN',
        entityType: 'EmergencyLocation',
        metadata: { pointsDeleted: locationsPruned, retentionHours: this.locationRetentionHours },
      });
    }
  }

  /**
   * Deletes the GPS track of journeys that have been over for longer than the
   * configured retention window.
   *
   * A donor's movements are among the most sensitive things this system
   * records, and they were kept forever: rows survived the response closing,
   * so the database accumulated a movement history of identifiable people with
   * nothing ever removing it.
   *
   * Two constraints shape this:
   *
   * - **An active journey is never touched.** Eligibility for deletion is
   *   decided by the response's status being terminal, not by the age of the
   *   point. A donor stuck in traffic for four hours still needs the hospital
   *   to see where they are, however old the retention window.
   * - **The window is configuration, not a product decision.** What the lawful
   *   retention period is for location data on identifiable citizens is a legal
   *   question this sprint does not answer. The default is a development
   *   convenience; the variable exists so the answer, when it arrives, is a
   *   config change.
   *
   * Measured from when the journey closed, not from when each point was
   * recorded, so a single journey's track is deleted as one piece rather than
   * eroding from the front while it is still readable.
   */
  async pruneExpiredLocationHistory(now: Date = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - this.locationRetentionHours * 60 * 60 * 1000);

    const deleted = await this.db.emergencyLocation.deleteMany({
      where: {
        emergencyResponse: {
          status: { in: CLOSED_RESPONSE_STATUSES },
          // `updatedAt` is the reliable closure marker: a FAILED response may
          // carry neither completedAt nor cancelledAt, and falling back to the
          // point's own timestamp would prune a long journey's early history
          // while it is still in progress.
          updatedAt: { lt: cutoff },
        },
      },
    });

    return deleted.count;
  }

  /**
   * Transitions any still-open EmergencyRequest past its requiredBefore deadline to EXPIRED,
   * expires its still-pending EmergencyMatch rows, and emits SOS_REQUEST_EXPIRED_EVENT per
   * notified donor so their SOS push notifications get expired too. Returns the count actually expired.
   */
  async expireStaleEmergencies(): Promise<number> {
    const now = new Date();

    const candidates = await this.db.emergencyRequest.findMany({
      where: { status: { in: OPEN_EMERGENCY_STATUSES }, requiredBefore: { lt: now } },
      select: { id: true },
    });

    if (candidates.length === 0) return 0;

    let expiredCount = 0;

    for (const candidate of candidates) {
      const result = await this.db.$transaction(async (tx) => {
        // Atomic conditional update: a request that already progressed past one
        // of the open statuses (e.g. a donor was just confirmed) between the
        // query above and now should not be overwritten.
        const claim = await tx.emergencyRequest.updateMany({
          where: { id: candidate.id, status: { in: OPEN_EMERGENCY_STATUSES } },
          data: { status: EmergencyStatus.EXPIRED, closedAt: now },
        });
        if (claim.count === 0) return null;

        const staleMatches = await tx.emergencyMatch.findMany({
          where: { emergencyRequestId: candidate.id, status: { in: OPEN_MATCH_STATUSES } },
          select: { id: true, donorId: true },
        });

        if (staleMatches.length > 0) {
          await tx.emergencyMatch.updateMany({
            where: { id: { in: staleMatches.map((match) => match.id) } },
            data: { status: EmergencyMatchStatus.EXPIRED, expiredAt: now },
          });
        }

        return { donorIds: staleMatches.map((match) => match.donorId) };
      });

      if (!result) continue;

      expiredCount++;
      for (const donorId of result.donorIds) {
        this.eventEmitter.emit(SOS_REQUEST_EXPIRED_EVENT, { requestId: candidate.id, recipientId: donorId });
      }
    }

    return expiredCount;
  }
}
