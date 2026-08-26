import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AlertType, BloodUnitStatus, MovementType, ReservationStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { InventoryService } from './inventory.service';

const LOW_STOCK_THRESHOLD = 5;
const EXPIRING_SOON_WINDOW_HOURS = 72;

@Injectable()
export class InventoryCronService {
  private readonly logger = new Logger(InventoryCronService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly audit: AuditLogsService,
    private readonly inventory: InventoryService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async runMaintenance(): Promise<void> {
    const expired = await this.expireUnits();
    const released = await this.releaseExpiredReservations();
    await this.checkStockLevels();

    if (expired > 0 || released > 0) {
      this.logger.log(`Inventory maintenance: ${expired} unit(s) expired, ${released} reservation(s) auto-released.`);
      await this.audit.log({
        action: 'INVENTORY_MAINTENANCE_RUN',
        entityType: 'BloodUnit',
        metadata: { unitsExpired: expired, reservationsReleased: released },
      });
    }
  }

  /** Transitions any unit past its expiresAt to EXPIRED and expires its active reservation, if any. Returns the count actually expired. */
  async expireUnits(): Promise<number> {
    const now = new Date();
    const expirable: BloodUnitStatus[] = [
      BloodUnitStatus.COLLECTED,
      BloodUnitStatus.AVAILABLE,
      BloodUnitStatus.RESERVED,
      BloodUnitStatus.QUARANTINED,
    ];

    const candidates = await this.db.bloodUnit.findMany({
      where: { status: { in: expirable }, expiresAt: { lt: now } },
      select: { id: true, organizationId: true, bloodType: true, rhFactor: true },
    });

    if (candidates.length === 0) return 0;

    let expiredCount = 0;
    const expiredByOrg = new Map<string, number>();

    for (const unit of candidates) {
      const didExpire = await this.db.$transaction(async (tx) => {
        // Atomic conditional update: a unit that changed status (e.g. got
        // issued) between the query above and now should not be overwritten.
        const claim = await tx.bloodUnit.updateMany({
          where: { id: unit.id, status: { in: expirable } },
          data: { status: BloodUnitStatus.EXPIRED },
        });
        if (claim.count === 0) return false;

        await tx.inventoryMovement.create({
          data: {
            bloodUnitId: unit.id,
            organizationId: unit.organizationId,
            type: MovementType.EXPIRED,
            reason: 'Automatic expiration - past expiresAt',
          },
        });

        await tx.bloodUnitReservation.updateMany({
          where: { bloodUnitId: unit.id, status: ReservationStatus.ACTIVE },
          data: { status: ReservationStatus.EXPIRED, releasedAt: new Date() },
        });

        return true;
      });

      if (didExpire) {
        expiredCount++;
        expiredByOrg.set(unit.organizationId, (expiredByOrg.get(unit.organizationId) ?? 0) + 1);
      }
    }

    for (const [organizationId, count] of expiredByOrg) {
      await this.inventory.ensureAlert(
        organizationId,
        AlertType.EXPIRED,
        `${count} blood unit(s) expired and were automatically removed from available inventory.`,
        null,
        null,
        count,
      );
    }

    return expiredCount;
  }

  /** Releases any ACTIVE reservation past its expiresAt back to AVAILABLE (unless the unit itself expired first). Returns the count released. */
  async releaseExpiredReservations(): Promise<number> {
    const now = new Date();

    const candidates = await this.db.bloodUnitReservation.findMany({
      where: { status: ReservationStatus.ACTIVE, expiresAt: { lt: now } },
      select: { id: true, bloodUnitId: true, organizationId: true },
    });

    if (candidates.length === 0) return 0;

    let releasedCount = 0;

    for (const reservation of candidates) {
      const didRelease = await this.db.$transaction(async (tx) => {
        const claim = await tx.bloodUnitReservation.updateMany({
          where: { id: reservation.id, status: ReservationStatus.ACTIVE },
          data: { status: ReservationStatus.EXPIRED, releasedAt: new Date() },
        });
        if (claim.count === 0) return false;

        // Only bounce the unit back to AVAILABLE if it's still RESERVED -
        // expireUnits() may have already moved it straight to EXPIRED.
        const unitClaim = await tx.bloodUnit.updateMany({
          where: { id: reservation.bloodUnitId, status: BloodUnitStatus.RESERVED },
          data: { status: BloodUnitStatus.AVAILABLE },
        });

        if (unitClaim.count > 0) {
          await tx.inventoryMovement.create({
            data: {
              bloodUnitId: reservation.bloodUnitId,
              organizationId: reservation.organizationId,
              type: MovementType.RELEASED,
              reason: 'Automatic release - reservation expired',
            },
          });
        }

        return true;
      });

      if (didRelease) releasedCount++;
    }

    return releasedCount;
  }

  /** Refreshes LOW_STOCK and EXPIRING_SOON alerts per organization/bloodType/rhFactor. */
  async checkStockLevels(): Promise<void> {
    const lowStockGroups = await this.db.bloodUnit.groupBy({
      by: ['organizationId', 'bloodType', 'rhFactor'],
      where: { status: BloodUnitStatus.AVAILABLE, organization: { type: 'BLOOD_CENTER', status: 'ACTIVE' } },
      _count: { _all: true },
    });

    for (const group of lowStockGroups) {
      if (group._count._all < LOW_STOCK_THRESHOLD) {
        await this.inventory.ensureAlert(
          group.organizationId,
          AlertType.LOW_STOCK,
          `Low stock: only ${group._count._all} unit(s) of ${group.bloodType}${group.rhFactor === 'POSITIVE' ? '+' : '-'} available.`,
          group.bloodType,
          group.rhFactor,
          group._count._all,
          LOW_STOCK_THRESHOLD,
        );
      }
    }

    const expiringCutoff = new Date(Date.now() + EXPIRING_SOON_WINDOW_HOURS * 60 * 60 * 1000);
    const expiringSoonGroups = await this.db.bloodUnit.groupBy({
      by: ['organizationId', 'bloodType', 'rhFactor'],
      where: {
        status: { in: [BloodUnitStatus.AVAILABLE, BloodUnitStatus.RESERVED] },
        expiresAt: { gt: new Date(), lte: expiringCutoff },
      },
      _count: { _all: true },
    });

    for (const group of expiringSoonGroups) {
      await this.inventory.ensureAlert(
        group.organizationId,
        AlertType.EXPIRING_SOON,
        `${group._count._all} unit(s) of ${group.bloodType}${group.rhFactor === 'POSITIVE' ? '+' : '-'} expiring within ${EXPIRING_SOON_WINDOW_HOURS / 24} days.`,
        group.bloodType,
        group.rhFactor,
        group._count._all,
      );
    }
  }
}
