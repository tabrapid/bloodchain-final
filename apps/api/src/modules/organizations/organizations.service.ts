import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { OrganizationStatus, OrganizationType, Prisma, RoleCode } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { boundingBox, haversineKm } from './organization-geo.util';
import type {
  DiscoverOrganizationsQueryDto,
  OrganizationDirectoryQueryDto,
  UpdateOrganizationDirectoryDto,
} from './dto/organization-directory.dto';

/** The directory shape every caller gets, so a screen never has to guess. */
const DIRECTORY_SELECT = {
  id: true,
  type: true,
  name: true,
  legalName: true,
  phone: true,
  publicPhone: true,
  email: true,
  address: true,
  directionsNote: true,
  latitude: true,
  longitude: true,
  status: true,
  acceptsDonations: true,
  providesLaboratory: true,
  verifiedAt: true,
  isDemo: true,
  createdAt: true,
  region: {
    select: { id: true, code: true, nameUz: true, nameRu: true, nameEn: true, source: true },
  },
  district: {
    select: { id: true, code: true, nameUz: true, nameRu: true, nameEn: true, source: true },
  },
  services: { select: { service: true, note: true }, orderBy: { service: 'asc' } },
  hours: {
    select: { dayOfWeek: true, opensAt: true, closesAt: true, isClosed: true },
    orderBy: { dayOfWeek: 'asc' },
  },
} satisfies Prisma.OrganizationSelect;

type DirectoryRow = Prisma.OrganizationGetPayload<{ select: typeof DIRECTORY_SELECT }>;

/**
 * `verifiedAt` is a timestamp in the database and a boolean everywhere else: a
 * screen asks "is this verified", not "when". Both are returned -- the boolean
 * to branch on, the timestamp for an audit trail -- so no caller has to invent
 * the predicate and get it subtly different from the next caller.
 */
function withVerified<T extends { verifiedAt: Date | null }>(row: T) {
  return { ...row, isVerified: row.verifiedAt !== null };
}

@Injectable()
export class OrganizationsService {
  constructor(private readonly db: PrismaService) {}

  /**
   * Filters shared by the staff directory and donor discovery.
   *
   * A function, not a constant: Prisma's `where` types are mutable, and a
   * shared object would be mutated by whichever caller ran first.
   */
  private directoryWhere(
    filters: OrganizationDirectoryQueryDto,
    options: { defaultStatus?: OrganizationStatus } = {},
  ): Prisma.OrganizationWhereInput {
    // SYSTEM is the internal placeholder org donor accounts hang their
    // membership on. It is never a real, listable organization.
    const where: Prisma.OrganizationWhereInput = { type: { not: OrganizationType.SYSTEM } };

    if (filters.type && filters.type !== OrganizationType.SYSTEM) {
      where.type = filters.type;
    }
    where.status = filters.status ?? options.defaultStatus ?? OrganizationStatus.ACTIVE;

    if (filters.regionId) where.regionId = filters.regionId;
    if (filters.districtId) where.districtId = filters.districtId;
    if (filters.acceptsDonations !== undefined) where.acceptsDonations = filters.acceptsDonations;
    if (filters.providesLaboratory !== undefined) {
      where.providesLaboratory = filters.providesLaboratory;
    }
    if (filters.verified !== undefined) {
      where.verifiedAt = filters.verified ? { not: null } : null;
    }
    if (filters.service) {
      where.services = { some: { service: filters.service } };
    }
    if (filters.search?.trim()) {
      const search = filters.search.trim();
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
      ];
    }
    return where;
  }

  /** The staff-facing directory: every status, every field, paginated. */
  async findMany(filters: OrganizationDirectoryQueryDto = {}) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const where = this.directoryWhere(filters);

    const [data, total] = await Promise.all([
      this.db.organization.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: 'asc' },
        select: DIRECTORY_SELECT,
      }),
      this.db.organization.count({ where }),
    ]);

    return {
      data: data.map(withVerified),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string) {
    const organization = await this.db.organization.findUnique({
      where: { id },
      select: { ...DIRECTORY_SELECT, updatedAt: true },
    });
    return organization ? withVerified(organization) : null;
  }

  /**
   * Donor-facing discovery.
   *
   * Only ACTIVE organizations, and only ever ACTIVE: a donor must not be able
   * to widen this to suspended or pending sites by passing `status`, so the
   * filter is overwritten rather than defaulted.
   *
   * Radius search runs in two stages -- a bounding box the database can index,
   * then an exact great-circle distance in memory. When a radius is given the
   * result is sorted by distance, because "nearby" with an alphabetical order
   * is not an answer to the question that was asked.
   */
  async discover(query: DiscoverOrganizationsQueryDto = {}) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where = this.directoryWhere(
      { ...query, status: undefined },
      { defaultStatus: OrganizationStatus.ACTIVE },
    );
    where.status = OrganizationStatus.ACTIVE;

    const centre = this.centreOf(query);
    if (centre) {
      const box = boundingBox(centre, centre.radiusKm);
      where.latitude = { gte: new Prisma.Decimal(box.minLat), lte: new Prisma.Decimal(box.maxLat) };
      where.longitude = { gte: new Prisma.Decimal(box.minLon), lte: new Prisma.Decimal(box.maxLon) };
    }

    if (!centre) {
      const [data, total] = await Promise.all([
        this.db.organization.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { name: 'asc' },
          select: DIRECTORY_SELECT,
        }),
        this.db.organization.count({ where }),
      ]);
      return {
        data: data.map((row) => ({ ...withVerified(row), distanceKm: null })),
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    }

    // With a radius, the page has to be cut after the exact distance filter --
    // the box admits corners the circle does not, so paginating before it would
    // return short pages and a wrong total.
    const candidates = await this.db.organization.findMany({
      where,
      orderBy: { name: 'asc' },
      select: DIRECTORY_SELECT,
    });

    const within = candidates
      .map((row) => ({ row, distanceKm: this.distanceTo(row, centre) }))
      .filter((entry): entry is { row: DirectoryRow; distanceKm: number } =>
        entry.distanceKm !== null && entry.distanceKm <= centre.radiusKm,
      )
      .sort((a, b) => a.distanceKm - b.distanceKm);

    const paged = within.slice((page - 1) * limit, (page - 1) * limit + limit);
    return {
      data: paged.map(({ row, distanceKm }) => ({
        ...withVerified(row),
        // One decimal: a directory says "3.4 km away", not "3.41729 km".
        distanceKm: Math.round(distanceKm * 10) / 10,
      })),
      meta: {
        page,
        limit,
        total: within.length,
        totalPages: Math.ceil(within.length / limit),
        radiusKm: centre.radiusKm,
      },
    };
  }

  /**
   * A usable centre, or nothing.
   *
   * All three of latitude, longitude and radius are required together: two of
   * the three is a client bug, and guessing a radius would silently return a
   * different answer than the caller asked for.
   */
  private centreOf(query: DiscoverOrganizationsQueryDto) {
    const { latitude, longitude, radiusKm } = query;
    if (latitude === undefined || longitude === undefined || radiusKm === undefined) return null;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !(radiusKm > 0)) return null;
    return { latitude, longitude, radiusKm };
  }

  private distanceTo(
    row: { latitude: Prisma.Decimal | null; longitude: Prisma.Decimal | null },
    centre: { latitude: number; longitude: number },
  ): number | null {
    if (row.latitude === null || row.longitude === null) return null;
    return haversineKm(centre, {
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
    });
  }

  /**
   * Updates the directory entry of one organization.
   *
   * `actorOrganizationIds` is the isolation boundary: a hospital administrator
   * may edit the hospital they belong to and nothing else. A platform
   * administrator passes `null`, which is the only way to skip the check --
   * an empty array denies everything rather than allowing it, because an empty
   * membership list is exactly the case that must not become a skeleton key.
   */
  async updateDirectory(
    id: string,
    input: UpdateOrganizationDirectoryDto,
    actorOrganizationIds: string[] | null,
  ) {
    if (actorOrganizationIds !== null && !actorOrganizationIds.includes(id)) {
      throw new ForbiddenException('You can only edit an organization you belong to.');
    }

    const existing = await this.db.organization.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException('Organization not found');

    await this.assertGeographyExists(input);

    const { services, hours, ...scalars } = input;

    await this.db.$transaction(async (tx) => {
      await tx.organization.update({
        where: { id },
        data: {
          ...scalars,
          ...(scalars.latitude !== undefined
            ? { latitude: scalars.latitude === null ? null : new Prisma.Decimal(scalars.latitude) }
            : {}),
          ...(scalars.longitude !== undefined
            ? {
                longitude:
                  scalars.longitude === null ? null : new Prisma.Decimal(scalars.longitude),
              }
            : {}),
        },
      });

      // Services and hours are sets, not patches: an omitted entry means
      // "no longer offered", which a merge would silently keep forever.
      if (services) {
        await tx.organizationService.deleteMany({ where: { organizationId: id } });
        if (services.length > 0) {
          await tx.organizationService.createMany({
            data: services.map((entry) => ({
              organizationId: id,
              service: entry.service,
              note: entry.note ?? null,
            })),
            skipDuplicates: true,
          });
        }
      }

      if (hours) {
        await tx.organizationHours.deleteMany({ where: { organizationId: id } });
        if (hours.length > 0) {
          await tx.organizationHours.createMany({
            data: hours.map((entry) => ({
              organizationId: id,
              dayOfWeek: entry.dayOfWeek,
              opensAt: entry.isClosed ? null : (entry.opensAt ?? null),
              closesAt: entry.isClosed ? null : (entry.closesAt ?? null),
              isClosed: entry.isClosed ?? false,
            })),
            skipDuplicates: true,
          });
        }
      }
    });

    return this.findById(id);
  }

  /**
   * A district must belong to the region it is filed under.
   *
   * Without this an organization can be saved into "Samarkand region,
   * Chilanzar district", which no validation on either field alone would catch
   * and which makes the region filter lie.
   */
  private async assertGeographyExists(input: UpdateOrganizationDirectoryDto) {
    if (input.regionId) {
      const region = await this.db.region.findUnique({ where: { id: input.regionId } });
      if (!region) throw new NotFoundException('Region not found');
    }
    if (input.districtId) {
      const district = await this.db.district.findUnique({ where: { id: input.districtId } });
      if (!district) throw new NotFoundException('District not found');
      if (input.regionId && district.regionId !== input.regionId) {
        throw new ForbiddenException('That district is not in the selected region.');
      }
    }
  }

  /**
   * Which organizations this user may edit the directory entry of.
   *
   * Returns `null` for a platform administrator, meaning "no restriction" --
   * distinct from `[]`, which means "belongs to nothing" and denies every edit.
   * Collapsing those two into one falsy value is exactly how an unaffiliated
   * account ends up able to edit anything.
   */
  async editableOrganizationIds(userId: string): Promise<string[] | null> {
    const memberships = await this.db.organizationMembership.findMany({
      where: { userId, status: 'ACTIVE' },
      select: { organizationId: true, role: { select: { code: true } } },
    });

    if (memberships.some((m) => m.role.code === RoleCode.SUPER_ADMIN)) return null;

    const EDITORS: RoleCode[] = [RoleCode.HOSPITAL_ADMIN, RoleCode.BLOOD_CENTER_ADMIN];
    return memberships
      .filter((m) => EDITORS.includes(m.role.code))
      .map((m) => m.organizationId);
  }

  /**
   * Marks an organization verified, or withdraws verification.
   *
   * Platform administrators only, and deliberately separate from the directory
   * edit: an organization must not be able to declare itself verified by
   * saving its own address.
   */
  async setVerification(id: string, verified: boolean, actorUserId: string) {
    const existing = await this.db.organization.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException('Organization not found');

    await this.db.organization.update({
      where: { id },
      data: verified
        ? { verifiedAt: new Date(), verifiedById: actorUserId }
        : { verifiedAt: null, verifiedById: null },
    });
    return this.findById(id);
  }
}
