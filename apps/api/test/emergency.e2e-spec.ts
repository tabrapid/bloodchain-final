import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { PrismaService } from './../src/database/prisma.service';
import { API, SEEDED, createTestApp, seededOrganizations, tokenFor } from './utils/e2e';

/**
 * The emergency request -> donor matching -> response flow, end to end.
 *
 * Activation is the interesting part: it is not a status flip, it runs the real
 * donor-matching engine, which reads eligible donors out of the database,
 * filters them by blood-type compatibility, ranks them and writes
 * EmergencyMatch rows. This suite asserts that matching actually happens and
 * actually respects compatibility, then walks a matched donor through
 * accepting and arriving, and the hospital through completing the response.
 */
describe('Emergency request and donor matching (e2e)', () => {
  let app: INestApplication;
  let db: PrismaService;

  let hospitalToken: string;
  let donorToken: string;
  let centerToken: string;

  let hospitalId: string;
  let donorUserId: string;

  // Created through the API.
  let emergencyId: string;
  let incompatibleEmergencyId: string;
  let matchId: string;
  let responseId: string;
  let crossGroupEmergencyId: string;
  let universalDonorUserId: string;

  const DONOR_EMAIL = `e2e.emergency.donor.${Date.now()}@donor.local`;

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(PrismaService);

    const orgs = await seededOrganizations(app);
    hospitalId = orgs.hospital.id;

    hospitalToken = await tokenFor(app, SEEDED.hospitalStaff);
    centerToken = await tokenFor(app, SEEDED.bloodCenterStaff);

    // This suite creates its own donor rather than reusing donor@donor.local.
    // The matching engine deliberately skips donors already engaged in an
    // active emergency, and the seed hands the demo donor two live matches, so
    // a suite built on the shared donor would match nobody and would also stop
    // being repeatable the moment it left a match behind. A dedicated O+ donor
    // keeps the suite self-contained.
    const donorRole = await db.role.findUniqueOrThrow({ where: { code: 'DONOR' } });

    const donor = await db.user.create({
      data: {
        email: DONOR_EMAIL,
        firstName: 'E2E',
        lastName: 'Donor',
        passwordHash: 'not-used-tokens-are-minted-directly',
        status: 'ACTIVE',
        emailVerified: true,
        donorProfile: {
          create: {
            bloodType: 'O',
            rhFactor: 'POSITIVE',
            donorStatus: 'ACTIVE',
            verificationStatus: 'VERIFIED',
          },
        },
        memberships: {
          create: {
            organizationId: hospitalId,
            roleId: donorRole.id,
            status: 'ACTIVE',
          },
        },
      },
    });
    donorUserId = donor.id;
    donorToken = await tokenFor(app, DONOR_EMAIL);
  });

  afterAll(async () => {
    // Deliberately not wrapped in catch-and-ignore: a cleanup failure that goes
    // unnoticed leaves rows behind that make the next run fail for a completely
    // unrelated-looking reason, which is exactly what happened while this suite
    // was being written.
    // EmergencyMatch and EmergencyResponse both cascade off EmergencyRequest,
    // so deleting the request is enough.
    for (const id of [emergencyId, incompatibleEmergencyId, crossGroupEmergencyId].filter(Boolean)) {
      await db.emergencyRequest.deleteMany({ where: { id } });
    }

    // Profile and membership cascade off each user.
    for (const id of [donorUserId, universalDonorUserId].filter(Boolean)) {
      await db.user.deleteMany({ where: { id } });
    }

    await app.close();
  });

  describe('1. Raising the emergency', () => {
    it('hospital staff can create an emergency in DRAFT', async () => {
      // O+ deliberately: this suite's own donor is O+, so this one must match.
      const res = await request(app.getHttpServer())
        .post(`${API}/organizations/${hospitalId}/emergencies`)
        .set('Authorization', `Bearer ${hospitalToken}`)
        .send({
          bloodType: 'O',
          rhFactor: 'POSITIVE',
          unitsRequired: 2,
          urgencyLevel: 'CRITICAL',
          description: 'e2e emergency',
        })
        .expect(201);

      emergencyId = res.body.data?.id ?? res.body.id;
      expect(emergencyId).toBeDefined();

      const created = await db.emergencyRequest.findUniqueOrThrow({ where: { id: emergencyId } });
      expect(created.status).toBe('DRAFT');
      expect(created.hospitalId).toBe(hospitalId);
    });

    it('rejects an invalid blood type', async () => {
      await request(app.getHttpServer())
        .post(`${API}/organizations/${hospitalId}/emergencies`)
        .set('Authorization', `Bearer ${hospitalToken}`)
        .send({ bloodType: 'Z', rhFactor: 'POSITIVE', unitsRequired: 1 })
        .expect(400);
    });

    it('a donor cannot raise an emergency', async () => {
      await request(app.getHttpServer())
        .post(`${API}/organizations/${hospitalId}/emergencies`)
        .set('Authorization', `Bearer ${donorToken}`)
        .send({ bloodType: 'O', rhFactor: 'POSITIVE', unitsRequired: 1 })
        .expect(403);
    });

    it('blood-centre staff cannot raise an emergency for the hospital', async () => {
      await request(app.getHttpServer())
        .post(`${API}/organizations/${hospitalId}/emergencies`)
        .set('Authorization', `Bearer ${centerToken}`)
        .send({ bloodType: 'O', rhFactor: 'POSITIVE', unitsRequired: 1 })
        .expect(403);
    });
  });

  describe('2. Activation runs the real matching engine', () => {
    it('activating the emergency matches compatible donors', async () => {
      await request(app.getHttpServer())
        .post(`${API}/organizations/${hospitalId}/emergencies/${emergencyId}/activate`)
        .set('Authorization', `Bearer ${hospitalToken}`)
        .send({})
        .expect(201);

      const activated = await db.emergencyRequest.findUniqueOrThrow({
        where: { id: emergencyId },
      });
      // MATCHING once the engine has written its matches.
      expect(['ACTIVE', 'MATCHING']).toContain(activated.status);

      const matches = await db.emergencyMatch.findMany({ where: { emergencyRequestId: emergencyId } });
      expect(matches.length).toBeGreaterThan(0);

      // This suite's O+ donor must be among them.
      const donorMatch = matches.find((m) => m.donorId === donorUserId);
      expect(donorMatch).toBeDefined();
      matchId = donorMatch!.id;
    });

    it('cannot be activated twice', async () => {
      await request(app.getHttpServer())
        .post(`${API}/organizations/${hospitalId}/emergencies/${emergencyId}/activate`)
        .set('Authorization', `Bearer ${hospitalToken}`)
        .send({})
        .expect(400);
    });

    it('does not match a donor whose blood type is incompatible', async () => {
      // This suite's donor is O+, who cannot donate to an AB- recipient. This is
      // the check that matching is real compatibility logic and not "notify
      // everyone".
      const res = await request(app.getHttpServer())
        .post(`${API}/organizations/${hospitalId}/emergencies`)
        .set('Authorization', `Bearer ${hospitalToken}`)
        .send({
          bloodType: 'AB',
          rhFactor: 'NEGATIVE',
          unitsRequired: 1,
          description: 'e2e incompatible',
        })
        .expect(201);

      incompatibleEmergencyId = res.body.data?.id ?? res.body.id;

      await request(app.getHttpServer())
        .post(`${API}/organizations/${hospitalId}/emergencies/${incompatibleEmergencyId}/activate`)
        .set('Authorization', `Bearer ${hospitalToken}`)
        .send({})
        .expect(201);

      const matches = await db.emergencyMatch.findMany({
        where: { emergencyRequestId: incompatibleEmergencyId, donorId: donorUserId },
      });
      expect(matches).toHaveLength(0);
    });

    it('matches a compatible donor of a different blood group (P3-11)', async () => {
      // The real proof of the P3-11 fix. The unit tests mock tx.user.findMany,
      // so they cannot exercise the SQL prefilter that was the actual bug --
      // only a run against a real database can. This creates an O-negative
      // universal donor and an A-positive emergency: before the fix the query
      // narrowed to exact group, so this donor was never even loaded and could
      // not be alerted; after it, BLOOD_COMPATIBILITY does its job.
      const donorRole = await db.role.findUniqueOrThrow({ where: { code: 'DONOR' } });
      const universalEmail = `e2e.universal.donor.${Date.now()}@donor.local`;

      const universalDonor = await db.user.create({
        data: {
          email: universalEmail,
          firstName: 'E2E',
          lastName: 'Universal',
          passwordHash: 'not-used-tokens-are-minted-directly',
          status: 'ACTIVE',
          emailVerified: true,
          donorProfile: {
            create: {
              bloodType: 'O',
              rhFactor: 'NEGATIVE',
              donorStatus: 'ACTIVE',
              verificationStatus: 'VERIFIED',
            },
          },
          memberships: {
            create: { organizationId: hospitalId, roleId: donorRole.id, status: 'ACTIVE' },
          },
        },
      });
      universalDonorUserId = universalDonor.id;

      const res = await request(app.getHttpServer())
        .post(`${API}/organizations/${hospitalId}/emergencies`)
        .set('Authorization', `Bearer ${hospitalToken}`)
        .send({
          bloodType: 'A',
          rhFactor: 'POSITIVE',
          unitsRequired: 1,
          description: 'e2e cross-group',
        })
        .expect(201);

      crossGroupEmergencyId = res.body.data?.id ?? res.body.id;

      await request(app.getHttpServer())
        .post(`${API}/organizations/${hospitalId}/emergencies/${crossGroupEmergencyId}/activate`)
        .set('Authorization', `Bearer ${hospitalToken}`)
        .send({})
        .expect(201);

      const match = await db.emergencyMatch.findFirst({
        where: { emergencyRequestId: crossGroupEmergencyId, donorId: universalDonorUserId },
      });
      expect(match).not.toBeNull();
    });
  });

  describe('3. The donor responds', () => {
    it('the emergency shows up on the donor\'s feed', async () => {
      const res = await request(app.getHttpServer())
        .get(`${API}/donor/emergencies`)
        .set('Authorization', `Bearer ${donorToken}`)
        .expect(200);

      // Shape is { data: { active, myResponses } }.
      const active = res.body.data.active as Array<{ id: string; canAccept: boolean }>;
      const mine = active.find((e) => e.id === emergencyId);

      expect(mine).toBeDefined();
      // The feed tells the donor whether they can actually give to this
      // recipient; for an O+ donor and an O+ emergency it must be true.
      expect(mine!.canAccept).toBe(true);
    });

    it('hospital staff cannot use the donor-side routes', async () => {
      await request(app.getHttpServer())
        .get(`${API}/donor/emergencies`)
        .set('Authorization', `Bearer ${hospitalToken}`)
        .expect(403);
    });

    it('the donor can mark the match viewed and accept it', async () => {
      await request(app.getHttpServer())
        .post(`${API}/donor/emergency-matches/${matchId}/view`)
        .set('Authorization', `Bearer ${donorToken}`)
        .send({})
        .expect(201);

      await request(app.getHttpServer())
        .post(`${API}/donor/emergency-matches/${matchId}/accept`)
        .set('Authorization', `Bearer ${donorToken}`)
        .send({})
        .expect(201);

      const response = await db.emergencyResponse.findFirstOrThrow({
        where: { emergencyRequestId: emergencyId, donorId: donorUserId },
      });
      responseId = response.id;
    });

    it('the donor can start the journey and arrive', async () => {
      const startRes = await request(app.getHttpServer())
        .post(`${API}/donor/emergency-responses/${responseId}/start-journey`)
        .set('Authorization', `Bearer ${donorToken}`)
        .send({});
      expect([200, 201]).toContain(startRes.status);

      const arriveRes = await request(app.getHttpServer())
        .post(`${API}/donor/emergency-responses/${responseId}/arrive`)
        .set('Authorization', `Bearer ${donorToken}`)
        .send({});
      expect([200, 201]).toContain(arriveRes.status);
    });

    it('another organization\'s staff cannot complete this response', async () => {
      const res = await request(app.getHttpServer())
        .post(`${API}/organizations/${hospitalId}/emergency-responses/${responseId}/complete`)
        .set('Authorization', `Bearer ${centerToken}`)
        .send({});

      expect([403, 404]).toContain(res.status);
    });
  });

  describe('4. The hospital closes it out', () => {
    it('hospital staff can confirm arrival and complete the response', async () => {
      const confirmRes = await request(app.getHttpServer())
        .post(`${API}/organizations/${hospitalId}/emergency-responses/${responseId}/confirm-arrival`)
        .set('Authorization', `Bearer ${hospitalToken}`)
        .send({});
      expect([200, 201, 400]).toContain(confirmRes.status);

      const completeRes = await request(app.getHttpServer())
        .post(`${API}/organizations/${hospitalId}/emergency-responses/${responseId}/complete`)
        .set('Authorization', `Bearer ${hospitalToken}`)
        .send({});
      expect([200, 201]).toContain(completeRes.status);
    });

    it('the hospital can read the emergency\'s tracking view', async () => {
      await request(app.getHttpServer())
        .get(`${API}/organizations/${hospitalId}/emergencies/${emergencyId}/tracking`)
        .set('Authorization', `Bearer ${hospitalToken}`)
        .expect(200);
    });

    it('the emergency is unreachable without a token', async () => {
      await request(app.getHttpServer())
        .get(`${API}/organizations/${hospitalId}/emergencies/${emergencyId}`)
        .expect(401);
    });
  });
});
