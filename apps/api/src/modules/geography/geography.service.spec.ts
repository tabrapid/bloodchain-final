import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { GeographyService } from './geography.service';
import { UZ_REGIONS } from './uz-regions.reference';
import { DEMO_DISTRICTS } from './demo-districts';

describe('GeographyService', () => {
  let service: GeographyService;
  let prisma: {
    region: { findMany: jest.Mock; count: jest.Mock; upsert: jest.Mock };
    district: { findMany: jest.Mock; count: jest.Mock; upsert: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      region: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        upsert: jest.fn().mockResolvedValue({}),
      },
      district: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        upsert: jest.fn().mockResolvedValue({}),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [GeographyService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(GeographyService);
  });

  describe('the region reference list', () => {
    it('has all fourteen ISO 3166-2:UZ subdivisions and no more', () => {
      // Twelve viloyats, Karakalpakstan, and the city of Tashkent.
      expect(UZ_REGIONS).toHaveLength(14);
    });

    it('uses ISO codes, which is what makes a re-seed idempotent', () => {
      for (const region of UZ_REGIONS) {
        expect(region.code).toMatch(/^UZ-[A-Z]{2}$/);
      }
    });

    it('has no duplicate codes', () => {
      const codes = UZ_REGIONS.map((r) => r.code);
      expect(new Set(codes).size).toBe(codes.length);
    });

    it('names every region in all three languages', () => {
      for (const region of UZ_REGIONS) {
        expect(region.nameUz.trim()).not.toBe('');
        expect(region.nameRu.trim()).not.toBe('');
        expect(region.nameEn.trim()).not.toBe('');
      }
    });

    it('gives Russian names in Cyrillic, not a transliteration of the Uzbek', () => {
      for (const region of UZ_REGIONS) {
        expect(region.nameRu).toMatch(/[Ѐ-ӿ]/);
      }
    });

    it('orders them deterministically, with the capital first', () => {
      const orders = UZ_REGIONS.map((r) => r.sortOrder);
      expect(new Set(orders).size).toBe(orders.length);
      expect(UZ_REGIONS.find((r) => r.sortOrder === 1)!.code).toBe('UZ-TK');
    });
  });

  describe('the demo district list', () => {
    it('only references regions that exist in the reference list', () => {
      const codes = new Set(UZ_REGIONS.map((r) => r.code));
      const orphans = DEMO_DISTRICTS.filter((d) => !codes.has(d.regionCode)).map((d) => d.code);
      expect(orphans).toEqual([]);
    });

    it('has no duplicate slug within a region', () => {
      const seen = new Set<string>();
      const duplicates: string[] = [];
      for (const district of DEMO_DISTRICTS) {
        const key = `${district.regionCode}/${district.code}`;
        if (seen.has(key)) duplicates.push(key);
        seen.add(key);
      }
      expect(duplicates).toEqual([]);
    });

    it('gives every region at least one district, so a region filter is never a dead end', () => {
      const covered = new Set(DEMO_DISTRICTS.map((d) => d.regionCode));
      const uncovered = UZ_REGIONS.filter((r) => !covered.has(r.code)).map((r) => r.code);
      expect(uncovered).toEqual([]);
    });

    it('names every district in all three languages', () => {
      for (const district of DEMO_DISTRICTS) {
        expect(district.nameUz.trim()).not.toBe('');
        expect(district.nameRu.trim()).not.toBe('');
        expect(district.nameEn.trim()).not.toBe('');
      }
    });
  });

  describe('syncing reference data', () => {
    it('upserts regions on the ISO code, so running it twice is a no-op', async () => {
      await service.syncReferenceData();
      const first = prisma.region.upsert.mock.calls[0][0];
      expect(first.where).toEqual({ code: 'UZ-TK' });
      expect(prisma.region.upsert).toHaveBeenCalledTimes(14);
    });

    it('marks every region OFFICIAL_REFERENCE', async () => {
      await service.syncReferenceData();
      for (const call of prisma.region.upsert.mock.calls) {
        expect(call[0].create.source).toBe('OFFICIAL_REFERENCE');
        expect(call[0].update.source).toBe('OFFICIAL_REFERENCE');
      }
    });

    it('marks every district DEMO, because this repository has no district classifier', async () => {
      prisma.region.findMany.mockResolvedValue(
        UZ_REGIONS.map((r) => ({ id: `id-${r.code}`, code: r.code })),
      );
      await service.syncReferenceData();
      expect(prisma.district.upsert).toHaveBeenCalled();
      for (const call of prisma.district.upsert.mock.calls) {
        expect(call[0].create.source).toBe('DEMO');
        expect(call[0].update.source).toBe('DEMO');
      }
    });

    it('upserts districts on (region, slug), which survives a rename', async () => {
      prisma.region.findMany.mockResolvedValue([{ id: 'id-UZ-TK', code: 'UZ-TK' }]);
      await service.syncReferenceData();
      expect(prisma.district.upsert.mock.calls[0][0].where).toEqual({
        regionId_code: { regionId: 'id-UZ-TK', code: 'yunusobod' },
      });
    });

    it('skips a district whose region is missing rather than aborting the sync', async () => {
      prisma.region.findMany.mockResolvedValue([{ id: 'id-UZ-TK', code: 'UZ-TK' }]);
      const result = await service.syncReferenceData();
      // Only the Tashkent-city districts can be written; the rest are skipped,
      // and the regions still got their upserts.
      expect(result.regions).toBe(14);
      expect(result.districts).toBeLessThan(DEMO_DISTRICTS.length);
      expect(result.districts).toBeGreaterThan(0);
    });
  });

  describe('coverage reporting', () => {
    it('does not claim districts are authoritative while any row is demo', async () => {
      prisma.region.count.mockResolvedValueOnce(14).mockResolvedValueOnce(14);
      prisma.district.count.mockResolvedValueOnce(21).mockResolvedValueOnce(0);
      const coverage = await service.describeCoverage();
      expect(coverage.districtsAuthoritative).toBe(false);
      expect(coverage.districts.demo).toBe(21);
    });

    it('does not claim authority over an empty district table either', async () => {
      prisma.region.count.mockResolvedValueOnce(14).mockResolvedValueOnce(14);
      prisma.district.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
      // 0 === 0 is true and would read as "all rows are official"; an empty
      // table is not coverage.
      expect((await service.describeCoverage()).districtsAuthoritative).toBe(false);
    });

    it('does claim authority once every district row is sourced', async () => {
      prisma.region.count.mockResolvedValueOnce(14).mockResolvedValueOnce(14);
      prisma.district.count.mockResolvedValueOnce(208).mockResolvedValueOnce(208);
      expect((await service.describeCoverage()).districtsAuthoritative).toBe(true);
    });

    it('names the standard the regions came from', async () => {
      expect((await service.describeCoverage()).regionStandard).toBe('ISO 3166-2:UZ');
    });
  });

  describe('listing', () => {
    it('scopes districts to a region when one is given', async () => {
      await service.listDistricts('region-tk');
      expect(prisma.district.findMany.mock.calls[0][0].where).toEqual({ regionId: 'region-tk' });
    });

    it('returns every district when no region is given', async () => {
      await service.listDistricts();
      expect(prisma.district.findMany.mock.calls[0][0].where).toBeUndefined();
    });

    it('includes the source on every district row, so a client can badge demo data', async () => {
      await service.listDistricts();
      expect(prisma.district.findMany.mock.calls[0][0].select.source).toBe(true);
    });

    it('reports how many districts each region has', async () => {
      prisma.region.findMany.mockResolvedValueOnce([
        { id: 'r1', code: 'UZ-TK', nameUz: 'a', nameRu: 'б', nameEn: 'c', centerEn: 'd',
          source: 'OFFICIAL_REFERENCE', _count: { districts: 5 } },
      ]);
      const regions = await service.listRegions();
      expect(regions[0]).toMatchObject({ code: 'UZ-TK', districtCount: 5 });
      expect(regions[0]).not.toHaveProperty('_count');
    });
  });
});
