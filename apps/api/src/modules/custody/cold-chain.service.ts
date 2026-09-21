import { Injectable, NotFoundException } from '@nestjs/common';
import {
  BloodUnitHoldKind,
  ColdChainEventType,
  ContainerIntegrity,
  TemperatureSource,
} from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { HoldsService } from './holds.service';

export interface RecordColdChainEventInput {
  bloodUnitId?: string;
  shipmentId?: string;
  type: ColdChainEventType;
  measuredAt: string;
  temperatureC?: number;
  source?: TemperatureSource;
  deviceReference?: string;
  containerReference?: string;
  loggerReference?: string;
  calibratedAt?: string;
  calibrationReference?: string;
  sealIntact?: ContainerIntegrity;
  excursionDeclared?: boolean;
  notes?: string;
}

/**
 * Recording what the cold chain actually did.
 *
 * THIS SERVICE DOES NOT KNOW WHAT A SAFE TEMPERATURE IS, and that is not an
 * omission. The temperatures a component must be held at are clinical and
 * regulatory values nobody has signed off for this project (CR-06, OR-05), and
 * a number invented here would be indistinguishable, to everyone downstream,
 * from one a transfusion specialist had approved.
 *
 * So there is no comparison anywhere in this file. `excursionDeclared` is an
 * assertion made by the person or the device recording the observation. What
 * this service guarantees is what happens WHEN it is asserted: the unit goes
 * into a TEMPERATURE_EXCURSION hold, in the same transaction, and nothing but
 * the quality workflow takes it out again.
 *
 * When the thresholds do arrive, they arrive as a `StoragePolicy` the reading
 * is compared against -- and the hold that follows is the same hold.
 */
@Injectable()
export class ColdChainService {
  constructor(
    private readonly db: PrismaService,
    private readonly audit: AuditLogsService,
    private readonly holds: HoldsService,
  ) {}

  async record(
    organizationId: string,
    actorId: string,
    dto: RecordColdChainEventInput,
    ipAddress?: string,
  ) {
    if (dto.bloodUnitId) {
      const unit = await this.db.bloodUnit.findFirst({
        where: { id: dto.bloodUnitId },
        select: { id: true },
      });

      if (!unit) {
        throw new NotFoundException('Blood unit not found.');
      }
    }

    const result = await this.db.$transaction(async (tx) => {
      const event = await tx.coldChainEvent.create({
        data: {
          bloodUnitId: dto.bloodUnitId ?? null,
          shipmentId: dto.shipmentId ?? null,
          organizationId,
          type: dto.type,
          deviceReference: dto.deviceReference ?? null,
          containerReference: dto.containerReference ?? null,
          loggerReference: dto.loggerReference ?? null,
          measuredAt: new Date(dto.measuredAt),
          temperatureC: dto.temperatureC ?? null,
          source: dto.source ?? TemperatureSource.UNKNOWN,
          calibratedAt: dto.calibratedAt ? new Date(dto.calibratedAt) : null,
          calibrationReference: dto.calibrationReference ?? null,
          sealIntact: dto.sealIntact ?? ContainerIntegrity.UNKNOWN,
          excursionDeclared: dto.excursionDeclared ?? false,
          actorId,
          notes: dto.notes ?? null,
        },
      });

      // The one rule this service does enforce, and it is a structural one
      // rather than a clinical one: a declared excursion holds the unit.
      //
      // In the same transaction, so there is no window in which the excursion
      // is on record and the unit is still freely issuable.
      let hold = null;
      if (event.excursionDeclared && dto.bloodUnitId) {
        hold = await this.holds.raiseInTransaction(tx, {
          bloodUnitId: dto.bloodUnitId,
          organizationId,
          kind: BloodUnitHoldKind.TEMPERATURE_EXCURSION,
          reasonText: null,
          raisedBy: actorId,
          coldChainEventId: event.id,
        });
      }

      return { event, hold };
    });

    await this.audit.log({
      actorId,
      action: result.hold ? 'COLD_CHAIN_EXCURSION_DECLARED' : 'COLD_CHAIN_EVENT_RECORDED',
      entityType: dto.bloodUnitId ? 'BloodUnit' : 'Shipment',
      entityId: dto.bloodUnitId ?? dto.shipmentId ?? result.event.id,
      organizationId,
      metadata: {
        coldChainEventId: result.event.id,
        type: result.event.type,
        excursionDeclared: result.event.excursionDeclared,
        holdId: result.hold?.id ?? null,
      },
      ipAddress,
    });

    return {
      data: {
        id: result.event.id,
        type: result.event.type,
        measuredAt: result.event.measuredAt,
        excursionDeclared: result.event.excursionDeclared,
        holdId: result.hold?.id ?? null,
      },
    };
  }

  /** The cold-chain record for one unit, oldest first. */
  async listForUnit(organizationId: string, bloodUnitId: string) {
    const events = await this.db.coldChainEvent.findMany({
      where: { bloodUnitId, organizationId },
      orderBy: { measuredAt: 'asc' },
    });

    return { data: events };
  }
}
