import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { BloodUnitHoldKind, BloodUnitHoldStatus, MovementType, Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CustodyLedgerService } from './custody-ledger.service';

/**
 * Raising and lifting holds.
 *
 * The one thing this service must never do is release a unit. A hold is not a
 * lifecycle state, so resolving one is not a lifecycle transition: it writes
 * `status = RESOLVED` on the hold row and nothing else. It does not set
 * `clinicalReleasedAt`, does not change `BloodUnit.status`, does not touch
 * `expiresAt`, and does not consult the release policy.
 *
 * That separation is the product decision, and it is also the only way the two
 * questions stay answerable independently. "Is anything standing against this
 * unit" and "has this unit passed clinical release" are different questions
 * with different owners, and a unit that was held before it was released still
 * has to pass the gate afterwards -- lifting the hold gets it back to where it
 * was, not further.
 */
@Injectable()
export class HoldsService {
  constructor(
    private readonly db: PrismaService,
    private readonly audit: AuditLogsService,
    private readonly custody: CustodyLedgerService,
  ) {}

  /**
   * Place a hold on a unit.
   *
   * Takes a transaction client so a hold raised as a consequence of something
   * else -- a declared temperature excursion, most often -- commits or rolls
   * back with the event that caused it. A hold that survived the rollback of
   * its own cause would be a mystery nobody could resolve.
   */
  async raiseInTransaction(
    tx: Prisma.TransactionClient,
    params: {
      bloodUnitId: string;
      organizationId: string;
      kind: BloodUnitHoldKind;
      reasonCode?: string | null;
      reasonText?: string | null;
      raisedBy?: string | null;
      coldChainEventId?: string | null;
    },
  ) {
    const unit = await tx.bloodUnit.findUnique({
      where: { id: params.bloodUnitId },
      select: { id: true, status: true, organizationId: true },
    });

    if (!unit) {
      throw new NotFoundException('Blood unit not found.');
    }

    const hold = await tx.bloodUnitHold.create({
      data: {
        bloodUnitId: params.bloodUnitId,
        organizationId: params.organizationId,
        kind: params.kind,
        reasonCode: params.reasonCode ?? null,
        reasonText: params.reasonText ?? null,
        raisedBy: params.raisedBy ?? null,
        coldChainEventId: params.coldChainEventId ?? null,
      },
    });

    // The unit's status is deliberately unchanged. The ledger records that the
    // hold went on, because a custody history that omits "this unit was
    // impounded for a week" is not a custody history.
    await this.custody.record(tx, {
      bloodUnitId: params.bloodUnitId,
      organizationId: params.organizationId,
      type: MovementType.HELD,
      fromStatus: unit.status,
      toStatus: unit.status,
      actorId: params.raisedBy ?? null,
      holdId: hold.id,
      coldChainEventId: params.coldChainEventId ?? null,
      reason: params.reasonCode ?? params.kind,
    });

    return hold;
  }

  /** Raise a hold on its own, from a staff action rather than as a consequence. */
  async raise(
    organizationId: string,
    bloodUnitId: string,
    actorId: string,
    dto: {
      kind: BloodUnitHoldKind;
      reasonCode?: string;
      reasonText?: string;
    },
    ipAddress?: string,
  ) {
    const unit = await this.db.bloodUnit.findFirst({
      where: { id: bloodUnitId, organizationId },
      select: { id: true, unitReference: true },
    });

    if (!unit) {
      throw new NotFoundException('Blood unit not found in this organization.');
    }

    const hold = await this.db.$transaction((tx) =>
      this.raiseInTransaction(tx, {
        bloodUnitId,
        organizationId,
        kind: dto.kind,
        reasonCode: dto.reasonCode ?? null,
        reasonText: dto.reasonText ?? null,
        raisedBy: actorId,
      }),
    );

    await this.audit.log({
      actorId,
      action: 'BLOOD_UNIT_HOLD_RAISED',
      entityType: 'BloodUnit',
      entityId: bloodUnitId,
      organizationId,
      // The KIND is recorded; the free text is not. A hold reason can carry
      // clinical detail, and the audit log is read far more widely than the
      // quality workflow that owns it.
      metadata: { holdId: hold.id, kind: hold.kind, reasonCode: hold.reasonCode },
      ipAddress,
    });

    return { data: { id: hold.id, kind: hold.kind, status: hold.status, raisedAt: hold.raisedAt } };
  }

  /**
   * Lift a hold.
   *
   * Resolving is scoped to the organisation that raised it: a hold placed by
   * the dispatching blood centre is not the receiving hospital's to lift, and
   * the unit may by then be sitting in the receiver's inventory. The check is
   * on the hold's own organisation, not on where the unit currently is.
   */
  async resolve(
    organizationId: string,
    holdId: string,
    actorId: string,
    dto: { resolutionText?: string },
    ipAddress?: string,
  ) {
    const hold = await this.db.bloodUnitHold.findUnique({
      where: { id: holdId },
      include: { bloodUnit: { select: { unitReference: true, clinicalReleasedAt: true, status: true } } },
    });

    if (!hold) {
      throw new NotFoundException('Hold not found.');
    }

    if (hold.organizationId !== organizationId) {
      throw new ForbiddenException('This hold belongs to another organization.');
    }

    if (hold.status === BloodUnitHoldStatus.RESOLVED) {
      throw new ConflictException('This hold has already been resolved.');
    }

    const resolved = await this.db.$transaction(async (tx) => {
      // Claimed, so two people resolving the same hold do not both succeed and
      // write two ledger entries for one act.
      const { count } = await tx.bloodUnitHold.updateMany({
        where: { id: holdId, status: BloodUnitHoldStatus.ACTIVE },
        data: {
          status: BloodUnitHoldStatus.RESOLVED,
          resolvedBy: actorId,
          resolvedAt: new Date(),
          resolutionText: dto.resolutionText ?? null,
        },
      });

      if (count === 0) {
        throw new ConflictException('This hold has already been resolved.');
      }

      // NOTHING about the unit changes here. Not its status, not its release
      // decision, not its expiry. Lifting a hold returns the unit to whatever
      // it was before the hold, and if that was "not yet clinically released",
      // it still is.
      await this.custody.record(tx, {
        bloodUnitId: hold.bloodUnitId,
        organizationId,
        type: MovementType.HOLD_RESOLVED,
        fromStatus: hold.bloodUnit.status,
        toStatus: hold.bloodUnit.status,
        actorId,
        holdId,
        reason: `Hold ${hold.kind} resolved`,
      });

      return tx.bloodUnitHold.findUniqueOrThrow({ where: { id: holdId } });
    });

    await this.audit.log({
      actorId,
      action: 'BLOOD_UNIT_HOLD_RESOLVED',
      entityType: 'BloodUnit',
      entityId: hold.bloodUnitId,
      organizationId,
      metadata: {
        holdId,
        kind: hold.kind,
        // Said explicitly in the audit trail, because it is the property most
        // likely to be assumed the other way round by someone reading it later.
        clinicalReleaseUnchanged: true,
      },
      ipAddress,
    });

    return {
      data: {
        id: resolved.id,
        status: resolved.status,
        resolvedAt: resolved.resolvedAt,
        unitStatus: hold.bloodUnit.status,
        clinicalReleasedAt: hold.bloodUnit.clinicalReleasedAt,
      },
    };
  }

  /** Holds standing against the units of one organisation. */
  async list(organizationId: string, bloodUnitId?: string) {
    const holds = await this.db.bloodUnitHold.findMany({
      where: {
        organizationId,
        ...(bloodUnitId ? { bloodUnitId } : {}),
      },
      orderBy: { raisedAt: 'desc' },
      select: {
        id: true,
        bloodUnitId: true,
        kind: true,
        status: true,
        reasonCode: true,
        raisedAt: true,
        resolvedAt: true,
        // `reasonText` and `resolutionText` are deliberately absent from the
        // list projection: they are free text a clinician wrote, and a list
        // endpoint is the easiest place in a codebase for such a field to end
        // up somewhere nobody intended.
      },
    });

    return { data: holds };
  }
}
