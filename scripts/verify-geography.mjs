#!/usr/bin/env node
/**
 * Sprint 2 verification: Uzbekistan geography + organization directory.
 *
 * Read-mostly. Two sections mutate one demo organization (a directory edit and
 * a verification toggle) and restore it from a snapshot in a `finally`, because
 * the only honest way to check that a write works is to perform it.
 *
 * Every assertion runs against the real, compiled services from
 * `apps/api/dist` talking to the real database -- not a mock and not SQL this
 * script invented. Unit tests already cover the query builders with a mocked
 * Prisma; what they cannot show is that the generated SQL means what we think
 * it means against real rows, which is the whole point of this file.
 *
 * Distances are recomputed here with the spherical law of cosines -- a
 * different formula from the haversine the service uses -- so a bug in the
 * implementation cannot hide behind a copy of itself in the expectation.
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertLocalDatabase, fail } from './demo-guard.mjs';

let target;
try {
  target = assertLocalDatabase();
} catch (error) {
  fail(error.message);
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = path.join(ROOT, 'apps', 'api');
const require_ = createRequire(path.join(API, 'package.json'));
const dist = (rel) => path.join(API, 'dist', 'src', rel);

for (const rel of ['modules/geography/geography.service.js', 'modules/organizations/organizations.service.js']) {
  if (!fs.existsSync(dist(rel))) {
    fail(`apps/api/dist is missing ${rel}. Run "pnpm --filter api build" first.`);
  }
}

require_('reflect-metadata');
const { PrismaClient, OrganizationServiceType, OrganizationStatus, OrganizationType, GeoDataSource } =
  require_('@prisma/client');
const { GeographyService } = require_(dist('modules/geography/geography.service.js'));
const { OrganizationsService } = require_(dist('modules/organizations/organizations.service.js'));

// A dist built before this sprint would load fine and quietly verify nothing.
for (const [name, proto, method] of [
  ['OrganizationsService.discover', OrganizationsService.prototype, 'discover'],
  ['OrganizationsService.updateDirectory', OrganizationsService.prototype, 'updateDirectory'],
  ['GeographyService.describeCoverage', GeographyService.prototype, 'describeCoverage'],
]) {
  if (typeof proto[method] !== 'function') {
    fail(`${name} is not in apps/api/dist -- the build is stale. Run "pnpm --filter api build".`);
  }
}

let failures = 0;
let skipped = 0;
let passes = 0;
const check = (name, ok, detail = '') => {
  if (ok) passes += 1;
  else failures += 1;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};
const skip = (name, why) => {
  skipped += 1;
  console.log(`  skip ${name} — ${why}`);
};
const section = (name) => console.log(`\n${name}`);

/**
 * Great-circle distance by the spherical law of cosines. Deliberately not the
 * haversine the service uses: at these separations the two agree to metres, so
 * a disagreement is a real error rather than a rounding artefact.
 */
const RADIUS_KM = 6371;
const rad = (deg) => (deg * Math.PI) / 180;
function distanceKm(a, b) {
  const cos =
    Math.sin(rad(a.latitude)) * Math.sin(rad(b.latitude)) +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.cos(rad(b.longitude - a.longitude));
  return Math.acos(Math.min(1, Math.max(-1, cos))) * RADIUS_KM;
}

const num = (decimal) => (decimal === null || decimal === undefined ? null : Number(decimal));
const sorted = (values) => [...values].sort();
const same = (a, b) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));

async function threw(promise) {
  try {
    await promise;
    return null;
  } catch (error) {
    return error;
  }
}

/** Nest exposes the HTTP status either as a field or behind getStatus(). */
const statusOf = (error) =>
  error === null || error === undefined
    ? null
    : (typeof error.getStatus === 'function' ? error.getStatus() : error.status) ?? null;

const db = new PrismaClient();
const geography = new GeographyService(db);
const organizations = new OrganizationsService(db);

async function main() {
  console.log(`\nSprint 2 verification — ${target.database} on ${target.host}\n`);

  // ---------------------------------------------------------------- geography
  section('Geography reference data');

  const regions = await geography.listRegions();
  check('regions are loaded', regions.length === 14, `${regions.length} regions`);
  check(
    'every region is OFFICIAL_REFERENCE',
    regions.every((r) => r.source === GeoDataSource.OFFICIAL_REFERENCE),
    'no demo row is presented as a real region',
  );
  check(
    'every region code is an ISO 3166-2:UZ code',
    regions.every((r) => /^UZ-[A-Z]{2}$/.test(r.code)),
    regions.map((r) => r.code).join(' '),
  );
  check(
    'region codes are unique',
    new Set(regions.map((r) => r.code)).size === regions.length,
  );
  check(
    'every region is named in all three languages',
    regions.every((r) => r.nameUz && r.nameRu && r.nameEn),
  );
  check(
    'Tashkent city sorts first',
    regions[0]?.code === 'UZ-TK',
    regions[0]?.nameEn ?? 'no regions',
  );
  check(
    'every region reports its district count',
    regions.every((r) => typeof r.districtCount === 'number' && r.districtCount > 0),
    'no region filter is a dead end',
  );

  const districts = await geography.listDistricts();
  check('districts are loaded', districts.length > 0, `${districts.length} districts`);
  check(
    'every district is flagged DEMO',
    districts.every((d) => d.source === GeoDataSource.DEMO),
    'no invented administrative unit claims to be official',
  );
  const regionIds = new Set(regions.map((r) => r.id));
  check(
    'every district belongs to a real region',
    districts.every((d) => regionIds.has(d.regionId)),
  );
  check(
    'every region has at least one district',
    new Set(districts.map((d) => d.regionId)).size === regions.length,
  );

  const tashkent = regions.find((r) => r.code === 'UZ-TK');
  const tashkentDistricts = await geography.listDistricts(tashkent.id);
  check(
    'listDistricts(regionId) returns only that region',
    tashkentDistricts.length > 0 && tashkentDistricts.every((d) => d.regionId === tashkent.id),
    `${tashkentDistricts.length} districts in ${tashkent.nameEn}`,
  );

  const coverage = await geography.describeCoverage();
  check(
    'coverage counts match the tables',
    coverage.regions.total === regions.length && coverage.districts.total === districts.length,
  );
  check(
    'coverage reports the region standard',
    coverage.regionStandard === 'ISO 3166-2:UZ',
    coverage.regionStandard,
  );
  check(
    'districtsAuthoritative is false while districts are demo data',
    coverage.districtsAuthoritative === false,
    `${coverage.districts.official}/${coverage.districts.total} official`,
  );

  // Idempotency: the sync is what a deploy runs, and a deploy runs more than once.
  const beforeIds = (await db.region.findMany({ select: { id: true, code: true } })).map(
    (r) => `${r.code}:${r.id}`,
  );
  const beforeDistrictIds = (await db.district.findMany({ select: { id: true } })).map((d) => d.id);
  await geography.syncReferenceData();
  const afterIds = (await db.region.findMany({ select: { id: true, code: true } })).map(
    (r) => `${r.code}:${r.id}`,
  );
  const afterDistrictIds = (await db.district.findMany({ select: { id: true } })).map((d) => d.id);
  check(
    'syncReferenceData is idempotent for regions',
    same(beforeIds, afterIds),
    're-running a deploy neither duplicates nor re-keys a region',
  );
  check(
    'syncReferenceData is idempotent for districts',
    same(beforeDistrictIds, afterDistrictIds),
  );

  // ----------------------------------------------------------- demo seed data
  section('Demo organizations');

  const demo = await db.organization.findMany({
    where: { isDemo: true },
    select: {
      id: true, name: true, email: true, publicPhone: true, address: true,
      latitude: true, longitude: true, regionId: true, districtId: true,
      verifiedAt: true, acceptsDonations: true, providesLaboratory: true,
      services: { select: { service: true } },
      hours: { select: { dayOfWeek: true } },
    },
  });
  check('demo organizations are seeded', demo.length > 0, `${demo.length} organizations`);
  check(
    'every demo organization is named "Demo …"',
    demo.every((o) => o.name.startsWith('Demo ')),
    'nothing here can be mistaken for a real institution',
  );
  check(
    'every demo organization uses an unreachable .local address',
    demo.every((o) => o.email === null || o.email.endsWith('.local')),
  );
  check(
    'every demo organization has a region and a district',
    demo.every((o) => o.regionId && o.districtId),
  );
  check(
    'every demo organization has coordinates',
    demo.every((o) => o.latitude !== null && o.longitude !== null),
  );
  check(
    'every demo organization lists at least one service',
    demo.every((o) => o.services.length > 0),
  );
  check(
    'every demo organization publishes a full week of hours',
    demo.every((o) => new Set(o.hours.map((h) => h.dayOfWeek)).size === 7),
  );
  check(
    'demo organizations cover every region',
    new Set(demo.map((o) => o.regionId)).size === regions.length,
    `${new Set(demo.map((o) => o.regionId)).size}/${regions.length} regions`,
  );
  const nonDemo = await db.organization.findMany({
    where: { isDemo: false },
    select: { id: true, name: true, type: true, status: true, regionId: true, createdAt: true },
  });
  check(
    'no pre-existing organization was flagged as demo',
    nonDemo.length > 0,
    `${nonDemo.length} real organizations untouched`,
  );

  // ------------------------------------------------------- directory filtering
  section('Directory filtering (staff)');

  const all = await organizations.findMany({ limit: 200 });
  const systemCount = await db.organization.count({ where: { type: OrganizationType.SYSTEM } });
  if (systemCount === 0) {
    skip('SYSTEM organizations are excluded', 'this database has none to exclude');
  } else {
    check(
      'SYSTEM organizations are excluded',
      all.data.every((o) => o.type !== OrganizationType.SYSTEM),
    );
  }
  check(
    'every directory row carries an isVerified boolean',
    all.data.every((o) => typeof o.isVerified === 'boolean'),
  );
  check(
    'isVerified agrees with verifiedAt',
    all.data.every((o) => o.isVerified === (o.verifiedAt !== null)),
  );

  const byRegion = await organizations.findMany({ regionId: tashkent.id, limit: 200 });
  const expectedRegion = await db.organization.count({
    where: {
      regionId: tashkent.id,
      status: OrganizationStatus.ACTIVE,
      type: { not: OrganizationType.SYSTEM },
    },
  });
  check(
    'region filter returns exactly the organizations in that region',
    byRegion.meta.total === expectedRegion &&
      byRegion.data.every((o) => o.region?.id === tashkent.id),
    `${byRegion.meta.total} in ${tashkent.nameEn}`,
  );

  const districtWithOrgs = tashkentDistricts.find((d) =>
    demo.some((o) => o.districtId === d.id),
  );
  if (!districtWithOrgs) {
    skip('district filter narrows the region', 'no seeded district in Tashkent city has an organization');
  } else {
    const byDistrict = await organizations.findMany({
      regionId: tashkent.id,
      districtId: districtWithOrgs.id,
      limit: 200,
    });
    check(
      'district filter narrows the region',
      byDistrict.meta.total > 0 &&
        byDistrict.meta.total <= byRegion.meta.total &&
        byDistrict.data.every((o) => o.district?.id === districtWithOrgs.id),
      `${byDistrict.meta.total} in ${districtWithOrgs.nameEn}, of ${byRegion.meta.total} in the region`,
    );
  }

  const service = OrganizationServiceType.PLASMA_DONATION;
  const byService = await organizations.findMany({ service, limit: 200 });
  const expectedService = await db.organization.count({
    where: {
      status: OrganizationStatus.ACTIVE,
      type: { not: OrganizationType.SYSTEM },
      services: { some: { service } },
    },
  });
  check(
    'service filter returns exactly the organizations offering it',
    byService.meta.total === expectedService &&
      byService.data.every((o) => o.services.some((s) => s.service === service)),
    `${byService.meta.total} offer ${service}`,
  );

  const withLab = await organizations.findMany({ providesLaboratory: true, limit: 200 });
  const withoutLab = await organizations.findMany({ providesLaboratory: false, limit: 200 });
  check(
    'laboratory availability partitions the directory',
    withLab.meta.total + withoutLab.meta.total === all.meta.total &&
      withLab.data.every((o) => o.providesLaboratory) &&
      withoutLab.data.every((o) => !o.providesLaboratory),
    `${withLab.meta.total} with a laboratory, ${withoutLab.meta.total} without, ${all.meta.total} total`,
  );

  const verified = await organizations.findMany({ verified: true, limit: 200 });
  const unverified = await organizations.findMany({ verified: false, limit: 200 });
  check(
    'verification status partitions the directory',
    verified.meta.total + unverified.meta.total === all.meta.total &&
      verified.data.every((o) => o.isVerified) &&
      unverified.data.every((o) => !o.isVerified),
    `${verified.meta.total} verified, ${unverified.meta.total} not`,
  );

  const donating = await organizations.findMany({ acceptsDonations: true, limit: 200 });
  check(
    'donation availability filter is honoured',
    donating.meta.total > 0 && donating.data.every((o) => o.acceptsDonations),
    `${donating.meta.total} accept donations`,
  );

  const search = await organizations.findMany({ search: 'chilonzor', limit: 200 });
  check(
    'search matches name or address, case-insensitively',
    search.meta.total > 0 &&
      search.data.every(
        (o) =>
          o.name.toLowerCase().includes('chilonzor') ||
          (o.address ?? '').toLowerCase().includes('chilonzor'),
      ),
    `${search.meta.total} matched "chilonzor"`,
  );

  // ------------------------------------------------------------ donor discovery
  section('Donor discovery');

  const suspendedAttempt = await organizations.discover({
    status: OrganizationStatus.SUSPENDED,
    limit: 200,
  });
  check(
    'discovery only ever returns ACTIVE organizations',
    suspendedAttempt.data.every((o) => o.status === OrganizationStatus.ACTIVE),
    'a donor cannot widen the list by passing status',
  );
  check(
    'discovery without a radius reports no distance',
    suspendedAttempt.data.every((o) => o.distanceKm === null),
    'rather than a zero that would sort like "here"',
  );

  const centre = { latitude: 41.3, longitude: 69.25 };
  const candidates = (
    await db.organization.findMany({
      where: {
        status: OrganizationStatus.ACTIVE,
        type: { not: OrganizationType.SYSTEM },
        latitude: { not: null },
        longitude: { not: null },
      },
      select: { id: true, name: true, latitude: true, longitude: true },
    })
  ).map((o) => ({
    id: o.id,
    name: o.name,
    km: distanceKm(centre, { latitude: num(o.latitude), longitude: num(o.longitude) }),
  }));

  for (const radiusKm of [50, 300]) {
    const expected = candidates.filter((c) => c.km <= radiusKm);
    const found = await organizations.discover({ ...centre, radiusKm, limit: 200 });
    check(
      `radius ${radiusKm} km returns exactly the organizations inside the circle`,
      found.meta.total === expected.length &&
        same(found.data.map((o) => o.id), expected.map((c) => c.id)),
      `${found.meta.total} found, ${expected.length} expected`,
    );
    check(
      `radius ${radiusKm} km sorts nearest first`,
      found.data.every((o, i) => i === 0 || found.data[i - 1].distanceKm <= o.distanceKm),
      found.data.slice(0, 3).map((o) => `${o.name} ${o.distanceKm}km`).join(', '),
    );
    const worst = Math.max(
      0,
      ...found.data.map((o) => {
        const mine = expected.find((c) => c.id === o.id);
        return mine ? Math.abs(mine.km - o.distanceKm) : Infinity;
      }),
    );
    check(
      `radius ${radiusKm} km distances agree with an independent formula`,
      worst <= 0.1,
      `largest disagreement ${worst.toFixed(3)} km`,
    );
  }

  const near = candidates.filter((c) => c.km <= 50);
  const far = candidates.filter((c) => c.km > 50 && c.km <= 300);
  check(
    'the seed gives radius search something to discriminate',
    near.length >= 2 && far.length >= 1,
    `${near.length} within 50 km, ${far.length} more between 50 and 300 km`,
  );

  // Paging has to happen after the distance filter, or the totals lie.
  const paged = [];
  let page = 1;
  let meta = null;
  do {
    const res = await organizations.discover({ ...centre, radiusKm: 300, page, limit: 2 });
    meta = res.meta;
    paged.push(...res.data.map((o) => o.id));
    page += 1;
  } while (page <= meta.totalPages && page < 50);
  const expected300 = candidates.filter((c) => c.km <= 300);
  check(
    'paging a radius search neither drops nor duplicates a result',
    paged.length === expected300.length && same(paged, expected300.map((c) => c.id)),
    `${paged.length} across ${meta.totalPages} pages of 2, ${expected300.length} expected`,
  );
  check(
    'a radius search reports the radius it used',
    meta.radiusKm === 300,
  );

  const partialRadius = await organizations.discover({ latitude: 41.3, radiusKm: 50, limit: 200 });
  check(
    'a half-specified centre is ignored rather than guessed',
    partialRadius.data.every((o) => o.distanceKm === null),
    'latitude without longitude returns the unfiltered list, not a made-up circle',
  );

  const regionDiscovery = await organizations.discover({ regionId: tashkent.id, limit: 200 });
  check(
    'discovery honours the region filter',
    regionDiscovery.meta.total > 0 &&
      regionDiscovery.data.every((o) => o.region?.id === tashkent.id),
    `${regionDiscovery.meta.total} in ${tashkent.nameEn}`,
  );

  // ------------------------------------------------------------- org isolation
  section('Organization isolation and verification');

  const superAdmin = await db.organizationMembership.findFirst({
    where: { status: 'ACTIVE', role: { code: 'SUPER_ADMIN' } },
    select: { userId: true },
  });
  const hospitalAdmin = await db.organizationMembership.findFirst({
    where: { status: 'ACTIVE', role: { code: 'HOSPITAL_ADMIN' } },
    select: { userId: true, organizationId: true },
  });

  if (!superAdmin) {
    skip('a platform administrator may edit any organization', 'no SUPER_ADMIN membership seeded');
  } else {
    const editable = await organizations.editableOrganizationIds(superAdmin.userId);
    check(
      'a platform administrator may edit any organization',
      editable === null,
      'null means "no restriction", which is not the same as an empty list',
    );
  }

  if (!hospitalAdmin) {
    skip('a hospital administrator may edit only their own', 'no HOSPITAL_ADMIN membership seeded');
  } else {
    const editable = await organizations.editableOrganizationIds(hospitalAdmin.userId);
    check(
      'a hospital administrator may edit only their own organization',
      Array.isArray(editable) && editable.includes(hospitalAdmin.organizationId),
      `${editable?.length ?? 0} organization(s)`,
    );

    const other = demo.find((o) => !editable.includes(o.id));
    const denied = await threw(
      organizations.updateDirectory(other.id, { publicPhone: '+998 71 000 00 01' }, editable),
    );
    check(
      'editing another organization is refused',
      statusOf(denied) === 403,
      denied ? `${statusOf(denied)} ${denied.message}` : 'the edit was allowed',
    );
    const stillUnchanged = await db.organization.findUnique({
      where: { id: other.id },
      select: { publicPhone: true },
    });
    check(
      'the refused edit wrote nothing',
      stillUnchanged.publicPhone !== '+998 71 000 00 01',
    );
  }

  const victim = demo[0];
  const emptyMembership = await threw(
    organizations.updateDirectory(victim.id, { publicPhone: '+998 71 000 00 02' }, []),
  );
  check(
    'an account that belongs to nothing may edit nothing',
    statusOf(emptyMembership) === 403,
    'an empty membership list is not a skeleton key',
  );

  const foreignDistrict = districts.find((d) => d.regionId !== victim.regionId);
  const crossed = await threw(
    organizations.updateDirectory(
      victim.id,
      { regionId: victim.regionId, districtId: foreignDistrict.id },
      null,
    ),
  );
  check(
    'a district outside the chosen region is refused',
    statusOf(crossed) === 403 || statusOf(crossed) === 404,
    crossed ? `${statusOf(crossed)} ${crossed.message}` : 'the mismatch was accepted',
  );

  const missingRegion = await threw(
    organizations.updateDirectory(victim.id, { regionId: 'no-such-region' }, null),
  );
  check(
    'an unknown region is refused',
    statusOf(missingRegion) === 404,
  );

  // ------------------------------------------------- directory write round-trip
  section('Directory edit and verification round-trip');

  const snapshot = await db.organization.findUnique({
    where: { id: victim.id },
    select: {
      publicPhone: true, directionsNote: true, address: true,
      acceptsDonations: true, providesLaboratory: true, verifiedAt: true, verifiedById: true,
      services: { select: { service: true, note: true } },
      hours: { select: { dayOfWeek: true, opensAt: true, closesAt: true, isClosed: true } },
    },
  });

  try {
    const updated = await organizations.updateDirectory(
      victim.id,
      {
        publicPhone: '+998 71 000 00 09',
        directionsNote: 'Verification run',
        services: [{ service: OrganizationServiceType.BLOOD_TYPING, note: 'verification' }],
        hours: [{ dayOfWeek: 0, isClosed: true }],
      },
      null,
    );
    check(
      'a directory edit saves scalars',
      updated.publicPhone === '+998 71 000 00 09' && updated.directionsNote === 'Verification run',
    );
    check(
      'services are replaced, not merged',
      updated.services.length === 1 &&
        updated.services[0].service === OrganizationServiceType.BLOOD_TYPING,
      `${updated.services.length} service(s) after replacing ${snapshot.services.length}`,
    );
    check(
      'hours are replaced, not merged',
      updated.hours.length === 1 && updated.hours[0].isClosed === true,
      `${updated.hours.length} day(s) after replacing ${snapshot.hours.length}`,
    );
    check(
      'a closed day stores no opening time',
      updated.hours[0].opensAt === null && updated.hours[0].closesAt === null,
    );

    const target2 = demo.find((o) => o.verifiedAt === null) ?? victim;
    const actor = superAdmin?.userId ?? hospitalAdmin?.userId;
    if (!actor) {
      skip('verification is recorded against the administrator who made it', 'no staff user seeded');
    } else {
      const marked = await organizations.setVerification(target2.id, true, actor);
      const stored = await db.organization.findUnique({
        where: { id: target2.id },
        select: { verifiedAt: true, verifiedById: true },
      });
      check(
        'verification is recorded against the administrator who made it',
        marked.isVerified === true && stored.verifiedById === actor && stored.verifiedAt !== null,
      );
      const withdrawn = await organizations.setVerification(target2.id, false, actor);
      const cleared = await db.organization.findUnique({
        where: { id: target2.id },
        select: { verifiedAt: true, verifiedById: true },
      });
      check(
        'withdrawing verification clears both the timestamp and the approver',
        withdrawn.isVerified === false &&
          cleared.verifiedAt === null &&
          cleared.verifiedById === null,
      );
      if (target2.verifiedAt !== null) {
        await organizations.setVerification(target2.id, true, actor);
      }
    }
  } finally {
    await db.$transaction(async (tx) => {
      await tx.organization.update({
        where: { id: victim.id },
        data: {
          publicPhone: snapshot.publicPhone,
          directionsNote: snapshot.directionsNote,
          address: snapshot.address,
          acceptsDonations: snapshot.acceptsDonations,
          providesLaboratory: snapshot.providesLaboratory,
          verifiedAt: snapshot.verifiedAt,
          verifiedById: snapshot.verifiedById,
        },
      });
      await tx.organizationService.deleteMany({ where: { organizationId: victim.id } });
      await tx.organizationService.createMany({
        data: snapshot.services.map((s) => ({ organizationId: victim.id, ...s })),
      });
      await tx.organizationHours.deleteMany({ where: { organizationId: victim.id } });
      await tx.organizationHours.createMany({
        data: snapshot.hours.map((h) => ({ organizationId: victim.id, ...h })),
      });
    });
  }

  const restored = await organizations.findById(victim.id);
  check(
    'the verification run left the demo organization as it found it',
    restored.publicPhone === snapshot.publicPhone &&
      restored.services.length === snapshot.services.length &&
      restored.hours.length === snapshot.hours.length,
  );

  // ------------------------------------------------------ backward compatibility
  section('Backward compatibility');

  check(
    'organizations that predate this migration are still here',
    nonDemo.length > 0,
    nonDemo.map((o) => o.name).join(', '),
  );
  check(
    'their geography was left unset rather than guessed',
    nonDemo.every((o) => o.regionId === null),
    'a region nobody chose would be an invented fact about a real place',
  );
  const shouldAccept = nonDemo.filter(
    (o) =>
      (o.type === OrganizationType.HOSPITAL || o.type === OrganizationType.BLOOD_CENTER) &&
      o.status === OrganizationStatus.ACTIVE,
  );
  const accepting = await db.organization.findMany({
    where: { id: { in: shouldAccept.map((o) => o.id) } },
    select: { id: true, acceptsDonations: true },
  });
  // The invariant, not the mechanism: on a database that predates the directory
  // the migration's backfill sets this, and on a freshly seeded one the seed
  // does. Either way an active hospital or blood centre a donor could book at
  // yesterday has to still be bookable today.
  check(
    'every active hospital and blood centre is still bookable',
    accepting.length > 0 && accepting.every((o) => o.acceptsDonations),
    `${accepting.length} active hospitals and blood centres`,
  );

  const labOrgIds = new Set(
    (await db.laboratoryProfile.findMany({ select: { organizationId: true } })).map(
      (l) => l.organizationId,
    ),
  );
  const labFlags = await db.organization.findMany({
    select: { id: true, providesLaboratory: true, isDemo: true },
  });
  check(
    'the laboratory flag follows the data rather than asserting it',
    labFlags
      .filter((o) => !o.isDemo)
      .every((o) => o.providesLaboratory === labOrgIds.has(o.id)),
    `${labOrgIds.size} organization(s) hold a laboratory profile`,
  );

  const appointments = await db.appointment.findMany({
    select: { id: true, organizationId: true },
  });
  const orgIds = new Set((await db.organization.findMany({ select: { id: true } })).map((o) => o.id));
  check(
    'every existing appointment still resolves to its organization',
    appointments.length > 0 && appointments.every((a) => orgIds.has(a.organizationId)),
    `${appointments.length} appointments`,
  );
  const memberships = await db.organizationMembership.findMany({
    select: { id: true, organizationId: true },
  });
  check(
    'every existing membership still resolves to its organization',
    memberships.length > 0 && memberships.every((m) => orgIds.has(m.organizationId)),
    `${memberships.length} memberships`,
  );

  const donors = await db.donorProfile.findMany({
    select: { id: true, city: true, district: true, regionId: true, districtId: true },
  });
  const withFreeText = donors.filter((d) => d.city !== null);
  check(
    'donor free-text location survived the migration',
    withFreeText.length > 0 && withFreeText.every((d) => d.regionId === null),
    `${withFreeText.length} donor profiles still hold the address they typed`,
  );
  check(
    'donor profiles can hold a structured location alongside the free text',
    donors.every((d) => 'regionId' in d && 'districtId' in d),
  );

  await verifyOverHttp();
}


/**
 * The HTTP layer, which the service-level checks above cannot reach.
 *
 * Query strings arrive as strings, and the gap between "the service does the
 * right thing with `false`" and "the endpoint turns `?verified=false` into
 * `false`" is exactly where a filter silently inverts. Skipped, loudly, when no
 * API is listening -- a skipped check is not a passed one.
 */
const API_URL = process.env.VERIFY_API_URL ?? 'http://localhost:3001';
const BASE = `${API_URL}/api/v1`;
const PASSWORD = process.env.VERIFY_PASSWORD ?? 'DevelopmentOnly!123';

async function api(method, pathname, token, body) {
  const res = await fetch(BASE + pathname, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let parsed = null;
  try {
    parsed = await res.json();
  } catch {
    /* an empty body is a legitimate answer */
  }
  // `data` is what every client actually gets: `apiRequest` ends in
  // `return json.data`, with no fallback. Reading `body` here instead of
  // `data` is how Sprint 2 "verified" geography endpoints that no client
  // could read -- the raw body looked right and the screens were empty.
  return { status: res.status, body: parsed, data: parsed?.data };
}

async function signIn(email) {
  const res = await api('POST', '/auth/login', null, { email, password: PASSWORD });
  return res.status === 200 ? (res.body?.data ?? res.body)?.accessToken : null;
}

async function verifyOverHttp() {
  section('HTTP endpoints');

  let reachable = false;
  try {
    const health = await fetch(`${BASE}/health`);
    reachable = health.ok;
  } catch {
    reachable = false;
  }
  if (!reachable) {
    skip('geography and directory endpoints', `no API listening on ${API_URL} (set VERIFY_API_URL)`);
    return;
  }

  const adminToken = await signIn(process.env.VERIFY_ADMIN_EMAIL ?? 'admin@donor.local');
  const donorToken = await signIn(process.env.VERIFY_DONOR_EMAIL ?? 'donor@donor.local');
  if (!adminToken) {
    skip('geography and directory endpoints', 'could not sign in as a platform administrator');
    return;
  }

  const anonymous = await api('GET', '/geography/regions', null);
  check('geography requires a signed-in caller', anonymous.status === 401, `${anonymous.status}`);

  const regionsRes = await api('GET', '/geography/regions', adminToken);
  check(
    'GET /geography/regions reaches a client as the reference list',
    regionsRes.status === 200 && regionsRes.data?.length === 14,
    `${regionsRes.status}, ${regionsRes.data?.length ?? 0} regions after unwrapping`,
  );
  const tk = regionsRes.data?.find((r) => r.code === 'UZ-TK');
  if (!tk) {
    check('the region picker has Tashkent City to select', false, 'no UZ-TK in the unwrapped list');
    return;
  }

  const districtsRes = await api('GET', `/geography/districts?regionId=${tk.id}`, adminToken);
  check(
    'GET /geography/districts filters by region',
    districtsRes.status === 200 &&
      districtsRes.data?.length > 0 &&
      districtsRes.data.every((d) => d.regionId === tk.id),
    `${districtsRes.data?.length ?? 0} districts after unwrapping`,
  );
  check(
    'every district row says it is demo data',
    Boolean(districtsRes.data?.every((d) => d.source === 'DEMO')),
    'a client cannot present these as official without knowing',
  );

  const coverageRes = await api('GET', '/geography/coverage', adminToken);
  check(
    'GET /geography/coverage reports the reference/demo split',
    coverageRes.status === 200 &&
      coverageRes.data?.districtsAuthoritative === false &&
      coverageRes.data?.regionStandard === 'ISO 3166-2:UZ',
    JSON.stringify(coverageRes.data?.districts ?? {}),
  );

  // The bug this section exists for: `?verified=false` must not mean `true`.
  const allRes = await api('GET', '/organizations?limit=100', adminToken);
  const yes = await api('GET', '/organizations?verified=true&limit=100', adminToken);
  const no = await api('GET', '/organizations?verified=false&limit=100', adminToken);
  check(
    'verified=false is not read as true',
    yes.body.meta.total !== no.body.meta.total &&
      no.body.data.every((o) => o.isVerified === false),
    `${yes.body.meta.total} verified, ${no.body.meta.total} unverified`,
  );
  check(
    'verified=true and verified=false partition the directory',
    yes.body.meta.total + no.body.meta.total === allRes.body.meta.total,
    `${allRes.body.meta.total} total`,
  );
  const noLab = await api('GET', '/organizations?providesLaboratory=false&limit=100', adminToken);
  check(
    'providesLaboratory=false is not read as true',
    noLab.body.data.every((o) => o.providesLaboratory === false),
    `${noLab.body.meta.total} without a laboratory`,
  );
  const nonsense = await api('GET', '/organizations?verified=maybe', adminToken);
  check(
    'an unparseable boolean is rejected rather than guessed',
    nonsense.status === 400,
    `${nonsense.status}`,
  );

  const regionRes = await api(`GET`, `/organizations?regionId=${tk.id}&limit=100`, adminToken);
  check(
    'GET /organizations filters by region over HTTP',
    regionRes.status === 200 && regionRes.body.data.every((o) => o.region?.id === tk.id),
    `${regionRes.body?.meta?.total ?? 0} in ${tk.nameEn}`,
  );

  const radiusRes = await api(
    'GET',
    '/organizations/discover?latitude=41.3&longitude=69.25&radiusKm=50&limit=100',
    donorToken ?? adminToken,
  );
  check(
    'radius search survives the query string',
    radiusRes.status === 200 &&
      radiusRes.body.data.length > 0 &&
      radiusRes.body.data.every((o) => typeof o.distanceKm === 'number' && o.distanceKm <= 50),
    `${radiusRes.body?.meta?.total ?? 0} within 50 km, nearest ${radiusRes.body?.data?.[0]?.distanceKm ?? '—'} km`,
  );
  check(
    'radius search sorts nearest first over HTTP',
    radiusRes.body.data.every((o, i) => i === 0 || radiusRes.body.data[i - 1].distanceKm <= o.distanceKm),
  );
  const tooFar = await api('GET', '/organizations/discover?latitude=41.3&longitude=69.25&radiusKm=9000', adminToken);
  check(
    'an out-of-range radius is rejected',
    tooFar.status === 400,
    `${tooFar.status}`,
  );

  const suspended = await api('GET', '/organizations/discover?status=SUSPENDED&limit=100', donorToken ?? adminToken);
  check(
    'a donor cannot widen discovery past ACTIVE over HTTP',
    suspended.status === 200 && suspended.body.data.every((o) => o.status === 'ACTIVE'),
  );

  if (!donorToken) {
    skip('the staff directory is closed to donors', 'could not sign in as a donor');
  } else {
    const donorList = await api('GET', '/organizations', donorToken);
    check(
      'the staff directory is closed to donors',
      donorList.status === 403,
      `${donorList.status}`,
    );
    const donorDiscover = await api('GET', '/organizations/discover', donorToken);
    check('donor discovery is open to donors', donorDiscover.status === 200, `${donorDiscover.status}`);
  }

  // Verification writes, on an organization that starts and ends unverified.
  const subject = no.body.data.find((o) => o.isDemo) ?? no.body.data[0];
  // Read back through `data`, exactly as the portals' organization page does.
  const isVerified = async () =>
    (await api('GET', `/organizations/${subject.id}`, adminToken)).data?.isVerified;

  const nonsenseFlag = await api('PATCH', `/organizations/${subject.id}/verification`, adminToken, {
    verified: 'maybe',
  });
  check(
    'an unparseable verification flag is rejected',
    nonsenseFlag.status === 400 && (await isVerified()) === false,
    `${nonsenseFlag.status}, still unverified`,
  );

  const affirmative = await api('PATCH', `/organizations/${subject.id}/verification`, adminToken, {
    verified: 'true',
  });
  check(
    'the word "true" verifies the organization',
    affirmative.status === 200 && (await isVerified()) === true,
    `${affirmative.status}`,
  );

  // Sprint 2.1: "yes" and "no" are conventions some clients invert, so they are
  // refused rather than interpreted. The refusal must also change nothing --
  // a 400 that had already written is worse than either answer.
  const affirmativeWord = await api(
    'PATCH',
    `/organizations/${subject.id}/verification`,
    adminToken,
    { verified: 'yes' },
  );
  check(
    '"yes" is refused rather than read as a verification',
    affirmativeWord.status === 400 && (await isVerified()) === true,
    `${affirmativeWord.status}, still verified`,
  );

  // The bug this exists for: "false" must withdraw verification, not grant it.
  const negative = await api('PATCH', `/organizations/${subject.id}/verification`, adminToken, {
    verified: 'false',
  });
  check(
    '"false" withdraws verification rather than granting it',
    negative.status === 200 && (await isVerified()) === false,
    `${negative.status} — ${subject.name} is unverified again`,
  );

  if (donorToken) {
    const donorVerify = await api('PATCH', `/organizations/${subject.id}/verification`, donorToken, {
      verified: true,
    });
    check(
      'only a platform administrator may verify an organization',
      donorVerify.status === 403 && (await isVerified()) === false,
      `${donorVerify.status}`,
    );
  }
}

main()
  .catch((error) => {
    console.error(`\n  ✗ ${error?.stack ?? error}\n`);
    failures += 1;
  })
  .finally(async () => {
    await db.$disconnect();
    console.log(
      `\n${failures === 0 ? '✓' : '✗'} ${passes} passed, ${failures} failed` +
        (skipped ? `, ${skipped} skipped` : '') + '\n',
    );
    process.exit(failures === 0 ? 0 : 1);
  });
