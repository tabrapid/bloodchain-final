import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { PrismaService } from '../src/database/prisma.service';
import { API, SEEDED, createTestApp, seededOrganizations, tokenFor } from './utils/e2e';

/**
 * The contract between what the API sends and what the clients read.
 *
 * Every HTTP client in this repository ends its request helper with the same
 * line — `return json.data as T` (mobile `src/api/client.ts`, and
 * `lib/api-client.ts` in all three portals). None of them has a fallback: when
 * a route answers without the `{ data }` envelope, the client hands the screen
 * `undefined`, and `undefined` renders as an empty list rather than an error.
 *
 * That is not hypothetical. Sprint 2 shipped `/geography/*` and
 * `GET /organizations/:id` unenveloped, and every screen built on them — the
 * mobile region and district selectors, the demo-district warning, the booking
 * review step, both portal Organization pages and the admin directory panel —
 * was blank in production while every test was green. The tests were green
 * because they mocked `fetch` with the envelope the client *expected*, which
 * asserts the assumption instead of the contract.
 *
 * So this suite does the opposite: it makes a real request against the real
 * application, passes the real body through `unwrapLikeClients` — a literal
 * copy of that one line — and asserts on the fields the screens actually read.
 * `response-envelope.e2e-spec.ts` covers the parameterless GETs in bulk; this
 * one covers the named client surfaces, including the parameterised routes that
 * bulk sweep cannot reach.
 */

/** Exactly what every client does with a response body, and nothing more. */
function unwrapLikeClients<T>(body: unknown): T {
  return (body as { data: T }).data;
}

describe('the client contract: what the screens actually receive', () => {
  let app: INestApplication;
  let db: PrismaService;
  let donorToken: string;
  let adminToken: string;
  let hospitalAdminToken: string;
  let bloodCenterAdminToken: string;
  let hospitalId: string;
  let bloodCenterId: string;
  /** A demo organization, which is the only kind with a filled-in directory. */
  let populatedOrgId: string;
  let regionId: string;

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(PrismaService);
    donorToken = await tokenFor(app, SEEDED.donor);
    adminToken = await tokenFor(app, SEEDED.superAdmin);
    hospitalAdminToken = await tokenFor(app, SEEDED.hospitalAdmin);
    bloodCenterAdminToken = await tokenFor(app, SEEDED.bloodCenterAdmin);

    const orgs = await seededOrganizations(app);
    hospitalId = orgs.hospital.id;
    bloodCenterId = orgs.bloodCenter.id;

    const populated = await db.organization.findFirstOrThrow({
      where: { isDemo: true, regionId: { not: null } },
      orderBy: { name: 'asc' },
    });
    populatedOrgId = populated.id;
    regionId = populated.regionId!;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('mobile region selector — src/api/geography.ts getRegions()', () => {
    it('unwraps to the list the picker maps over', async () => {
      const res = await request(app.getHttpServer())
        .get(`${API}/geography/regions`)
        .set('Authorization', `Bearer ${donorToken}`)
        .expect(200);

      const regions = unwrapLikeClients<Array<Record<string, unknown>>>(res.body);

      expect(Array.isArray(regions)).toBe(true);
      expect(regions.length).toBe(14);
      // The exact fields `geoName()` and the picker row read.
      expect(regions[0]).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          code: expect.any(String),
          nameUz: expect.any(String),
          nameRu: expect.any(String),
          nameEn: expect.any(String),
          source: expect.any(String),
          districtCount: expect.any(Number),
        }),
      );
    });
  });

  describe('mobile district selector — getDistricts(regionId)', () => {
    it('unwraps to a list scoped to the chosen region', async () => {
      const res = await request(app.getHttpServer())
        .get(`${API}/geography/districts?regionId=${regionId}`)
        .set('Authorization', `Bearer ${donorToken}`)
        .expect(200);

      const districts = unwrapLikeClients<Array<Record<string, unknown>>>(res.body);

      expect(Array.isArray(districts)).toBe(true);
      expect(districts.length).toBeGreaterThan(0);
      expect(districts.every((d) => d.regionId === regionId)).toBe(true);
      expect(districts[0]).toEqual(
        expect.objectContaining({ id: expect.any(String), nameEn: expect.any(String) }),
      );
    });
  });

  describe('demo-district warning — getGeographyCoverage()', () => {
    it('unwraps to the flag the notice is rendered from', async () => {
      const res = await request(app.getHttpServer())
        .get(`${API}/geography/coverage`)
        .set('Authorization', `Bearer ${donorToken}`)
        .expect(200);

      const coverage = unwrapLikeClients<Record<string, unknown>>(res.body);

      // `coverage?.districtsAuthoritative === false` is the exact predicate the
      // mobile filter panel and both portal forms branch on. Against an
      // undefined body it is `undefined === false` — false — and the notice
      // silently never appears, which is the failure mode that shipped.
      expect(coverage).toBeDefined();
      expect(coverage.districtsAuthoritative).toBe(false);
      expect(coverage.regionStandard).toBe('ISO 3166-2:UZ');
      expect(coverage.districts).toEqual(
        expect.objectContaining({ total: expect.any(Number), demo: expect.any(Number) }),
      );
    });
  });

  describe('organization discovery — discoverOrganizations()', () => {
    it('unwraps to the list, with the totals the client reads off meta', async () => {
      const res = await request(app.getHttpServer())
        .get(`${API}/organizations/discover?limit=5`)
        .set('Authorization', `Bearer ${donorToken}`)
        .expect(200);

      const organizations = unwrapLikeClients<Array<Record<string, unknown>>>(res.body);

      expect(Array.isArray(organizations)).toBe(true);
      expect(organizations.length).toBeGreaterThan(0);
      // `meta` sits beside `data`, not inside it — the client reads
      // `envelope.meta.total` through apiRequestEnvelope.
      expect(res.body.meta).toEqual(
        expect.objectContaining({ total: expect.any(Number), totalPages: expect.any(Number) }),
      );
      expect(organizations[0]).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          name: expect.any(String),
          isVerified: expect.any(Boolean),
          isDemo: expect.any(Boolean),
        }),
      );
    });
  });

  describe('booking review organization details — getOrganization(id)', () => {
    it('unwraps to the organization the review step names', async () => {
      const res = await request(app.getHttpServer())
        .get(`${API}/organizations/${hospitalId}`)
        .set('Authorization', `Bearer ${donorToken}`)
        .expect(200);

      const organization = unwrapLikeClients<Record<string, unknown>>(res.body);

      // The review step renders `organization.name` and `organization.address`.
      // Undefined here is what made step 5 of the booking wizard fail to load.
      expect(organization).toBeDefined();
      expect(organization.id).toBe(hospitalId);
      expect(typeof organization.name).toBe('string');
      expect('address' in organization).toBe(true);
    });
  });

  describe('portal organization pages — getDirectoryEntry(id)', () => {
    it.each([
      ['hospital', () => hospitalAdminToken, () => hospitalId],
      ['blood centre', () => bloodCenterAdminToken, () => bloodCenterId],
    ])('%s: unwraps to an entry the form can be filled from', async (_name, token, id) => {
      const res = await request(app.getHttpServer())
        .get(`${API}/organizations/${id()}`)
        .set('Authorization', `Bearer ${token()}`)
        .expect(200);

      const entry = unwrapLikeClients<Record<string, unknown>>(res.body);

      // `applyEntry()` reads every one of these. It throws on undefined, which
      // the page catches — leaving a permanent "sign in required" empty state.
      expect(entry).toBeDefined();
      for (const field of [
        'id',
        'region',
        'district',
        'address',
        'directionsNote',
        'latitude',
        'longitude',
        'publicPhone',
        'acceptsDonations',
        'providesLaboratory',
        'services',
        'hours',
        'isVerified',
        'isDemo',
      ]) {
        expect(entry).toHaveProperty(field);
      }
      expect(Array.isArray(entry.services)).toBe(true);
      expect(Array.isArray(entry.hours)).toBe(true);
    });

    it('carries a fully populated directory entry through the same unwrap', async () => {
      const res = await request(app.getHttpServer())
        .get(`${API}/organizations/${populatedOrgId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const entry = unwrapLikeClients<{
        region: { nameEn: string } | null;
        district: { nameEn: string } | null;
        services: unknown[];
        hours: unknown[];
      }>(res.body);

      expect(entry.region?.nameEn).toEqual(expect.any(String));
      expect(entry.district?.nameEn).toEqual(expect.any(String));
      expect(entry.services.length).toBeGreaterThan(0);
      expect(entry.hours).toHaveLength(7);
    });
  });

  describe('admin organization directory panel — the write paths', () => {
    it('a directory save unwraps to the updated entry the form re-applies', async () => {
      const before = await db.organization.findUniqueOrThrow({
        where: { id: populatedOrgId },
        select: { directionsNote: true },
      });

      const res = await request(app.getHttpServer())
        .patch(`${API}/organizations/${populatedOrgId}/directory`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ directionsNote: 'Contract test' })
        .expect(200);

      const updated = unwrapLikeClients<Record<string, unknown>>(res.body);
      expect(updated).toBeDefined();
      expect(updated.directionsNote).toBe('Contract test');
      expect(updated.id).toBe(populatedOrgId);

      await db.organization.update({
        where: { id: populatedOrgId },
        data: { directionsNote: before.directionsNote },
      });
    });

    it('a verification toggle unwraps to the entry whose badge the panel redraws', async () => {
      const before = await db.organization.findUniqueOrThrow({
        where: { id: populatedOrgId },
        select: { verifiedAt: true, verifiedById: true },
      });

      const granted = await request(app.getHttpServer())
        .patch(`${API}/organizations/${populatedOrgId}/verification`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ verified: true })
        .expect(200);

      expect(unwrapLikeClients<{ isVerified: boolean }>(granted.body).isVerified).toBe(true);

      const withdrawn = await request(app.getHttpServer())
        .patch(`${API}/organizations/${populatedOrgId}/verification`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ verified: false })
        .expect(200);

      expect(unwrapLikeClients<{ isVerified: boolean }>(withdrawn.body).isVerified).toBe(false);

      await db.organization.update({
        where: { id: populatedOrgId },
        data: { verifiedAt: before.verifiedAt, verifiedById: before.verifiedById },
      });
    });
  });
});
