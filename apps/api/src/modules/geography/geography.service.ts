import { Injectable, Logger } from '@nestjs/common';
import { GeoDataSource } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { UZ_REGIONS, REGION_SOURCE } from './uz-regions.reference';
import { DEMO_DISTRICTS, DEMO_DISTRICT_SOURCE } from './demo-districts';

@Injectable()
export class GeographyService {
  private readonly logger = new Logger(GeographyService.name);

  constructor(private readonly db: PrismaService) {}

  /**
   * Every region, ordered the way someone who lives here reads the list.
   *
   * No pagination: there are fourteen, and a picker that pages through fourteen
   * items is worse than one that does not.
   */
  async listRegions() {
    const regions = await this.db.region.findMany({
      orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }],
      select: {
        id: true,
        code: true,
        nameUz: true,
        nameRu: true,
        nameEn: true,
        centerEn: true,
        source: true,
        _count: { select: { districts: true } },
      },
    });
    return regions.map(({ _count, ...region }) => ({
      ...region,
      districtCount: _count.districts,
    }));
  }

  /**
   * Districts, optionally within one region.
   *
   * `source` rides along on every row on purpose: the district table is
   * incomplete demo data, and a client that renders it without saying so is
   * presenting invented administrative units as real ones.
   */
  async listDistricts(regionId?: string) {
    return this.db.district.findMany({
      where: regionId ? { regionId } : undefined,
      orderBy: [{ region: { sortOrder: 'asc' } }, { sortOrder: 'asc' }, { nameEn: 'asc' }],
      select: {
        id: true,
        code: true,
        regionId: true,
        nameUz: true,
        nameRu: true,
        nameEn: true,
        source: true,
      },
    });
  }

  /**
   * What a client needs to decide whether to trust what it is showing.
   *
   * Reported rather than assumed: a deployment that has imported a real
   * classifier should stop seeing the "demo districts" badge without anyone
   * editing the client.
   */
  async describeCoverage() {
    const [regionTotal, regionOfficial, districtTotal, districtOfficial] = await Promise.all([
      this.db.region.count(),
      this.db.region.count({ where: { source: GeoDataSource.OFFICIAL_REFERENCE } }),
      this.db.district.count(),
      this.db.district.count({ where: { source: GeoDataSource.OFFICIAL_REFERENCE } }),
    ]);
    return {
      regions: { total: regionTotal, official: regionOfficial, demo: regionTotal - regionOfficial },
      districts: {
        total: districtTotal,
        official: districtOfficial,
        demo: districtTotal - districtOfficial,
      },
      /**
       * True only when every district row came from a published classifier.
       * Until someone imports one this is false, and the directory says so.
       */
      districtsAuthoritative: districtTotal > 0 && districtOfficial === districtTotal,
      regionStandard: 'ISO 3166-2:UZ',
    };
  }

  /**
   * Upserts the reference data. Idempotent: keyed on the ISO code for regions
   * and on (region, slug) for districts, so running it twice changes nothing
   * and running it after a rename corrects the name without orphaning the
   * organizations pointing at the row.
   */
  async syncReferenceData() {
    let regionsWritten = 0;
    for (const region of UZ_REGIONS) {
      const data = {
        nameUz: region.nameUz,
        nameRu: region.nameRu,
        nameEn: region.nameEn,
        centerEn: region.centerEn,
        sortOrder: region.sortOrder,
        source: REGION_SOURCE,
      };
      await this.db.region.upsert({
        where: { code: region.code },
        update: data,
        create: { code: region.code, ...data },
      });
      regionsWritten += 1;
    }

    const byCode = new Map(
      (await this.db.region.findMany({ select: { id: true, code: true } })).map((r) => [
        r.code,
        r.id,
      ]),
    );

    let districtsWritten = 0;
    for (const district of DEMO_DISTRICTS) {
      const regionId = byCode.get(district.regionCode);
      if (!regionId) {
        // A district whose region is not in the reference list is a typo in
        // the demo file, not a reason to abort the whole sync.
        this.logger.warn(
          `Skipping demo district ${district.code}: unknown region ${district.regionCode}`,
        );
        continue;
      }
      const data = {
        nameUz: district.nameUz,
        nameRu: district.nameRu,
        nameEn: district.nameEn,
        sortOrder: district.sortOrder,
        source: DEMO_DISTRICT_SOURCE,
      };
      await this.db.district.upsert({
        where: { regionId_code: { regionId, code: district.code } },
        update: data,
        create: { regionId, code: district.code, ...data },
      });
      districtsWritten += 1;
    }

    return { regions: regionsWritten, districts: districtsWritten };
  }
}
