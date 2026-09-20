import { Injectable } from '@nestjs/common';
import { BloodUnitStatus, MovementType, Prisma } from '@prisma/client';

/**
 * The one way a row enters the custody ledger.
 *
 * `InventoryMovement.sequence` is NOT NULL and unique per unit, which means
 * every write has to decide what position in that unit's history it occupies.
 * Leaving that decision at thirteen separate call sites would guarantee that
 * one of them eventually got it wrong, so it is made here and only here.
 *
 * Why the column exists at all: the ledger's only ordering was `createdAt`,
 * and Postgres fills that with transaction-start time. Every row written inside
 * one transaction therefore carried an identical timestamp, so a unit that was
 * reserved, picked and dispatched in one transaction produced three rows nobody
 * could put in order -- in the table whose entire job is saying what happened
 * in what order.
 *
 * Allocation is a read of the current maximum followed by an insert. Two
 * concurrent writers can read the same maximum; the unique index on
 * (bloodUnitId, sequence) is what makes that safe, turning a silent
 * duplicate-position into a constraint violation the caller's existing
 * `withUniqueRetry` can retry. In practice the contention is near zero, because
 * almost every caller already holds the unit's row via the conditional
 * `updateMany` claim that precedes it.
 */
export interface CustodyEntry {
  bloodUnitId: string;
  organizationId: string;
  type: MovementType;
  /** The lifecycle transition, when this movement records one. */
  fromStatus?: BloodUnitStatus | null;
  toStatus?: BloodUnitStatus | null;
  fromLocationId?: string | null;
  toLocationId?: string | null;
  actorId?: string | null;
  dispatchedBy?: string | null;
  receivedBy?: string | null;
  dispatchedAt?: Date | null;
  receivedAt?: Date | null;
  containerReference?: string | null;
  sealReference?: string | null;
  scanReference?: string | null;
  holdId?: string | null;
  coldChainEventId?: string | null;
  reason?: string | null;
  notes?: string | null;
}

@Injectable()
export class CustodyLedgerService {
  /**
   * Append one entry to a unit's history.
   *
   * Takes the transaction client rather than opening its own, because a custody
   * row that survives when the transition it describes was rolled back is worse
   * than no row at all.
   */
  async record(tx: Prisma.TransactionClient, entry: CustodyEntry) {
    const sequence = await this.nextSequence(tx, entry.bloodUnitId);

    return tx.inventoryMovement.create({
      data: {
        bloodUnitId: entry.bloodUnitId,
        organizationId: entry.organizationId,
        sequence,
        type: entry.type,
        fromStatus: entry.fromStatus ?? null,
        toStatus: entry.toStatus ?? null,
        fromLocationId: entry.fromLocationId ?? null,
        toLocationId: entry.toLocationId ?? null,
        actorId: entry.actorId ?? null,
        dispatchedBy: entry.dispatchedBy ?? null,
        receivedBy: entry.receivedBy ?? null,
        dispatchedAt: entry.dispatchedAt ?? null,
        receivedAt: entry.receivedAt ?? null,
        containerReference: entry.containerReference ?? null,
        sealReference: entry.sealReference ?? null,
        scanReference: entry.scanReference ?? null,
        holdId: entry.holdId ?? null,
        coldChainEventId: entry.coldChainEventId ?? null,
        reason: entry.reason ?? null,
        notes: entry.notes ?? null,
      },
    });
  }

  /**
   * The next free position in this unit's history.
   *
   * One past the highest already recorded, so history is dense and gapless for
   * a single writer. A gap would not be wrong -- the order is what matters --
   * but a gap is the kind of thing an investigator has to stop and account for,
   * and there is no reason to hand them one.
   */
  private async nextSequence(tx: Prisma.TransactionClient, bloodUnitId: string): Promise<number> {
    const highest = await tx.inventoryMovement.aggregate({
      where: { bloodUnitId },
      _max: { sequence: true },
    });

    return (highest._max.sequence ?? 0) + 1;
  }
}
