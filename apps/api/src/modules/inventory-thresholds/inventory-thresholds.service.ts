import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BloodType, ComponentType, InventoryThreshold, RhFactor, RoleCode } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

/**
 * The development fallback, used only when this is not production.
 *
 * It is the number that used to be `const LOW_STOCK_THRESHOLD = 5` applied to
 * every organisation, every blood group and every component at once. It is kept
 * for exactly one purpose -- so a developer's seeded database still raises the
 * alerts the screens display -- and it is unreachable in production, where an
 * unconfigured organisation gets `LOW_STOCK_THRESHOLD_NOT_CONFIGURED` instead.
 *
 * It is not a clinical or operational threshold and never was.
 */
export const DEVELOPMENT_LOW_STOCK_THRESHOLD = 5;

export type ThresholdScope = {
  bloodType?: BloodType | null;
  rhFactor?: RhFactor | null;
  componentType?: ComponentType | null;
};

export interface ResolvedThreshold {
  /** Null when nothing is configured and this is production. */
  threshold: number | null;
  source: 'CONFIGURED' | 'DEVELOPMENT_FALLBACK' | 'NOT_CONFIGURED';
  /** Which configured row answered, when one did. */
  scopeKey: string | null;
}

/**
 * Low-stock thresholds, per organisation and as specific as the operator wants.
 *
 * `LOW_STOCK_THRESHOLD = 5` was a constant nobody chose, applied identically to
 * a district hospital and a republican blood centre, and to O-negative and
 * AB-positive alike. Five units of each are not the same situation, and which
 * number matters is a property of the site and its catchment -- not of this
 * repository, and not a medical fact this code is entitled to assert.
 *
 * Resolution is most-specific-first: an exact blood group and component beats a
 * blood group, which beats the organisation's default. Nothing is seeded for
 * production: an organisation with no configuration gets an alert saying so,
 * rather than a comparison against an invented number.
 */
@Injectable()
export class InventoryThresholdsService {
  constructor(
    private readonly db: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditLogsService,
  ) {}

  private get isProduction(): boolean {
    return this.config.get<string>('NODE_ENV') === 'production';
  }

  /**
   * The scope key for a row.
   *
   * Exists because Postgres treats NULLs as distinct in a unique index, so
   * `@@unique([organizationId, bloodType, rhFactor, componentType])` would
   * cheerfully accept two organisation-default rows. Encoding the level as a
   * string makes `@@unique([organizationId, scopeKey])` mean what it says.
   */
  static scopeKeyFor(scope: ThresholdScope): string {
    if (!scope.bloodType || !scope.rhFactor) return 'ORG';
    const base = `TYPE:${scope.bloodType}:${scope.rhFactor}`;
    return scope.componentType ? `${base}:${scope.componentType}` : base;
  }

  /**
   * The threshold that applies to one blood group at one organisation.
   *
   * Reads every row for the organisation once and picks in memory, because the
   * alert engine asks this for every group it has stock in and three queries per
   * group inside the hourly job is three queries too many.
   */
  async resolve(organizationId: string, scope: ThresholdScope): Promise<ResolvedThreshold> {
    const rows = await this.db.inventoryThreshold.findMany({ where: { organizationId } });
    return this.resolveFrom(rows, scope);
  }

  /** The same decision against rows already in hand. */
  resolveFrom(rows: InventoryThreshold[], scope: ThresholdScope): ResolvedThreshold {
    const candidates = [
      scope.bloodType && scope.rhFactor && scope.componentType
        ? InventoryThresholdsService.scopeKeyFor(scope)
        : null,
      scope.bloodType && scope.rhFactor
        ? InventoryThresholdsService.scopeKeyFor({
            bloodType: scope.bloodType,
            rhFactor: scope.rhFactor,
          })
        : null,
      'ORG',
    ].filter((key): key is string => key !== null);

    for (const key of candidates) {
      const match = rows.find((row) => row.scopeKey === key);
      if (match) {
        return { threshold: match.lowStockThreshold, source: 'CONFIGURED', scopeKey: key };
      }
    }

    if (this.isProduction) {
      return { threshold: null, source: 'NOT_CONFIGURED', scopeKey: null };
    }

    return {
      threshold: DEVELOPMENT_LOW_STOCK_THRESHOLD,
      source: 'DEVELOPMENT_FALLBACK',
      scopeKey: null,
    };
  }

  async listRows(organizationId: string): Promise<InventoryThreshold[]> {
    return this.db.inventoryThreshold.findMany({
      where: { organizationId },
      orderBy: { scopeKey: 'asc' },
    });
  }

  async list(organizationId: string, actorId: string) {
    await this.assertAdminOf(actorId, organizationId);
    const rows = await this.listRows(organizationId);

    return {
      data: {
        /**
         * What the UI needs to say "low-stock alerting is not configured here"
         * without re-deriving the rule in a component.
         */
        configured: rows.length > 0,
        productionFallbackAvailable: !this.isProduction,
        developmentFallback: this.isProduction ? null : DEVELOPMENT_LOW_STOCK_THRESHOLD,
        thresholds: rows.map((row) => this.serialize(row)),
      },
    };
  }

  async upsert(
    organizationId: string,
    actorId: string,
    input: ThresholdScope & { lowStockThreshold: number },
    ipAddress?: string,
  ) {
    await this.assertAdminOf(actorId, organizationId);

    if (!Number.isInteger(input.lowStockThreshold) || input.lowStockThreshold < 0) {
      throw new BadRequestException('A low-stock threshold must be a whole number of units, zero or more.');
    }
    // A blood group is a type and an Rh factor together. Half of one would
    // silently widen or narrow the scope of the row depending on which half.
    if ((input.bloodType && !input.rhFactor) || (!input.bloodType && input.rhFactor)) {
      throw new BadRequestException('Give a blood type and an Rh factor together, or neither.');
    }
    if (input.componentType && !input.bloodType) {
      throw new BadRequestException('A component-specific threshold also needs a blood type and Rh factor.');
    }

    const scopeKey = InventoryThresholdsService.scopeKeyFor(input);
    const existing = await this.db.inventoryThreshold.findUnique({
      where: { organizationId_scopeKey: { organizationId, scopeKey } },
    });

    const row = await this.db.inventoryThreshold.upsert({
      where: { organizationId_scopeKey: { organizationId, scopeKey } },
      create: {
        organizationId,
        scopeKey,
        bloodType: input.bloodType ?? null,
        rhFactor: input.rhFactor ?? null,
        componentType: input.componentType ?? null,
        lowStockThreshold: input.lowStockThreshold,
        createdBy: actorId,
        updatedBy: actorId,
      },
      update: { lowStockThreshold: input.lowStockThreshold, updatedBy: actorId },
    });

    await this.audit.log({
      actorId,
      action: existing ? 'INVENTORY_THRESHOLD_UPDATED' : 'INVENTORY_THRESHOLD_CREATED',
      entityType: 'InventoryThreshold',
      entityId: row.id,
      organizationId,
      // The previous value is in the metadata because "who lowered the
      // O-negative threshold, when, and from what" is the question asked after
      // a shortage nobody was alerted to.
      metadata: {
        scopeKey,
        previousThreshold: existing?.lowStockThreshold ?? null,
        lowStockThreshold: row.lowStockThreshold,
      },
      ipAddress,
    });

    return { data: this.serialize(row) };
  }

  async remove(organizationId: string, thresholdId: string, actorId: string, ipAddress?: string) {
    await this.assertAdminOf(actorId, organizationId);

    const row = await this.db.inventoryThreshold.findFirst({
      where: { id: thresholdId, organizationId },
    });
    if (!row) {
      throw new NotFoundException('Threshold not found.');
    }

    await this.db.inventoryThreshold.delete({ where: { id: thresholdId } });

    await this.audit.log({
      actorId,
      action: 'INVENTORY_THRESHOLD_DELETED',
      entityType: 'InventoryThreshold',
      entityId: thresholdId,
      organizationId,
      metadata: { scopeKey: row.scopeKey, lowStockThreshold: row.lowStockThreshold },
      ipAddress,
    });

    return { data: { id: thresholdId, deleted: true } };
  }

  private serialize(row: InventoryThreshold) {
    return {
      id: row.id,
      scopeKey: row.scopeKey,
      bloodType: row.bloodType,
      rhFactor: row.rhFactor,
      componentType: row.componentType,
      lowStockThreshold: row.lowStockThreshold,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * Configuring a threshold is an organisation-administration act, so staff
   * cannot do it -- an operator's alerting policy should not change because
   * somebody on shift found the alerts noisy.
   */
  private async assertAdminOf(actorId: string, organizationId: string): Promise<void> {
    const memberships = await this.db.organizationMembership.findMany({
      where: { userId: actorId, status: 'ACTIVE' },
      include: { role: true },
    });

    const isSuperAdmin = memberships.some((m) => m.role.code === RoleCode.SUPER_ADMIN);
    const isAdminHere = memberships.some(
      (m) =>
        m.organizationId === organizationId &&
        (m.role.code === RoleCode.BLOOD_CENTER_ADMIN || m.role.code === RoleCode.HOSPITAL_ADMIN),
    );

    if (!isSuperAdmin && !isAdminHere) {
      throw new ForbiddenException('You do not have permission to manage stock thresholds here.');
    }
  }
}
