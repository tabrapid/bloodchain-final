import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AlertType,
  BloodType,
  BloodUnitStatus,
  ComponentType,
  LocationType,
  MovementType,
  Prisma,
  ReservationStatus,
  RhFactor,
  RoleCode,
} from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  INVENTORY_ALERT_EVENT,
  type InventoryAlertPayload,
} from '../notifications/operational-notification.events';
import { assertOrganizationActive } from '../../common/utils/organization-status.util';
import { ClinicalReleaseService } from '../clinical-release/clinical-release.service';
import { CustodyLedgerService } from '../custody/custody-ledger.service';
import { DispositionType } from '@prisma/client';
import {
  AdjustUnitDto,
  CreateLocationDto,
  UpdateLocationDto,
  DiscardUnitDto,
  GetInventoryDto,
  GetMovementsDto,
  GetReservationsDto,
  IssueUnitDto,
  MoveUnitDto,
  QuarantineUnitDto,
  ReleaseReservationDto,
  ReleaseUnitDto,
  ReserveUnitDto,
} from './dto/inventory.dto';

@Injectable()
export class InventoryService {
  constructor(
    private readonly db: PrismaService,
    private readonly audit: AuditLogsService,
    private readonly eventEmitter: EventEmitter2,
    private readonly clinicalRelease: ClinicalReleaseService,
    private readonly custody: CustodyLedgerService,
  ) {}

  private generateUnitReference(): string {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 999999).toString().padStart(6, '0');
    return `BU-${year}-${random}`;
  }

  async getInventorySummary(organizationId: string, requestingUserId: string) {
    const user = await this.getAuthorizedUser(requestingUserId, organizationId);

    const [units, locations] = await Promise.all([
      this.db.bloodUnit.findMany({
        where: { organizationId },
      }),
      this.db.inventoryLocation.findMany({
        where: { organizationId, active: true },
      }),
    ]);

    const byStatus: Record<string, { count: number; volume: number }> = {};
    const byBloodType: Record<string, { count: number; volume: number }> = {};

    for (const unit of units) {
      const statusKey = unit.status;
      if (!byStatus[statusKey]) {
        byStatus[statusKey] = { count: 0, volume: 0 };
      }
      byStatus[statusKey].count++;
      byStatus[statusKey].volume += unit.volumeMl;

      const btKey = `${unit.bloodType}${unit.rhFactor === 'POSITIVE' ? '+' : '-'}`;
      if (!byBloodType[btKey]) {
        byBloodType[btKey] = { count: 0, volume: 0 };
      }
      byBloodType[btKey].count++;
      byBloodType[btKey].volume += unit.volumeMl;
    }

    return {
      data: {
        totalUnits: units.length,
        totalVolume: units.reduce((sum, u) => sum + u.volumeMl, 0),
        availableUnits: byStatus[BloodUnitStatus.AVAILABLE]?.count || 0,
        availableVolume: byStatus[BloodUnitStatus.AVAILABLE]?.volume || 0,
        reservedUnits: byStatus[BloodUnitStatus.RESERVED]?.count || 0,
        reservedVolume: byStatus[BloodUnitStatus.RESERVED]?.volume || 0,
        quarantinedUnits: byStatus[BloodUnitStatus.QUARANTINED]?.count || 0,
        quarantinedVolume: byStatus[BloodUnitStatus.QUARANTINED]?.volume || 0,
        usedUnits: byStatus[BloodUnitStatus.USED]?.count || 0,
        usedVolume: byStatus[BloodUnitStatus.USED]?.volume || 0,
        expiredUnits: byStatus[BloodUnitStatus.EXPIRED]?.count || 0,
        expiredVolume: byStatus[BloodUnitStatus.EXPIRED]?.volume || 0,
        discardedUnits: byStatus[BloodUnitStatus.DISCARDED]?.count || 0,
        discardedVolume: byStatus[BloodUnitStatus.DISCARDED]?.volume || 0,
        collectedUnits: byStatus[BloodUnitStatus.COLLECTED]?.count || 0,
        collectedVolume: byStatus[BloodUnitStatus.COLLECTED]?.volume || 0,
        byBloodType,
        locationCount: locations.length,
      },
    };
  }

  async getInventory(organizationId: string, requestingUserId: string, filters: GetInventoryDto) {
    await this.getAuthorizedUser(requestingUserId, organizationId);

    const page = Math.max(1, parseInt(filters.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(filters.limit || '20', 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.BloodUnitWhereInput = { organizationId };

    if (filters.bloodType) where.bloodType = filters.bloodType;
    if (filters.rhFactor) where.rhFactor = filters.rhFactor;
    if (filters.componentType) where.componentType = filters.componentType;
    if (filters.status) where.status = filters.status;
    if (filters.locationId) where.locationId = filters.locationId;

    if (filters.search) {
      where.OR = [
        { unitReference: { contains: filters.search, mode: 'insensitive' } },
        { donation: { donationReference: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }

    const [units, total] = await Promise.all([
      this.db.bloodUnit.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          location: { select: { id: true, name: true, code: true, type: true } },
          donation: { select: { donationReference: true } },
        },
      }),
      this.db.bloodUnit.count({ where }),
    ]);

    return {
      data: units.map((u) => ({
        id: u.id,
        unitReference: u.unitReference,
        bloodType: u.bloodType,
        rhFactor: u.rhFactor,
        componentType: u.componentType,
        volumeMl: u.volumeMl,
        status: u.status,
        location: u.location,
        collectedAt: u.collectedAt,
        expiresAt: u.expiresAt,
        donationReference: u.donation?.donationReference,
        createdAt: u.createdAt,
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getUnit(organizationId: string, unitId: string, requestingUserId: string) {
    await this.getAuthorizedUser(requestingUserId, organizationId);

    const unit = await this.db.bloodUnit.findFirst({
      where: { id: unitId, organizationId },
      include: {
        location: true,
        donation: {
          select: {
            id: true,
            donationReference: true,
            donor: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        organization: { select: { id: true, name: true } },
        movements: {
          orderBy: { createdAt: 'desc' },
          include: {
            fromLocation: { select: { id: true, name: true, code: true } },
            toLocation: { select: { id: true, name: true, code: true } },
            actor: { select: { firstName: true, lastName: true } },
          },
        },
        reservations: {
          orderBy: { createdAt: 'desc' },
          include: {
            reservedByUser: { select: { firstName: true, lastName: true } },
            reservedForOrganization: { select: { id: true, name: true } },
          },
        },
        releaseDecisions: {
          orderBy: { decidedAt: 'desc' },
          include: { decider: { select: { id: true, firstName: true, lastName: true } } },
        },
        disposition: true,
      },
    });

    if (!unit) {
      throw new NotFoundException('Blood unit not found.');
    }

    // Why this unit is not transfusable stock, computed once on the server.
    //
    // The console needs to say more than "not released": it needs the reason,
    // and it must not re-derive that reason from the policy in a component,
    // because two implementations of a safety rule are one too many.
    const clinicalRelease = this.clinicalRelease.isReleased(unit)
      ? {
          released: true as const,
          releasedAt: unit.clinicalReleasedAt,
          blockedReasonCode: null,
          blockedMessage: null,
          unmetRequirements: [] as string[],
        }
      : await this.describeReleaseBlock(unit);

    return { data: { ...unit, clinicalRelease } };
  }

  /** The refusal a release would produce right now, for display. Writes nothing. */
  private async describeReleaseBlock(unit: Parameters<ClinicalReleaseService['evaluate']>[0]) {
    const evaluation = await this.clinicalRelease.evaluate(unit);
    if (evaluation.permitted) {
      return {
        released: false as const,
        releasedAt: null,
        blockedReasonCode: null,
        blockedMessage: null,
        unmetRequirements: [] as string[],
      };
    }
    return {
      released: false as const,
      releasedAt: null,
      blockedReasonCode: evaluation.reasonCode,
      blockedMessage: evaluation.message,
      unmetRequirements: evaluation.unmetRequirements,
    };
  }

  /**
   * The whole chain for one unit, in one answer:
   *
   *   donor → donation → unit → movements → reservations → blood request
   *         → shipment → receiving organisation → final disposition
   *
   * Every link already existed in the schema; what did not exist was a way to
   * ask for them together. Assembling this in a console meant five round trips
   * and a client-side join, which is why nobody did, and why a look-back had to
   * be run by hand against the database.
   *
   * Where a link is genuinely absent the answer says so rather than omitting
   * it -- `recipient.reference` is null until the recipient identity question
   * (CL-03, PR-02) is answered, and a chain that quietly stopped at "issued"
   * would read as complete.
   */
  async getUnitTraceability(organizationId: string, unitId: string, requestingUserId: string) {
    await this.getAuthorizedUser(requestingUserId, organizationId);

    const unit = await this.db.bloodUnit.findFirst({
      where: { id: unitId, organizationId },
      include: {
        organization: { select: { id: true, name: true, type: true } },
        location: { select: { id: true, name: true, code: true } },
        donation: {
          include: {
            donor: { select: { id: true, firstName: true, lastName: true } },
            organization: { select: { id: true, name: true, type: true } },
            assessment: { select: { id: true, decision: true, assessedAt: true } },
          },
        },
        movements: {
          orderBy: { createdAt: 'asc' },
          include: {
            fromLocation: { select: { id: true, name: true, code: true } },
            toLocation: { select: { id: true, name: true, code: true } },
            actor: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        reservations: {
          orderBy: { createdAt: 'asc' },
          include: {
            reservedForOrganization: { select: { id: true, name: true, type: true } },
            bloodRequestItems: {
              include: {
                bloodRequest: {
                  select: {
                    id: true,
                    requestReference: true,
                    status: true,
                    requestingOrganization: { select: { id: true, name: true, type: true } },
                  },
                },
              },
            },
          },
        },
        shipmentUnits: {
          orderBy: { createdAt: 'asc' },
          include: {
            shipment: {
              select: {
                id: true,
                shipmentReference: true,
                status: true,
                deliveredAt: true,
                sourceOrganization: { select: { id: true, name: true, type: true } },
                destinationOrganization: { select: { id: true, name: true, type: true } },
              },
            },
          },
        },
        releaseDecisions: {
          orderBy: { decidedAt: 'asc' },
          include: { decider: { select: { id: true, firstName: true, lastName: true } } },
        },
        disposition: {
          include: {
            recorder: { select: { id: true, firstName: true, lastName: true } },
            bloodRequest: { select: { id: true, requestReference: true } },
            shipment: { select: { id: true, shipmentReference: true } },
          },
        },
      },
    });

    if (!unit) {
      throw new NotFoundException('Blood unit not found.');
    }

    const bloodRequests = unit.reservations
      .flatMap((reservation) => reservation.bloodRequestItems)
      .map((item) => item.bloodRequest)
      .filter((request, index, all) => all.findIndex((r) => r.id === request.id) === index);

    return {
      data: {
        unit: {
          id: unit.id,
          unitReference: unit.unitReference,
          componentType: unit.componentType,
          status: unit.status,
          volumeMl: unit.volumeMl,
          collectedAt: unit.collectedAt,
          organization: unit.organization,
          location: unit.location,
        },
        bloodGroup: {
          bloodType: unit.bloodType,
          rhFactor: unit.rhFactor,
          /**
           * Never presented as a result for this unit. DONOR_PROFILE_COPY means
           * the donor's record said this; it does not mean the bag was typed.
           */
          provenance: unit.bloodGroupSource,
          provenanceNote: unit.bloodGroupSourceNote,
          typedFromUnit: unit.bloodGroupSource === 'UNIT_TYPED',
        },
        expiry: {
          expiresAt: unit.expiresAt,
          provenance: unit.expirySource,
          known: unit.expiresAt !== null && unit.expirySource !== 'UNKNOWN',
        },
        donor: unit.donation.donor,
        donation: {
          id: unit.donation.id,
          donationReference: unit.donation.donationReference,
          status: unit.donation.status,
          collectedAt: unit.donation.collectionCompletedAt,
          organization: unit.donation.organization,
          assessment: unit.donation.assessment,
        },
        clinicalRelease: {
          released: unit.clinicalReleasedAt !== null,
          releasedAt: unit.clinicalReleasedAt,
          decisions: unit.releaseDecisions,
        },
        movements: unit.movements,
        reservations: unit.reservations.map((reservation) => ({
          id: reservation.id,
          status: reservation.status,
          reservedAt: reservation.reservedAt,
          releasedAt: reservation.releasedAt,
          fulfilledAt: reservation.fulfilledAt,
          reservedForOrganization: reservation.reservedForOrganization,
        })),
        bloodRequests,
        shipments: unit.shipmentUnits.map((shipmentUnit) => ({
          id: shipmentUnit.shipment.id,
          shipmentReference: shipmentUnit.shipment.shipmentReference,
          status: shipmentUnit.shipment.status,
          deliveredAt: shipmentUnit.shipment.deliveredAt,
          unitStatus: shipmentUnit.status,
          fromOrganization: shipmentUnit.shipment.sourceOrganization,
          toOrganization: shipmentUnit.shipment.destinationOrganization,
        })),
        receivingOrganizations: unit.shipmentUnits
          .map((shipmentUnit) => shipmentUnit.shipment.destinationOrganization)
          .filter((org, index, all) => all.findIndex((o) => o.id === org.id) === index),
        disposition: unit.disposition
          ? {
              type: unit.disposition.type,
              occurredAt: unit.disposition.occurredAt,
              recordedBy: unit.disposition.recorder,
              bloodRequest: unit.disposition.bloodRequest,
              shipment: unit.disposition.shipment,
              notes: unit.disposition.notes,
              recipient: {
                /**
                 * Opaque, and null until somebody decides what identifies a
                 * recipient here. The chain says so rather than ending at
                 * "issued" as though that were the whole story.
                 */
                reference: unit.disposition.recipientReference,
                identityPolicy: 'UNDEFINED',
              },
            }
          : null,
      },
    };
  }

  /** The policy in force for this organisation, for the console header. */
  async getClinicalReleasePolicyStatus(organizationId: string, requestingUserId: string) {
    await this.getAuthorizedUser(requestingUserId, organizationId);
    return { data: await this.clinicalRelease.getPolicyStatus(organizationId) };
  }

  /** Units collected or quarantined here that are waiting on a release decision. */
  async getUnitsAwaitingRelease(organizationId: string, requestingUserId: string) {
    await this.getAuthorizedUser(requestingUserId, organizationId);

    const units = await this.db.bloodUnit.findMany({
      where: {
        organizationId,
        clinicalReleasedAt: null,
        status: { in: [BloodUnitStatus.COLLECTED, BloodUnitStatus.QUARANTINED] },
      },
      orderBy: { collectedAt: 'asc' },
      include: { donation: { select: { donationReference: true } } },
    });

    const policyStatus = await this.clinicalRelease.getPolicyStatus(organizationId);

    return {
      data: {
        policy: policyStatus,
        units: units.map((unit) => ({
          id: unit.id,
          unitReference: unit.unitReference,
          componentType: unit.componentType,
          bloodType: unit.bloodType,
          rhFactor: unit.rhFactor,
          status: unit.status,
          collectedAt: unit.collectedAt,
          donationReference: unit.donation.donationReference,
          bloodGroupProvenance: unit.bloodGroupSource,
          expiryKnown: unit.expiresAt !== null && unit.expirySource !== 'UNKNOWN',
        })),
      },
    };
  }

  async releaseUnit(
    organizationId: string,
    unitId: string,
    requestingUserId: string,
    dto: ReleaseUnitDto,
    ipAddress?: string,
  ) {
    const unit = await this.getAuthorizedUnit(unitId, organizationId);

    if (unit.status !== BloodUnitStatus.COLLECTED && unit.status !== BloodUnitStatus.QUARANTINED) {
      throw new BadRequestException(`Cannot release unit with status ${unit.status}. Only COLLECTED or QUARANTINED units can be released.`);
    }

    // The clinical gate. Asked before the status transition and with no regard
    // for who is asking: there is no role, flag or parameter that skips it, and
    // no force-release route anywhere in this controller. A SUPER_ADMIN gets
    // the same answer as a porter.
    //
    // A refusal is recorded as a ReleaseDecision before it is thrown, because
    // "the system would not let us release this unit, and why" is the first
    // question an incident review asks, and an unrecorded refusal is
    // indistinguishable from nobody having tried.
    const evaluation = await this.clinicalRelease.evaluate(unit);

    if (!evaluation.permitted) {
      await this.db.$transaction((tx) =>
        this.clinicalRelease.recordDecision(tx, {
          unitId,
          organizationId,
          evaluation,
          decidedBy: requestingUserId,
        }),
      );

      await this.audit.log({
        actorId: requestingUserId,
        action: 'BLOOD_UNIT_RELEASE_REFUSED',
        entityType: 'BloodUnit',
        entityId: unitId,
        organizationId,
        metadata: {
          unitReference: unit.unitReference,
          reasonCode: evaluation.reasonCode,
          policyId: evaluation.policyId,
          policyVersion: evaluation.policyVersion,
          policyKind: evaluation.policyKind,
          unmetRequirements: evaluation.unmetRequirements,
        },
        ipAddress,
      });

      throw this.clinicalRelease.refusalException(evaluation);
    }

    const result = await this.db.$transaction(async (tx) => {
      // Atomic conditional update: only succeeds if the unit is still in an
      // allowed status at the moment Postgres acquires the row lock, closing
      // the race window between the pre-check above and this transaction.
      const claim = await tx.bloodUnit.updateMany({
        where: { id: unitId, status: { in: [BloodUnitStatus.COLLECTED, BloodUnitStatus.QUARANTINED] } },
        data: {
          status: BloodUnitStatus.AVAILABLE,
          // Written in the same statement as the status, so a unit cannot be
          // AVAILABLE without carrying the decision that made it so.
          clinicalReleasedAt: new Date(),
          expiresAt: evaluation.expiresAt,
          expirySource: evaluation.expirySource,
        },
      });

      if (claim.count === 0) {
        const current = await tx.bloodUnit.findUnique({ where: { id: unitId }, select: { status: true } });
        throw new ConflictException(
          `Cannot release unit with status ${current?.status ?? 'UNKNOWN'}. Only COLLECTED or QUARANTINED units can be released.`,
        );
      }

      const updated = await tx.bloodUnit.findUniqueOrThrow({ where: { id: unitId } });

      await this.clinicalRelease.recordDecision(tx, {
        unitId,
        organizationId,
        evaluation,
        decidedBy: requestingUserId,
      });

      await this.custody.record(tx, {
        bloodUnitId: unitId,
        organizationId,
        type: MovementType.RELEASED,
        actorId: requestingUserId,
        reason: dto.reason,
      });

      return updated;
    });

    await this.audit.log({
      actorId: requestingUserId,
      action: 'BLOOD_UNIT_RELEASED',
      entityType: 'BloodUnit',
      entityId: unitId,
      organizationId,
      metadata: {
        unitReference: unit.unitReference,
        status: result.status,
        policyId: evaluation.policyId,
        policyVersion: evaluation.policyVersion,
        policyKind: evaluation.policyKind,
        // Carried into the audit trail so a development clearance is never
        // mistaken for a clinical one when the log is read back.
        developmentOnly: evaluation.developmentOnly,
        expiresAt: result.expiresAt?.toISOString() ?? null,
        expirySource: result.expirySource,
      },
      ipAddress,
    });

    return {
      data: {
        id: result.id,
        status: result.status,
        unitReference: result.unitReference,
        clinicalReleasedAt: result.clinicalReleasedAt,
        expiresAt: result.expiresAt,
        expirySource: result.expirySource,
        releasePolicyVersion: evaluation.policyVersion,
        releasePolicyKind: evaluation.policyKind,
        developmentOnly: evaluation.developmentOnly,
      },
    };
  }

  async quarantineUnit(
    organizationId: string,
    unitId: string,
    requestingUserId: string,
    dto: QuarantineUnitDto,
    ipAddress?: string,
  ) {
    const unit = await this.getAuthorizedUnit(unitId, organizationId);

    if (unit.status !== BloodUnitStatus.AVAILABLE && unit.status !== BloodUnitStatus.COLLECTED) {
      throw new BadRequestException(`Cannot quarantine unit with status ${unit.status}.`);
    }

    const result = await this.db.$transaction(async (tx) => {
      // Atomic conditional update: closes the race window between the
      // pre-check above and this transaction.
      const claim = await tx.bloodUnit.updateMany({
        where: { id: unitId, status: { in: [BloodUnitStatus.AVAILABLE, BloodUnitStatus.COLLECTED] } },
        data: { status: BloodUnitStatus.QUARANTINED },
      });

      if (claim.count === 0) {
        const current = await tx.bloodUnit.findUnique({ where: { id: unitId }, select: { status: true } });
        throw new ConflictException(`Cannot quarantine unit with status ${current?.status ?? 'UNKNOWN'}.`);
      }

      const updated = await tx.bloodUnit.findUniqueOrThrow({ where: { id: unitId } });

      await this.custody.record(tx, {
        bloodUnitId: unitId,
        organizationId,
        type: MovementType.QUARANTINED,
        actorId: requestingUserId,
        reason: dto.reason,
      });

      return updated;
    });

    await this.audit.log({
      actorId: requestingUserId,
      action: 'BLOOD_UNIT_QUARANTINED',
      entityType: 'BloodUnit',
      entityId: unitId,
      organizationId,
      metadata: { unitReference: unit.unitReference, reason: dto.reason },
      ipAddress,
    });

    const quarantinedCount = await this.db.bloodUnit.count({
      where: { organizationId, bloodType: unit.bloodType, rhFactor: unit.rhFactor, status: BloodUnitStatus.QUARANTINED },
    });
    await this.ensureAlert(
      organizationId,
      AlertType.QUARANTINED,
      `${quarantinedCount} unit(s) of ${unit.bloodType}${unit.rhFactor === 'POSITIVE' ? '+' : '-'} in quarantine.`,
      unit.bloodType,
      unit.rhFactor,
      quarantinedCount,
    );

    return { data: { id: result.id, status: result.status, unitReference: result.unitReference } };
  }

  async discardUnit(
    organizationId: string,
    unitId: string,
    requestingUserId: string,
    dto: DiscardUnitDto,
    ipAddress?: string,
  ) {
    const unit = await this.getAuthorizedUnit(unitId, organizationId);

    if (unit.status === BloodUnitStatus.USED) {
      throw new BadRequestException('Cannot discard a unit that has been used.');
    }

    const result = await this.db.$transaction(async (tx) => {
      // Atomic conditional update: closes the race window between the
      // pre-check above and this transaction.
      const claim = await tx.bloodUnit.updateMany({
        where: { id: unitId, status: { not: BloodUnitStatus.USED } },
        data: { status: BloodUnitStatus.DISCARDED },
      });

      if (claim.count === 0) {
        throw new ConflictException('Cannot discard a unit that has been used.');
      }

      const updated = await tx.bloodUnit.findUniqueOrThrow({ where: { id: unitId } });

      await this.custody.record(tx, {
        bloodUnitId: unitId,
        organizationId,
        type: MovementType.DISCARDED,
        actorId: requestingUserId,
        reason: dto.reason,
      });

      await this.recordDisposition(tx, {
        unitId,
        organizationId,
        type: DispositionType.DISCARDED,
        recordedBy: requestingUserId,
        recipientReference: null,
        notes: dto.reason ?? null,
      });

      return updated;
    });

    await this.audit.log({
      actorId: requestingUserId,
      action: 'BLOOD_UNIT_DISCARDED',
      entityType: 'BloodUnit',
      entityId: unitId,
      organizationId,
      metadata: { unitReference: unit.unitReference, reason: dto.reason },
      ipAddress,
    });

    return { data: { id: result.id, status: result.status, unitReference: result.unitReference } };
  }

  async issueUnit(
    organizationId: string,
    unitId: string,
    requestingUserId: string,
    dto: IssueUnitDto,
    ipAddress?: string,
  ) {
    const unit = await this.getAuthorizedUnit(unitId, organizationId);

    if (unit.status !== BloodUnitStatus.AVAILABLE && unit.status !== BloodUnitStatus.RESERVED) {
      throw new BadRequestException(`Cannot issue unit with status ${unit.status}. Only AVAILABLE or RESERVED units can be issued.`);
    }

    // The last point at which software can still refuse. Everything after this
    // call is a bag leaving the fridge.
    this.clinicalRelease.assertReleased(unit);

    const result = await this.db.$transaction(async (tx) => {
      // Atomic conditional update: closes the race window between the
      // pre-check above and this transaction.
      const claim = await tx.bloodUnit.updateMany({
        where: { id: unitId, status: { in: [BloodUnitStatus.AVAILABLE, BloodUnitStatus.RESERVED] } },
        data: { status: BloodUnitStatus.USED },
      });

      if (claim.count === 0) {
        const current = await tx.bloodUnit.findUnique({ where: { id: unitId }, select: { status: true } });
        throw new ConflictException(
          `Cannot issue unit with status ${current?.status ?? 'UNKNOWN'}. Only AVAILABLE or RESERVED units can be issued.`,
        );
      }

      const updated = await tx.bloodUnit.findUniqueOrThrow({ where: { id: unitId } });

      await this.custody.record(tx, {
        bloodUnitId: unitId,
        organizationId,
        type: MovementType.USED,
        actorId: requestingUserId,
        reason: dto.reason,
      });

      // Issuing a reserved unit fulfills whatever reservation was holding it.
      await tx.bloodUnitReservation.updateMany({
        where: { bloodUnitId: unitId, status: ReservationStatus.ACTIVE },
        data: { status: ReservationStatus.FULFILLED, fulfilledAt: new Date() },
      });

      // The end of the traceability chain, as a row rather than as a movement
      // reason. `MovementType.USED` records that the unit left; it does not
      // record where it went, and a look-back cannot be run against prose.
      await this.recordDisposition(tx, {
        unitId,
        organizationId,
        type: DispositionType.ISSUED,
        recordedBy: requestingUserId,
        recipientReference: dto.recipientReference ?? null,
        notes: dto.reason ?? null,
      });

      return updated;
    });

    await this.audit.log({
      actorId: requestingUserId,
      action: 'BLOOD_UNIT_ISSUED',
      entityType: 'BloodUnit',
      entityId: unitId,
      organizationId,
      metadata: { unitReference: unit.unitReference, reason: dto.reason },
      ipAddress,
    });

    return { data: { id: result.id, status: result.status, unitReference: result.unitReference } };
  }

  async adjustUnit(
    organizationId: string,
    unitId: string,
    requestingUserId: string,
    dto: AdjustUnitDto,
    ipAddress?: string,
  ) {
    const unit = await this.getAuthorizedUnit(unitId, organizationId);

    const terminalStatuses: BloodUnitStatus[] = [
      BloodUnitStatus.USED,
      BloodUnitStatus.DISCARDED,
      BloodUnitStatus.EXPIRED,
    ];
    if (terminalStatuses.includes(unit.status)) {
      throw new BadRequestException(`Cannot adjust a unit with status ${unit.status}.`);
    }

    if (dto.volumeMl === undefined && dto.componentType === undefined && dto.expiresAt === undefined) {
      throw new BadRequestException('At least one field (volumeMl, componentType, expiresAt) must be provided.');
    }

    const data: Prisma.BloodUnitUpdateInput = {};
    if (dto.volumeMl !== undefined) data.volumeMl = dto.volumeMl;
    if (dto.componentType !== undefined) data.componentType = dto.componentType;
    if (dto.expiresAt !== undefined) data.expiresAt = new Date(dto.expiresAt);

    const result = await this.db.$transaction(async (tx) => {
      // Atomic conditional update: closes the race window between the
      // pre-check above and this transaction - a unit that left the
      // adjustable state (e.g. got issued) between the check and now
      // should not have its data silently rewritten.
      const claim = await tx.bloodUnit.updateMany({
        where: { id: unitId, status: { notIn: terminalStatuses } },
        data,
      });

      if (claim.count === 0) {
        const current = await tx.bloodUnit.findUnique({ where: { id: unitId }, select: { status: true } });
        throw new ConflictException(`Cannot adjust a unit with status ${current?.status ?? 'UNKNOWN'}.`);
      }

      const updated = await tx.bloodUnit.findUniqueOrThrow({ where: { id: unitId } });

      await this.custody.record(tx, {
        bloodUnitId: unitId,
        organizationId,
        type: MovementType.ADJUSTED,
        actorId: requestingUserId,
        reason: dto.reason,
      });

      return updated;
    });

    await this.audit.log({
      actorId: requestingUserId,
      action: 'BLOOD_UNIT_ADJUSTED',
      entityType: 'BloodUnit',
      entityId: unitId,
      organizationId,
      metadata: {
        unitReference: unit.unitReference,
        reason: dto.reason,
        changes: {
          volumeMl: dto.volumeMl !== undefined ? { from: unit.volumeMl, to: dto.volumeMl } : undefined,
          componentType: dto.componentType !== undefined ? { from: unit.componentType, to: dto.componentType } : undefined,
          expiresAt: dto.expiresAt !== undefined ? { from: unit.expiresAt, to: dto.expiresAt } : undefined,
        },
      },
      ipAddress,
    });

    return {
      data: {
        id: result.id,
        status: result.status,
        unitReference: result.unitReference,
        volumeMl: result.volumeMl,
        componentType: result.componentType,
        expiresAt: result.expiresAt,
      },
    };
  }

  async moveUnit(
    organizationId: string,
    unitId: string,
    requestingUserId: string,
    dto: MoveUnitDto,
    ipAddress?: string,
  ) {
    const unit = await this.getAuthorizedUnit(unitId, organizationId);

    if (unit.status === BloodUnitStatus.USED || unit.status === BloodUnitStatus.DISCARDED || unit.status === BloodUnitStatus.EXPIRED) {
      throw new BadRequestException(`Cannot move unit with status ${unit.status}.`);
    }

    const location = await this.db.inventoryLocation.findFirst({
      where: { id: dto.toLocationId, organizationId, active: true },
    });

    if (!location) {
      throw new NotFoundException('Location not found or inactive.');
    }

    const result = await this.db.$transaction(async (tx) => {
      // Atomic conditional update: closes the race window between the
      // pre-check above and this transaction (e.g. the unit was discarded
      // or used by a concurrent request just before this move lands).
      const claim = await tx.bloodUnit.updateMany({
        where: {
          id: unitId,
          status: { notIn: [BloodUnitStatus.USED, BloodUnitStatus.DISCARDED, BloodUnitStatus.EXPIRED] },
        },
        data: { locationId: dto.toLocationId },
      });

      if (claim.count === 0) {
        const current = await tx.bloodUnit.findUnique({ where: { id: unitId }, select: { status: true } });
        throw new ConflictException(`Cannot move unit with status ${current?.status ?? 'UNKNOWN'}.`);
      }

      const updated = await tx.bloodUnit.findUniqueOrThrow({ where: { id: unitId } });

      await this.custody.record(tx, {
        bloodUnitId: unitId,
        organizationId,
        fromLocationId: unit.locationId,
        toLocationId: dto.toLocationId,
        type: MovementType.MOVED,
        actorId: requestingUserId,
        reason: dto.reason,
      });

      return updated;
    });

    await this.audit.log({
      actorId: requestingUserId,
      action: 'BLOOD_UNIT_MOVED',
      entityType: 'BloodUnit',
      entityId: unitId,
      organizationId,
      metadata: { unitReference: unit.unitReference, toLocationId: dto.toLocationId, reason: dto.reason },
      ipAddress,
    });

    return { data: { id: result.id, locationId: result.locationId, unitReference: result.unitReference } };
  }

  async reserveUnit(
    organizationId: string,
    unitId: string,
    requestingUserId: string,
    dto: ReserveUnitDto,
    ipAddress?: string,
  ) {
    const unit = await this.getAuthorizedUnit(unitId, organizationId);

    if (unit.status !== BloodUnitStatus.AVAILABLE) {
      throw new ConflictException('UNIT_NOT_AVAILABLE: Only AVAILABLE units can be reserved.');
    }

    // AVAILABLE is meant to imply a release decision, and after this sprint it
    // does for every unit released through the gate. This check is what makes
    // that an invariant rather than an assumption: units that reached AVAILABLE
    // before the gate existed carry no decision, and a reservation is the step
    // that commits one to a patient.
    this.clinicalRelease.assertReleased(unit);

    const activeReservation = await this.db.bloodUnitReservation.findFirst({
      where: { bloodUnitId: unitId, status: ReservationStatus.ACTIVE },
    });

    if (activeReservation) {
      throw new ConflictException('UNIT_ALREADY_RESERVED: This unit already has an active reservation.');
    }

    const result = await this.db.$transaction(async (tx) => {
      // Atomic conditional update: only succeeds if the unit is still AVAILABLE
      // at the moment Postgres acquires the row lock, closing the race window
      // between the pre-check above and this transaction.
      const { count } = await tx.bloodUnit.updateMany({
        where: { id: unitId, status: BloodUnitStatus.AVAILABLE },
        data: { status: BloodUnitStatus.RESERVED },
      });

      if (count === 0) {
        throw new ConflictException('UNIT_NOT_AVAILABLE: Only AVAILABLE units can be reserved.');
      }

      const updated = await tx.bloodUnit.findUniqueOrThrow({ where: { id: unitId } });

      const reservation = await tx.bloodUnitReservation.create({
        data: {
          bloodUnitId: unitId,
          organizationId,
          reservedForOrganizationId: dto.reservedForOrganizationId,
          reservedBy: requestingUserId,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
          reason: dto.reason,
        },
      });

      await this.custody.record(tx, {
        bloodUnitId: unitId,
        organizationId,
        type: MovementType.RESERVED,
        actorId: requestingUserId,
        reason: dto.reason,
      });

      return { unit: updated, reservation };
    });

    await this.audit.log({
      actorId: requestingUserId,
      action: 'BLOOD_UNIT_RESERVED',
      entityType: 'BloodUnit',
      entityId: unitId,
      organizationId,
      metadata: { unitReference: unit.unitReference, reservationId: result.reservation.id },
      ipAddress,
    });

    return { data: { id: result.unit.id, status: result.unit.status, reservationId: result.reservation.id } };
  }

  async releaseReservation(
    organizationId: string,
    reservationId: string,
    requestingUserId: string,
    dto: ReleaseReservationDto,
    ipAddress?: string,
  ) {
    const reservation = await this.db.bloodUnitReservation.findFirst({
      where: { id: reservationId, organizationId, status: ReservationStatus.ACTIVE },
      include: { bloodUnit: true, organization: true },
    });

    if (!reservation) {
      throw new NotFoundException('Active reservation not found.');
    }

    assertOrganizationActive(reservation.organization);

    const result = await this.db.$transaction(async (tx) => {
      // Releasing a reservation puts the unit back into available stock, which
      // makes this one of the paths a hold has to be able to stop.
      //
      // It used to be an unconditional `update`: whatever the unit's status, and
      // whatever stood against it, it came back AVAILABLE. That is how a held
      // unit re-entered usable inventory without anything consulting the gate.
      // It is a conditional claim now, with the hold predicate inside the
      // where-clause rather than checked beside it, so the check and the write
      // are one statement and a hold raised concurrently still wins.
      const { count } = await tx.bloodUnit.updateMany({
        where: {
          id: reservation.bloodUnitId,
          status: BloodUnitStatus.RESERVED,
          ...ClinicalReleaseService.NO_ACTIVE_HOLD,
        },
        data: { status: BloodUnitStatus.AVAILABLE },
      });

      if (count === 0) {
        // Either the unit moved on under us, or a hold stands. Ask the gate
        // which, so the caller gets the specific refusal rather than a generic
        // conflict -- and so a held unit is never silently left reserved.
        await this.clinicalRelease.assertNotHeld(tx, reservation.bloodUnitId, reservation.bloodUnit.unitReference);

        throw new ConflictException(
          'This reservation could not be released because the unit is no longer reserved.',
        );
      }

      const updated = await tx.bloodUnit.findUniqueOrThrow({
        where: { id: reservation.bloodUnitId },
      });

      await tx.bloodUnitReservation.update({
        where: { id: reservationId },
        data: {
          status: ReservationStatus.RELEASED,
          releasedAt: new Date(),
        },
      });

      await this.custody.record(tx, {
        bloodUnitId: reservation.bloodUnitId,
        organizationId,
        type: MovementType.RELEASED,
        fromStatus: BloodUnitStatus.RESERVED,
        toStatus: BloodUnitStatus.AVAILABLE,
        actorId: requestingUserId,
        reason: dto.reason,
      });

      return updated;
    });

    await this.audit.log({
      actorId: requestingUserId,
      action: 'BLOOD_UNIT_RESERVATION_RELEASED',
      entityType: 'BloodUnit',
      entityId: reservation.bloodUnitId,
      organizationId,
      metadata: { reservationId, unitReference: result.unitReference },
      ipAddress,
    });

    return { data: { id: result.id, status: result.status, unitReference: result.unitReference } };
  }

  async getLocations(organizationId: string, requestingUserId: string) {
    await this.getAuthorizedUser(requestingUserId, organizationId);

    const locations = await this.db.inventoryLocation.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'asc' },
      include: {
        _count: { select: { bloodUnits: true } },
      },
    });

    return {
      data: locations.map((loc) => ({
        id: loc.id,
        name: loc.name,
        code: loc.code,
        type: loc.type,
        active: loc.active,
        unitCount: loc._count.bloodUnits,
        createdAt: loc.createdAt,
      })),
    };
  }

  async createLocation(
    organizationId: string,
    requestingUserId: string,
    dto: { name: string; code: string; type?: LocationType },
    ipAddress?: string,
  ) {
    await this.getAuthorizedUser(requestingUserId, organizationId);

    const existing = await this.db.inventoryLocation.findFirst({
      where: { organizationId, code: dto.code },
    });

    if (existing) {
      throw new ConflictException('A location with this code already exists.');
    }

    const location = await this.db.inventoryLocation.create({
      data: {
        organizationId,
        name: dto.name,
        code: dto.code,
        type: dto.type || LocationType.STORAGE,
      },
    });

    await this.audit.log({
      actorId: requestingUserId,
      action: 'INVENTORY_LOCATION_CREATED',
      entityType: 'InventoryLocation',
      entityId: location.id,
      organizationId,
      metadata: { name: dto.name, code: dto.code },
      ipAddress,
    });

    return { data: location };
  }

  async updateLocation(
    organizationId: string,
    locationId: string,
    requestingUserId: string,
    dto: UpdateLocationDto,
    ipAddress?: string,
  ) {
    await this.getAuthorizedUser(requestingUserId, organizationId);

    const location = await this.db.inventoryLocation.findFirst({
      where: { id: locationId, organizationId },
    });

    if (!location) {
      throw new NotFoundException('Location not found.');
    }

    const updated = await this.db.inventoryLocation.update({
      where: { id: locationId },
      data: {
        name: dto.name,
        active: dto.active,
      },
    });

    await this.audit.log({
      actorId: requestingUserId,
      action: 'INVENTORY_LOCATION_UPDATED',
      entityType: 'InventoryLocation',
      entityId: locationId,
      organizationId,
      metadata: { name: dto.name, active: dto.active },
      ipAddress,
    });

    return { data: updated };
  }

  async getMovements(organizationId: string, requestingUserId: string, filters: GetMovementsDto) {
    await this.getAuthorizedUser(requestingUserId, organizationId);

    const page = Math.max(1, parseInt(filters.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(filters.limit || '20', 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.InventoryMovementWhereInput = { organizationId };
    if (filters.type) where.type = filters.type;
    if (filters.bloodUnitId) where.bloodUnitId = filters.bloodUnitId;

    const [movements, total] = await Promise.all([
      this.db.inventoryMovement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          bloodUnit: { select: { id: true, unitReference: true } },
          fromLocation: { select: { id: true, name: true, code: true } },
          toLocation: { select: { id: true, name: true, code: true } },
          actor: { select: { firstName: true, lastName: true } },
        },
      }),
      this.db.inventoryMovement.count({ where }),
    ]);

    return {
      data: movements,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getReservations(organizationId: string, requestingUserId: string, filters: GetReservationsDto) {
    await this.getAuthorizedUser(requestingUserId, organizationId);

    const page = Math.max(1, parseInt(filters.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(filters.limit || '20', 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.BloodUnitReservationWhereInput = { organizationId };
    if (filters.status) where.status = filters.status;

    const [reservations, total] = await Promise.all([
      this.db.bloodUnitReservation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          bloodUnit: {
            select: { id: true, unitReference: true, bloodType: true, rhFactor: true, volumeMl: true },
          },
          reservedByUser: { select: { firstName: true, lastName: true } },
          reservedForOrganization: { select: { id: true, name: true } },
        },
      }),
      this.db.bloodUnitReservation.count({ where }),
    ]);

    return {
      data: reservations,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getAlerts(organizationId: string, requestingUserId: string) {
    await this.getAuthorizedUser(requestingUserId, organizationId);

    const alerts = await this.db.inventoryAlert.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });

    return { data: alerts };
  }

  async acknowledgeAlert(
    organizationId: string,
    alertId: string,
    requestingUserId: string,
    ipAddress?: string,
  ) {
    await this.getAuthorizedUser(requestingUserId, organizationId);

    const alert = await this.db.inventoryAlert.findFirst({
      where: { id: alertId, organizationId },
    });

    if (!alert) {
      throw new NotFoundException('Alert not found.');
    }

    const updated = await this.db.inventoryAlert.update({
      where: { id: alertId },
      data: {
        acknowledged: true,
        acknowledgedAt: new Date(),
        acknowledgedBy: requestingUserId,
      },
    });

    await this.audit.log({
      actorId: requestingUserId,
      action: 'INVENTORY_ALERT_ACKNOWLEDGED',
      entityType: 'InventoryAlert',
      entityId: alertId,
      organizationId,
      ipAddress,
    });

    return { data: updated };
  }

  async getBloodAvailability(
    requestingUserId: string,
    filters: { bloodType?: BloodType; rhFactor?: RhFactor; componentType?: ComponentType },
  ) {
    const user = await this.db.user.findUnique({ where: { id: requestingUserId } });
    if (!user) {
      throw new ForbiddenException('Access denied.');
    }

    // Availability is a cross-organization view: any authenticated hospital
    // user may see aggregate stock at any active blood center, not just ones
    // they belong to. Individual unit identifiers and storage locations are
    // intentionally excluded - only type, component and quantity are exposed.
    const where: Prisma.BloodUnitWhereInput = {
      status: BloodUnitStatus.AVAILABLE,
      organization: { type: 'BLOOD_CENTER', status: 'ACTIVE' },
    };

    if (filters.bloodType) where.bloodType = filters.bloodType;
    if (filters.rhFactor) where.rhFactor = filters.rhFactor;
    if (filters.componentType) where.componentType = filters.componentType;

    const units = await this.db.bloodUnit.findMany({
      where,
      select: {
        organizationId: true,
        bloodType: true,
        rhFactor: true,
        componentType: true,
        volumeMl: true,
        organization: { select: { id: true, name: true } },
      },
    });

    const grouped: Record<
      string,
      {
        organization: { id: string; name: string };
        bloodType: BloodType;
        rhFactor: RhFactor;
        componentType: ComponentType;
        totalUnits: number;
        totalVolumeMl: number;
      }
    > = {};

    for (const unit of units) {
      const key = `${unit.organizationId}:${unit.bloodType}:${unit.rhFactor}:${unit.componentType}`;
      if (!grouped[key]) {
        grouped[key] = {
          organization: unit.organization,
          bloodType: unit.bloodType,
          rhFactor: unit.rhFactor,
          componentType: unit.componentType,
          totalUnits: 0,
          totalVolumeMl: 0,
        };
      }
      grouped[key].totalUnits++;
      grouped[key].totalVolumeMl += unit.volumeMl;
    }

    return { data: Object.values(grouped) };
  }

  /**
   * Creates an inventory alert, or refreshes the existing unacknowledged one
   * for the same organization/type/bloodType/rhFactor combination instead of
   * creating a duplicate every time this condition is re-checked. Called both
   * from unit-mutating endpoints (e.g. quarantine) and from InventoryCronService's
   * scheduled sweeps.
   */
  async ensureAlert(
    organizationId: string,
    type: AlertType,
    message: string,
    // Nullable and defaulted: an alert about the organisation's configuration
    // rather than about one blood group has no group to name.
    bloodType: BloodType | null = null,
    rhFactor: RhFactor | null = null,
    currentValue?: number,
    threshold?: number,
  ) {
    const existing = await this.db.inventoryAlert.findFirst({
      where: { organizationId, type, bloodType, rhFactor, acknowledged: false },
    });

    if (existing) {
      // An alert nobody has acknowledged yet is refreshed rather than
      // duplicated, and deliberately does not notify again: the maintenance
      // cron runs hourly, and re-announcing an open shortage every hour is how
      // staff learn to ignore the bell.
      return this.db.inventoryAlert.update({
        where: { id: existing.id },
        data: { message, currentValue, threshold },
      });
    }

    const alert = await this.db.inventoryAlert.create({
      data: { organizationId, type, bloodType, rhFactor, message, currentValue, threshold },
    });

    // A newly raised alert is the moment staff have not heard about yet. The
    // handler resolves who in the organisation receives it; this only says
    // what happened.
    const payload: InventoryAlertPayload = {
      alertId: alert.id,
      organizationId: alert.organizationId,
      alertType: alert.type,
      message: alert.message,
      bloodType: alert.bloodType,
      rhFactor: alert.rhFactor,
      currentValue: alert.currentValue,
      threshold: alert.threshold,
    };
    this.eventEmitter.emit(INVENTORY_ALERT_EVENT, payload);

    return alert;
  }

  /**
   * Write the unit's final disposition.
   *
   * Upsert rather than create: a unit reaches a terminal state once, but
   * `expireUnits` and a staff discard can race on the same bag at the hour
   * boundary, and a unique-constraint crash there would roll back a legitimate
   * status change over a bookkeeping row. First writer wins; the movement log
   * keeps the full sequence either way.
   */
  private async recordDisposition(
    tx: Prisma.TransactionClient,
    input: {
      unitId: string;
      organizationId: string;
      type: DispositionType;
      recordedBy: string | null;
      recipientReference: string | null;
      encounterReference?: string | null;
      context?: string | null;
      notes: string | null;
      bloodRequestId?: string | null;
      shipmentId?: string | null;
    },
  ): Promise<void> {
    await tx.bloodUnitDisposition.upsert({
      where: { bloodUnitId: input.unitId },
      create: {
        bloodUnitId: input.unitId,
        organizationId: input.organizationId,
        type: input.type,
        recordedBy: input.recordedBy,
        recipientReference: input.recipientReference,
        encounterReference: input.encounterReference ?? null,
        context: input.context ?? null,
        notes: input.notes,
        bloodRequestId: input.bloodRequestId ?? null,
        shipmentId: input.shipmentId ?? null,
      },
      // Write-once, and loud about it.
      //
      // An empty `update` meant a second call reported success while writing
      // nothing, so a correction or a back-fill of the recipient reference
      // silently did not happen. A disposition is the end of the chain and is
      // meant to be written once; the caller should hear that it already was,
      // rather than believe it just wrote it.
      update: {},
    });

    // The upsert's empty `update` means a second call writes nothing. That was
    // silent: a correction or a back-fill reported success and changed nothing.
    // Read the row back and say so, rather than letting the caller believe the
    // write happened.
    const existing = await tx.bloodUnitDisposition.findUnique({
      where: { bloodUnitId: input.unitId },
      select: { type: true },
    });

    if (existing && existing.type !== input.type) {
      throw new ConflictException({
        code: 'DISPOSITION_ALREADY_RECORDED',
        message:
          'This unit already has a final disposition. A disposition is written once; record a correction as a new audited event rather than overwriting it.',
        details: { existing: existing.type, attempted: input.type },
      });
    }
  }

  /**
   * The hospital's half of the chain: what actually became of a unit.
   *
   * `DispositionType` carries two axes. The blood centre's -- ISSUED,
   * DISCARDED, EXPIRED, TRANSFERRED_OUT -- says how a unit left its custody.
   * These say what happened to it afterwards, which is the half that closes
   * traceability, and only the receiving organisation can answer it.
   *
   * `recipientReference` and `encounterReference` are opaque and scoped to the
   * recording organisation. The same string from two hospitals is two different
   * people, and nothing here treats either as a global identifier. No national
   * identity number is required, requested or accepted as a special case
   * (CL-03, PR-02) -- what identifies a transfusion recipient in this
   * jurisdiction is an unresolved legal question, and a column that quietly
   * became a JSHSHIR would be this project answering it by accident.
   *
   * NO REACTION CLASSIFICATION IS ENCODED. `REACTION_REPORTED` records that a
   * reaction was reported; what kind is clinical vocabulary this project does
   * not have (CR-08), so the detail stays in free-text `context`.
   */
  async recordFinalDisposition(
    organizationId: string,
    unitId: string,
    requestingUserId: string,
    dto: {
      type: DispositionType;
      recipientReference?: string;
      encounterReference?: string;
      context?: string;
      notes?: string;
    },
    ipAddress?: string,
  ) {
    const unit = await this.db.bloodUnit.findFirst({
      where: { id: unitId, organizationId },
      select: { id: true, unitReference: true, status: true },
    });

    if (!unit) {
      throw new NotFoundException('Blood unit not found in this organization.');
    }

    const result = await this.db.$transaction(async (tx) => {
      await this.recordDisposition(tx, {
        unitId,
        organizationId,
        type: dto.type,
        recordedBy: requestingUserId,
        recipientReference: dto.recipientReference ?? null,
        encounterReference: dto.encounterReference ?? null,
        context: dto.context ?? null,
        notes: dto.notes ?? null,
      });

      return tx.bloodUnitDisposition.findUniqueOrThrow({ where: { bloodUnitId: unitId } });
    });

    await this.audit.log({
      actorId: requestingUserId,
      action: 'BLOOD_UNIT_FINAL_DISPOSITION_RECORDED',
      entityType: 'BloodUnit',
      entityId: unitId,
      organizationId,
      // The TYPE and the fact a reference was supplied; never the reference
      // itself and never the free-text context. Both can identify a patient,
      // and the audit log is read far more widely than this endpoint.
      metadata: {
        unitReference: unit.unitReference,
        type: result.type,
        hasRecipientReference: Boolean(result.recipientReference),
        hasEncounterReference: Boolean(result.encounterReference),
      },
      ipAddress,
    });

    return {
      data: {
        bloodUnitId: unitId,
        type: result.type,
        occurredAt: result.occurredAt,
      },
    };
  }

  private async getAuthorizedUser(userId: string, organizationId: string) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          where: { status: 'ACTIVE' },
          include: { role: true, organization: true },
        },
      },
    });

    if (!user) {
      throw new ForbiddenException('Access denied.');
    }

    const isStaff = user.memberships.some(
      (m) =>
        m.organizationId === organizationId &&
        ['HOSPITAL_ADMIN', 'HOSPITAL_STAFF', 'BLOOD_CENTER_ADMIN', 'BLOOD_CENTER_STAFF'].includes(m.role.code),
    );
    const isSuperAdmin = user.memberships.some((m) => m.role.code === RoleCode.SUPER_ADMIN);

    if (!isStaff && !isSuperAdmin) {
      throw new ForbiddenException('You do not have permission to access inventory.');
    }

    // Super admins manage organizations regardless of status; staff of the
    // organization itself are blocked once it's no longer ACTIVE.
    if (!isSuperAdmin) {
      const membership = user.memberships.find((m) => m.organizationId === organizationId);
      assertOrganizationActive(membership?.organization);
    }

    return user;
  }

  private async getAuthorizedUnit(unitId: string, organizationId: string) {
    const unit = await this.db.bloodUnit.findFirst({
      where: { id: unitId, organizationId },
      include: { organization: true },
    });

    if (!unit) {
      throw new NotFoundException('Blood unit not found.');
    }

    assertOrganizationActive(unit.organization);

    return unit;
  }
}