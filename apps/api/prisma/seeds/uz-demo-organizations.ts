import {
  OrganizationServiceType,
  OrganizationType,
  PrismaClient,
  type Organization,
} from '@prisma/client';
import { UZ_REGIONS, REGION_SOURCE } from '../../src/modules/geography/uz-regions.reference';
import {
  DEMO_DISTRICTS,
  DEMO_DISTRICT_SOURCE,
} from '../../src/modules/geography/demo-districts';

/**
 * Demo organizations across Uzbekistan.
 *
 * Every one of these is fictional and every row sets `isDemo: true`. None of
 * them is, or is named after, a real hospital or blood centre: the names are
 * built from "Demo" plus a generic facility word plus the place, and the
 * contact details are `.local` addresses and 00-00-00 numbers that cannot
 * reach anyone. Naming a real institution here would put claims about its
 * opening hours, services and verification status into a database that looks
 * authoritative, which is not ours to make.
 *
 * Coordinates are approximate city centres -- enough for a radius search to
 * behave sensibly in a demo, and not offered as anyone's real address.
 */
interface DemoOrganization {
  name: string;
  type: OrganizationType;
  regionCode: string;
  districtCode: string;
  latitude: number;
  longitude: number;
  address: string;
  acceptsDonations: boolean;
  providesLaboratory: boolean;
  services: OrganizationServiceType[];
  /** Whether a platform administrator has confirmed this entry, in the demo. */
  verified: boolean;
}

const S = OrganizationServiceType;

/**
 * Four in Tashkent city, so radius search has something to sort, and one in
 * every other region, so no region filter is ever a dead end.
 */
export const DEMO_ORGANIZATIONS: readonly DemoOrganization[] = [
  {
    name: 'Demo Republican Blood Centre — Tashkent',
    type: OrganizationType.BLOOD_CENTER,
    regionCode: 'UZ-TK', districtCode: 'yunusobod',
    latitude: 41.3608, longitude: 69.2896,
    address: 'Demo ko‘chasi 1, Yunusobod',
    acceptsDonations: true, providesLaboratory: true,
    services: [S.WHOLE_BLOOD_DONATION, S.PLASMA_DONATION, S.PLATELET_DONATION, S.LABORATORY_TESTING, S.BLOOD_TYPING, S.EMERGENCY_SUPPLY],
    verified: true,
  },
  {
    name: 'Demo City Hospital — Chilonzor',
    type: OrganizationType.HOSPITAL,
    regionCode: 'UZ-TK', districtCode: 'chilonzor',
    latitude: 41.2756, longitude: 69.2044,
    address: 'Demo ko‘chasi 12, Chilonzor',
    acceptsDonations: true, providesLaboratory: false,
    services: [S.WHOLE_BLOOD_DONATION, S.HEALTH_SCREENING],
    verified: true,
  },
  {
    name: 'Demo Clinical Hospital — Mirzo Ulug‘bek',
    type: OrganizationType.HOSPITAL,
    regionCode: 'UZ-TK', districtCode: 'mirzo-ulugbek',
    latitude: 41.3255, longitude: 69.3417,
    address: 'Demo ko‘chasi 7, Mirzo Ulug‘bek',
    acceptsDonations: true, providesLaboratory: true,
    services: [S.WHOLE_BLOOD_DONATION, S.LABORATORY_TESTING, S.BLOOD_TYPING],
    verified: false,
  },
  {
    name: 'Demo Donation Point — Shayxontohur',
    type: OrganizationType.BLOOD_CENTER,
    regionCode: 'UZ-TK', districtCode: 'shayxontohur',
    latitude: 41.3236, longitude: 69.2216,
    address: 'Demo ko‘chasi 3, Shayxontohur',
    acceptsDonations: true, providesLaboratory: false,
    services: [S.WHOLE_BLOOD_DONATION, S.MOBILE_DONATION_DRIVE],
    verified: false,
  },
  {
    name: 'Demo Regional Blood Centre — Samarkand',
    type: OrganizationType.BLOOD_CENTER,
    regionCode: 'UZ-SA', districtCode: 'samarqand-shahri',
    latitude: 39.6542, longitude: 66.9597,
    address: 'Demo ko‘chasi 5, Samarqand',
    acceptsDonations: true, providesLaboratory: true,
    services: [S.WHOLE_BLOOD_DONATION, S.PLASMA_DONATION, S.LABORATORY_TESTING, S.EMERGENCY_SUPPLY],
    verified: true,
  },
  {
    name: 'Demo Regional Hospital — Bukhara',
    type: OrganizationType.HOSPITAL,
    regionCode: 'UZ-BU', districtCode: 'buxoro-shahri',
    latitude: 39.7747, longitude: 64.4286,
    address: 'Demo ko‘chasi 9, Buxoro',
    acceptsDonations: true, providesLaboratory: true,
    services: [S.WHOLE_BLOOD_DONATION, S.LABORATORY_TESTING, S.HEALTH_SCREENING],
    verified: true,
  },
  {
    name: 'Demo Regional Blood Centre — Andijan',
    type: OrganizationType.BLOOD_CENTER,
    regionCode: 'UZ-AN', districtCode: 'andijon-shahri',
    latitude: 40.7821, longitude: 72.3442,
    address: 'Demo ko‘chasi 2, Andijon',
    acceptsDonations: true, providesLaboratory: true,
    services: [S.WHOLE_BLOOD_DONATION, S.PLASMA_DONATION, S.LABORATORY_TESTING],
    verified: false,
  },
  {
    name: 'Demo Regional Hospital — Fergana',
    type: OrganizationType.HOSPITAL,
    regionCode: 'UZ-FA', districtCode: 'fargona-shahri',
    latitude: 40.3864, longitude: 71.7864,
    address: 'Demo ko‘chasi 4, Farg‘ona',
    acceptsDonations: true, providesLaboratory: false,
    services: [S.WHOLE_BLOOD_DONATION, S.HEALTH_SCREENING],
    verified: false,
  },
  {
    name: 'Demo Regional Hospital — Namangan',
    type: OrganizationType.HOSPITAL,
    regionCode: 'UZ-NG', districtCode: 'namangan-shahri',
    latitude: 40.9983, longitude: 71.6726,
    address: 'Demo ko‘chasi 6, Namangan',
    acceptsDonations: true, providesLaboratory: true,
    services: [S.WHOLE_BLOOD_DONATION, S.LABORATORY_TESTING],
    verified: true,
  },
  {
    name: 'Demo Regional Blood Centre — Nukus',
    type: OrganizationType.BLOOD_CENTER,
    regionCode: 'UZ-QR', districtCode: 'nukus-shahri',
    latitude: 42.4600, longitude: 59.6172,
    address: 'Demo ko‘chasi 8, Nukus',
    acceptsDonations: true, providesLaboratory: true,
    services: [S.WHOLE_BLOOD_DONATION, S.PLASMA_DONATION, S.LABORATORY_TESTING, S.EMERGENCY_SUPPLY],
    verified: true,
  },
  {
    name: 'Demo Regional Hospital — Urgench',
    type: OrganizationType.HOSPITAL,
    regionCode: 'UZ-XO', districtCode: 'urganch-shahri',
    latitude: 41.5500, longitude: 60.6333,
    address: 'Demo ko‘chasi 11, Urganch',
    acceptsDonations: true, providesLaboratory: false,
    services: [S.WHOLE_BLOOD_DONATION],
    verified: false,
  },
  {
    name: 'Demo Regional Hospital — Qarshi',
    type: OrganizationType.HOSPITAL,
    regionCode: 'UZ-QA', districtCode: 'qarshi-shahri',
    latitude: 38.8606, longitude: 65.7891,
    address: 'Demo ko‘chasi 14, Qarshi',
    acceptsDonations: true, providesLaboratory: true,
    services: [S.WHOLE_BLOOD_DONATION, S.LABORATORY_TESTING, S.BLOOD_TYPING],
    verified: false,
  },
  {
    name: 'Demo Regional Hospital — Termez',
    type: OrganizationType.HOSPITAL,
    regionCode: 'UZ-SU', districtCode: 'termiz-shahri',
    latitude: 37.2242, longitude: 67.2783,
    address: 'Demo ko‘chasi 15, Termiz',
    acceptsDonations: true, providesLaboratory: false,
    services: [S.WHOLE_BLOOD_DONATION, S.MOBILE_DONATION_DRIVE],
    verified: false,
  },
  {
    name: 'Demo Regional Hospital — Navoiy',
    type: OrganizationType.HOSPITAL,
    regionCode: 'UZ-NW', districtCode: 'navoiy-shahri',
    latitude: 40.0844, longitude: 65.3792,
    address: 'Demo ko‘chasi 16, Navoiy',
    acceptsDonations: true, providesLaboratory: true,
    services: [S.WHOLE_BLOOD_DONATION, S.LABORATORY_TESTING],
    verified: false,
  },
  {
    name: 'Demo Regional Hospital — Gulistan',
    type: OrganizationType.HOSPITAL,
    regionCode: 'UZ-SI', districtCode: 'guliston-shahri',
    latitude: 40.4897, longitude: 68.7842,
    address: 'Demo ko‘chasi 17, Guliston',
    acceptsDonations: true, providesLaboratory: false,
    services: [S.WHOLE_BLOOD_DONATION],
    verified: false,
  },
  {
    name: 'Demo District Hospital — Chirchiq',
    type: OrganizationType.HOSPITAL,
    regionCode: 'UZ-TO', districtCode: 'chirchiq-shahri',
    latitude: 41.4689, longitude: 69.5822,
    address: 'Demo ko‘chasi 18, Chirchiq',
    acceptsDonations: true, providesLaboratory: false,
    services: [S.WHOLE_BLOOD_DONATION, S.HEALTH_SCREENING],
    verified: false,
  },
  {
    name: 'Demo Regional Hospital — Jizzakh',
    type: OrganizationType.HOSPITAL,
    regionCode: 'UZ-JI', districtCode: 'jizzax-shahri',
    latitude: 40.1250, longitude: 67.8800,
    address: 'Demo ko‘chasi 19, Jizzax',
    acceptsDonations: true, providesLaboratory: true,
    services: [S.WHOLE_BLOOD_DONATION, S.LABORATORY_TESTING],
    verified: true,
  },
] as const;

/** Weekdays 09:00–17:00, Saturday morning, Sunday closed. */
function standardHours(organizationId: string) {
  return [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => {
    if (dayOfWeek === 0) {
      return { organizationId, dayOfWeek, isClosed: true, opensAt: null, closesAt: null };
    }
    if (dayOfWeek === 6) {
      return { organizationId, dayOfWeek, isClosed: false, opensAt: '09:00', closesAt: '13:00' };
    }
    return { organizationId, dayOfWeek, isClosed: false, opensAt: '09:00', closesAt: '17:00' };
  });
}

/**
 * Writes the geography reference data and the demo organizations.
 *
 * Idempotent throughout: regions upsert on their ISO code, districts on
 * (region, slug), and organizations on their demo name -- so re-running the
 * seed does not duplicate anything and, crucially, does not touch the
 * organization ids that appointments and memberships already point at.
 */
export async function seedUzGeographyAndOrganizations(db: PrismaClient) {
  for (const region of UZ_REGIONS) {
    const data = {
      nameUz: region.nameUz,
      nameRu: region.nameRu,
      nameEn: region.nameEn,
      centerEn: region.centerEn,
      sortOrder: region.sortOrder,
      source: REGION_SOURCE,
    };
    await db.region.upsert({
      where: { code: region.code },
      update: data,
      create: { code: region.code, ...data },
    });
  }

  const regionIdByCode = new Map(
    (await db.region.findMany({ select: { id: true, code: true } })).map((r) => [r.code, r.id]),
  );

  for (const district of DEMO_DISTRICTS) {
    const regionId = regionIdByCode.get(district.regionCode);
    if (!regionId) continue;
    const data = {
      nameUz: district.nameUz,
      nameRu: district.nameRu,
      nameEn: district.nameEn,
      sortOrder: district.sortOrder,
      source: DEMO_DISTRICT_SOURCE,
    };
    await db.district.upsert({
      where: { regionId_code: { regionId, code: district.code } },
      update: data,
      create: { regionId, code: district.code, ...data },
    });
  }

  const districtIdByKey = new Map(
    (await db.district.findMany({ select: { id: true, code: true, regionId: true } })).map((d) => [
      `${d.regionId}/${d.code}`,
      d.id,
    ]),
  );

  const created: Organization[] = [];
  for (const spec of DEMO_ORGANIZATIONS) {
    const regionId = regionIdByCode.get(spec.regionCode);
    if (!regionId) continue;
    const districtId = districtIdByKey.get(`${regionId}/${spec.districtCode}`) ?? null;

    const directory = {
      type: spec.type,
      regionId,
      districtId,
      address: spec.address,
      latitude: spec.latitude,
      longitude: spec.longitude,
      acceptsDonations: spec.acceptsDonations,
      providesLaboratory: spec.providesLaboratory,
      // A .local address and an unroutable number: nothing here can reach a
      // real person by accident.
      email: `contact@${spec.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.local`,
      publicPhone: '+998 71 000 00 00',
      phone: '+998 71 000 00 00',
      status: 'ACTIVE' as const,
      isDemo: true,
      verifiedAt: spec.verified ? new Date('2026-09-01T00:00:00.000Z') : null,
    };

    // Matched on the name: the demo names are unique and stable, so a re-seed
    // updates in place rather than creating a second copy under a new id.
    const existing = await db.organization.findFirst({ where: { name: spec.name } });
    const organization = existing
      ? await db.organization.update({ where: { id: existing.id }, data: directory })
      : await db.organization.create({
          data: {
            name: spec.name,
            ...directory,
            ...(spec.type === OrganizationType.HOSPITAL
              ? { hospital: { create: {} } }
              : { bloodCenter: { create: {} } }),
          },
        });
    created.push(organization);

    await db.organizationService.deleteMany({ where: { organizationId: organization.id } });
    await db.organizationService.createMany({
      data: spec.services.map((service) => ({ organizationId: organization.id, service })),
      skipDuplicates: true,
    });

    await db.organizationHours.deleteMany({ where: { organizationId: organization.id } });
    await db.organizationHours.createMany({
      data: standardHours(organization.id),
      skipDuplicates: true,
    });
  }

  return {
    regions: UZ_REGIONS.length,
    districts: districtIdByKey.size,
    organizations: created.length,
  };
}
