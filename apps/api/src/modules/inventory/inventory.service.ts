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
      },
    });

    if (!unit) {
      throw new NotFoundException('Blood unit not found.');
    }

    return { data: unit };
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

    const result = await this.db.$transaction(async (tx) => {
      // Atomic conditional update: only succeeds if the unit is still in an
      // allowed status at the moment Postgres acquires the row lock, closing
      // the race window between the pre-check above and this transaction.
      const claim = await tx.bloodUnit.updateMany({
        where: { id: unitId, status: { in: [BloodUnitStatus.COLLECTED, BloodUnitStatus.QUARANTINED] } },
        data: { status: BloodUnitStatus.AVAILABLE },
      });

      if (claim.count === 0) {
        const current = await tx.bloodUnit.findUnique({ where: { id: unitId }, select: { status: true } });
        throw new ConflictException(
          `Cannot release unit with status ${current?.status ?? 'UNKNOWN'}. Only COLLECTED or QUARANTINED units can be released.`,
        );
      }

      const updated = await tx.bloodUnit.findUniqueOrThrow({ where: { id: unitId } });

      await tx.inventoryMovement.create({
        data: {
          bloodUnitId: unitId,
          organizationId,
          type: MovementType.RELEASED,
          actorId: requestingUserId,
          reason: dto.reason,
        },
      });

      return updated;
    });

    await this.audit.log({
      actorId: requestingUserId,
      action: 'BLOOD_UNIT_RELEASED',
      entityType: 'BloodUnit',
      entityId: unitId,
      organizationId,
      metadata: { unitReference: unit.unitReference, status: result.status },
      ipAddress,
    });

    return { data: { id: result.id, status: result.status, unitReference: result.unitReference } };
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

      await tx.inventoryMovement.create({
        data: {
          bloodUnitId: unitId,
          organizationId,
          type: MovementType.QUARANTINED,
          actorId: requestingUserId,
          reason: dto.reason,
        },
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

      await tx.inventoryMovement.create({
        data: {
          bloodUnitId: unitId,
          organizationId,
          type: MovementType.DISCARDED,
          actorId: requestingUserId,
          reason: dto.reason,
        },
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

      await tx.inventoryMovement.create({
        data: {
          bloodUnitId: unitId,
          organizationId,
          type: MovementType.USED,
          actorId: requestingUserId,
          reason: dto.reason,
        },
      });

      // Issuing a reserved unit fulfills whatever reservation was holding it.
      await tx.bloodUnitReservation.updateMany({
        where: { bloodUnitId: unitId, status: ReservationStatus.ACTIVE },
        data: { status: ReservationStatus.FULFILLED, fulfilledAt: new Date() },
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

      await tx.inventoryMovement.create({
        data: {
          bloodUnitId: unitId,
          organizationId,
          type: MovementType.ADJUSTED,
          actorId: requestingUserId,
          reason: dto.reason,
        },
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

      await tx.inventoryMovement.create({
        data: {
          bloodUnitId: unitId,
          organizationId,
          fromLocationId: unit.locationId,
          toLocationId: dto.toLocationId,
          type: MovementType.MOVED,
          actorId: requestingUserId,
          reason: dto.reason,
        },
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

      await tx.inventoryMovement.create({
        data: {
          bloodUnitId: unitId,
          organizationId,
          type: MovementType.RESERVED,
          actorId: requestingUserId,
          reason: dto.reason,
        },
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
      const updated = await tx.bloodUnit.update({
        where: { id: reservation.bloodUnitId },
        data: { status: BloodUnitStatus.AVAILABLE },
      });

      await tx.bloodUnitReservation.update({
        where: { id: reservationId },
        data: {
          status: ReservationStatus.RELEASED,
          releasedAt: new Date(),
        },
      });

      await tx.inventoryMovement.create({
        data: {
          bloodUnitId: reservation.bloodUnitId,
          organizationId,
          type: MovementType.RELEASED,
          actorId: requestingUserId,
          reason: dto.reason,
        },
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
    bloodType: BloodType | null,
    rhFactor: RhFactor | null,
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