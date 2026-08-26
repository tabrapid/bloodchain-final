import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EmergencyMatchStatus, EmergencyStatus } from '@prisma/client';
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

@Injectable()
export class EmergencyCronService {
  private readonly logger = new Logger(EmergencyCronService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly audit: AuditLogsService,
  ) {}

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
