import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { OrganizationsService } from './organizations.service';

/** A directory row shaped like what DIRECTORY_SELECT returns. */
function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'org-1',
    type: 'HOSPITAL',
    name: 'Demo Hospital',
    legalName: null,
    phone: null,
    publicPhone: null,
    email: null,
    address: null,
    directionsNote: null,
    latitude: null,
    longitude: null,
    status: 'ACTIVE',
    acceptsDonations: true,
    providesLaboratory: false,
    verifiedAt: null,
    isDemo: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    region: null,
    district: null,
    services: [],
    hours: [],
    ...overrides,
  };
}

/** Somewhere with real coordinates, so distances are checkable by hand. */
const TASHKENT = { latitude: 41.2995, longitude: 69.2401 };

describe('OrganizationsService', () => {
  let service: OrganizationsService;
  let prisma: {
    organization: {
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    organizationMembership: { findMany: jest.Mock };
    region: { findUnique: jest.Mock };
    district: { findUnique: jest.Mock };
    organizationService: { deleteMany: jest.Mock; createMany: jest.Mock };
    organizationHours: { deleteMany: jest.Mock; createMany: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      organization: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue(row()),
        update: jest.fn().mockResolvedValue(row()),
      },
      organizationMembership: { findMany: jest.fn().mockResolvedValue([]) },
      region: { findUnique: jest.fn().mockResolvedValue({ id: 'region-tk' }) },
      district: { findUnique: jest.fn().mockResolvedValue({ id: 'dist-1', regionId: 'region-tk' }) },
      organizationService: { deleteMany: jest.fn(), createMany: jest.fn() },
      organizationHours: { deleteMany: jest.fn(), createMany: jest.fn() },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [OrganizationsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(OrganizationsService);
  });

  /** The `where` the last findMany was called with. */
  const lastWhere = () => prisma.organization.findMany.mock.calls.at(-1)![0].where;

  describe('the directory listing', () => {
    it('always excludes the internal SYSTEM placeholder org', async () => {
      await service.findMany({});
      expect(lastWhere().type).toEqual({ not: 'SYSTEM' });
    });

    it('refuses to list SYSTEM even when asked for it by name', async () => {
      await service.findMany({ type: 'SYSTEM' as never });
      expect(lastWhere().type).toEqual({ not: 'SYSTEM' });
    });

    it('defaults to ACTIVE, so a suspended org is not in the everyday list', async () => {
      await service.findMany({});
      expect(lastWhere().status).toBe('ACTIVE');
    });

    it('lets staff ask for another status explicitly', async () => {
      await service.findMany({ status: 'PENDING_APPROVAL' as never });
      expect(lastWhere().status).toBe('PENDING_APPROVAL');
    });
  });

  describe('geography filtering', () => {
    it('filters by region', async () => {
      await service.findMany({ regionId: 'region-tk' });
      expect(lastWhere().regionId).toBe('region-tk');
    });

    it('filters by district', async () => {
      await service.findMany({ districtId: 'dist-chilonzor' });
      expect(lastWhere().districtId).toBe('dist-chilonzor');
    });

    it('applies region and district together rather than one overriding the other', async () => {
      await service.findMany({ regionId: 'region-tk', districtId: 'dist-chilonzor' });
      expect(lastWhere()).toMatchObject({ regionId: 'region-tk', districtId: 'dist-chilonzor' });
    });

    it('leaves geography unfiltered when neither is given', async () => {
      await service.findMany({});
      expect(lastWhere().regionId).toBeUndefined();
      expect(lastWhere().districtId).toBeUndefined();
    });

    it('builds a fresh where each call, so one filter cannot leak into the next', async () => {
      await service.findMany({ regionId: 'region-tk' });
      await service.findMany({});
      expect(lastWhere().regionId).toBeUndefined();
    });
  });

  describe('service and capability filtering', () => {
    it('matches organizations offering a service', async () => {
      await service.findMany({ service: 'PLASMA_DONATION' as never });
      expect(lastWhere().services).toEqual({ some: { service: 'PLASMA_DONATION' } });
    });

    it('filters on donation availability', async () => {
      await service.findMany({ acceptsDonations: true });
      expect(lastWhere().acceptsDonations).toBe(true);
    });

    it('can ask for sites that do NOT accept donations, not just those that do', async () => {
      await service.findMany({ acceptsDonations: false });
      // `false` is a real filter value, so an `if (filters.x)` guard would
      // silently drop it and return everything.
      expect(lastWhere().acceptsDonations).toBe(false);
    });

    it('filters on laboratory availability', async () => {
      await service.findMany({ providesLaboratory: true });
      expect(lastWhere().providesLaboratory).toBe(true);
    });
  });

  describe('verification status', () => {
    it('filters to verified organizations', async () => {
      await service.findMany({ verified: true });
      expect(lastWhere().verifiedAt).toEqual({ not: null });
    });

    it('filters to unverified organizations', async () => {
      await service.findMany({ verified: false });
      expect(lastWhere().verifiedAt).toBeNull();
    });

    it('reports isVerified as a boolean beside the timestamp', async () => {
      prisma.organization.findMany.mockResolvedValueOnce([
        row({ id: 'a', verifiedAt: new Date('2026-02-01T00:00:00.000Z') }),
        row({ id: 'b', verifiedAt: null }),
      ]);
      const result = await service.findMany({});
      expect(result.data.map((o) => [o.id, o.isVerified])).toEqual([
        ['a', true],
        ['b', false],
      ]);
    });

    it('records who verified it and when', async () => {
      await service.setVerification('org-1', true, 'admin-1');
      const data = prisma.organization.update.mock.calls[0][0].data;
      expect(data.verifiedById).toBe('admin-1');
      expect(data.verifiedAt).toBeInstanceOf(Date);
    });

    it('clears both fields when verification is withdrawn', async () => {
      await service.setVerification('org-1', false, 'admin-1');
      expect(prisma.organization.update.mock.calls[0][0].data).toEqual({
        verifiedAt: null,
        verifiedById: null,
      });
    });

    it('will not verify an organization that does not exist', async () => {
      prisma.organization.findUnique.mockResolvedValueOnce(null);
      await expect(service.setVerification('nope', true, 'admin-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('donor discovery', () => {
    it('returns only ACTIVE organizations', async () => {
      await service.discover({});
      expect(lastWhere().status).toBe('ACTIVE');
    });

    it('cannot be widened to suspended organizations by passing a status', async () => {
      await service.discover({ status: 'SUSPENDED' as never });
      // The donor-facing list is not a place to browse suspended sites, so the
      // caller's status is overwritten rather than merged.
      expect(lastWhere().status).toBe('ACTIVE');
    });

    it('still excludes the SYSTEM placeholder', async () => {
      await service.discover({});
      expect(lastWhere().type).toEqual({ not: 'SYSTEM' });
    });

    it('passes the donor-facing filters through', async () => {
      await service.discover({
        regionId: 'region-tk',
        service: 'LABORATORY_TESTING' as never,
        acceptsDonations: true,
      });
      expect(lastWhere()).toMatchObject({
        regionId: 'region-tk',
        acceptsDonations: true,
        services: { some: { service: 'LABORATORY_TESTING' } },
      });
    });

    it('reports a null distance when no radius was asked for', async () => {
      prisma.organization.findMany.mockResolvedValueOnce([row()]);
      const result = await service.discover({});
      expect(result.data[0]!.distanceKm).toBeNull();
    });
  });

  describe('radius search', () => {
    const near = row({
      id: 'near',
      name: 'Near',
      latitude: new Prisma.Decimal(41.31),
      longitude: new Prisma.Decimal(69.25),
    });
    const far = row({
      id: 'far',
      name: 'Far',
      // Samarkand, ~270 km from Tashkent.
      latitude: new Prisma.Decimal(39.6547),
      longitude: new Prisma.Decimal(66.9597),
    });

    it('narrows the query with a bounding box the database can index', async () => {
      await service.discover({ ...TASHKENT, radiusKm: 25 });
      const where = lastWhere();
      expect(where.latitude).toMatchObject({ gte: expect.anything(), lte: expect.anything() });
      expect(where.longitude).toMatchObject({ gte: expect.anything(), lte: expect.anything() });
    });

    it('rejects the corners the box admits but the circle does not', async () => {
      prisma.organization.findMany.mockResolvedValueOnce([near, far]);
      const result = await service.discover({ ...TASHKENT, radiusKm: 25 });
      expect(result.data.map((o) => o.id)).toEqual(['near']);
    });

    it('sorts by distance, not alphabetically', async () => {
      // `far` sorts first by name; a radius search that kept name order would
      // answer "which is nearest" with "whichever starts with F".
      prisma.organization.findMany.mockResolvedValueOnce([far, near]);
      const result = await service.discover({ ...TASHKENT, radiusKm: 500 });
      expect(result.data.map((o) => o.id)).toEqual(['near', 'far']);
    });

    it('reports the distance to one decimal place', async () => {
      prisma.organization.findMany.mockResolvedValueOnce([near]);
      const result = await service.discover({ ...TASHKENT, radiusKm: 25 });
      // Checked by hand: 0.0105° of latitude is ~1.17 km, 0.0099° of longitude
      // at 41.3°N is ~0.83 km, so the hypotenuse is ~1.43 km.
      expect(result.data[0]!.distanceKm).toBeCloseTo(1.4, 1);
    });

    it('drops organizations with no coordinates rather than treating them as at zero', async () => {
      prisma.organization.findMany.mockResolvedValueOnce([near, row({ id: 'nowhere' })]);
      const result = await service.discover({ ...TASHKENT, radiusKm: 25 });
      expect(result.data.map((o) => o.id)).toEqual(['near']);
    });

    it('counts the total after the distance filter, so pagination is honest', async () => {
      prisma.organization.findMany.mockResolvedValueOnce([near, far]);
      const result = await service.discover({ ...TASHKENT, radiusKm: 25, limit: 10 });
      expect(result.meta.total).toBe(1);
    });

    it('ignores a partial centre rather than guessing the missing half', async () => {
      prisma.organization.findMany.mockResolvedValueOnce([near, far]);
      const result = await service.discover({ latitude: TASHKENT.latitude, radiusKm: 25 });
      expect(lastWhere().latitude).toBeUndefined();
      expect(result.data.map((o) => o.id)).toEqual(['near', 'far']);
    });
  });

  describe('organization isolation on directory edits', () => {
    it('lets a member edit their own organization', async () => {
      await expect(
        service.updateDirectory('org-1', { address: 'New address' }, ['org-1']),
      ).resolves.toBeTruthy();
      expect(prisma.organization.update).toHaveBeenCalled();
    });

    it('refuses an edit to an organization the actor does not belong to', async () => {
      await expect(
        service.updateDirectory('org-2', { address: 'Not mine' }, ['org-1']),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.organization.update).not.toHaveBeenCalled();
    });

    it('refuses every edit when the actor belongs to nothing', async () => {
      // An empty list means "no organizations", never "no restriction" --
      // conflating the two turns an unaffiliated account into a skeleton key.
      await expect(
        service.updateDirectory('org-1', { address: 'x' }, []),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('lets a platform administrator (null scope) edit any organization', async () => {
      await expect(
        service.updateDirectory('org-99', { address: 'Anywhere' }, null),
      ).resolves.toBeTruthy();
    });

    it('404s rather than silently creating when the organization is gone', async () => {
      prisma.organization.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.updateDirectory('ghost', { address: 'x' }, null),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('editable organization scope', () => {
    it('returns null — no restriction — for a platform administrator', async () => {
      prisma.organizationMembership.findMany.mockResolvedValueOnce([
        { organizationId: 'org-1', role: { code: 'SUPER_ADMIN' } },
      ]);
      expect(await service.editableOrganizationIds('u1')).toBeNull();
    });

    it('returns just the organizations an admin administers', async () => {
      prisma.organizationMembership.findMany.mockResolvedValueOnce([
        { organizationId: 'org-1', role: { code: 'HOSPITAL_ADMIN' } },
        { organizationId: 'org-2', role: { code: 'BLOOD_CENTER_ADMIN' } },
      ]);
      expect(await service.editableOrganizationIds('u1')).toEqual(['org-1', 'org-2']);
    });

    it('excludes non-admin staff, who may read the directory but not rewrite it', async () => {
      prisma.organizationMembership.findMany.mockResolvedValueOnce([
        { organizationId: 'org-1', role: { code: 'HOSPITAL_STAFF' } },
      ]);
      expect(await service.editableOrganizationIds('u1')).toEqual([]);
    });

    it('only counts ACTIVE memberships', async () => {
      await service.editableOrganizationIds('u1');
      expect(prisma.organizationMembership.findMany.mock.calls[0][0].where).toMatchObject({
        userId: 'u1',
        status: 'ACTIVE',
      });
    });
  });

  describe('geography validation on save', () => {
    it('rejects a district that is not in the selected region', async () => {
      prisma.district.findUnique.mockResolvedValueOnce({ id: 'd', regionId: 'region-samarqand' });
      await expect(
        service.updateDirectory('org-1', { regionId: 'region-tk', districtId: 'd' }, null),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects a region that does not exist', async () => {
      prisma.region.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.updateDirectory('org-1', { regionId: 'nope' }, null),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('accepts a district that does belong to the region', async () => {
      await expect(
        service.updateDirectory('org-1', { regionId: 'region-tk', districtId: 'dist-1' }, null),
      ).resolves.toBeTruthy();
    });
  });

  describe('services and hours are replaced, not merged', () => {
    it('clears the old services before writing the new set', async () => {
      await service.updateDirectory(
        'org-1',
        { services: [{ service: 'PLASMA_DONATION' as never }] },
        null,
      );
      expect(prisma.organizationService.deleteMany).toHaveBeenCalledWith({
        where: { organizationId: 'org-1' },
      });
      expect(prisma.organizationService.createMany).toHaveBeenCalled();
    });

    it('an empty services array means "offers nothing", and removes them all', async () => {
      await service.updateDirectory('org-1', { services: [] }, null);
      expect(prisma.organizationService.deleteMany).toHaveBeenCalled();
      expect(prisma.organizationService.createMany).not.toHaveBeenCalled();
    });

    it('leaves services alone when the field is omitted', async () => {
      await service.updateDirectory('org-1', { address: 'x' }, null);
      expect(prisma.organizationService.deleteMany).not.toHaveBeenCalled();
    });

    it('drops opening times on a day marked closed', async () => {
      await service.updateDirectory(
        'org-1',
        { hours: [{ dayOfWeek: 0, opensAt: '09:00', closesAt: '17:00', isClosed: true }] },
        null,
      );
      const written = prisma.organizationHours.createMany.mock.calls[0][0].data[0];
      // "Closed, 09:00-17:00" is a contradiction a reader has to resolve; the
      // flag wins and the times go.
      expect(written).toMatchObject({ isClosed: true, opensAt: null, closesAt: null });
    });
  });
});
