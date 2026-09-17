import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { PrismaService } from './../src/database/prisma.service';
import { API, SEEDED, createTestApp, seededOrganizations, tokenFor } from './utils/e2e';

/**
 * The donation lifecycle, end to end against a real database.
 *
 * This is the product's core flow and, until now, it had never been exercised
 * over HTTP: the 621 unit specs all mock PrismaService, and the only existing
 * e2e suite covers auth. Everything here goes through the real routes, real
 * guards and the real database, across three actors whose roles genuinely
 * differ (donor, blood-centre staff, and an unrelated hospital).
 */
describe('Donation lifecycle (e2e)', () => {
  let app: INestApplication;
  let db: PrismaService;

  let donorToken: string;
  let staffToken: string;
  let hospitalStaffToken: string;
  let donorUserId: string;
  let bloodCenterId: string;
  let hospitalId: string;

  // Created during the flow, cleaned up afterwards.
  let slotId: string;
  let appointmentId: string;
  let donationId: string;

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(PrismaService);

    const orgs = await seededOrganizations(app);
    bloodCenterId = orgs.bloodCenter.id;
    hospitalId = orgs.hospital.id;

    donorToken = await tokenFor(app, SEEDED.donor);
    staffToken = await tokenFor(app, SEEDED.bloodCenterStaff);
    hospitalStaffToken = await tokenFor(app, SEEDED.hospitalStaff);

    const donor = await db.user.findUniqueOrThrow({ where: { email: SEEDED.donor } });
    donorUserId = donor.id;
  });

  afterAll(async () => {
    // Remove only what this suite created, newest-dependency first.
    if (donationId) {
      await db.bloodUnit.deleteMany({ where: { donationId } }).catch(() => undefined);
      await db.donationAssessment.deleteMany({ where: { donationId } }).catch(() => undefined);
      await db.donation.deleteMany({ where: { id: donationId } });
    }
    if (appointmentId) {
      await db.appointment.deleteMany({ where: { id: appointmentId } });
    }
    if (slotId) {
      await db.appointmentSlot.deleteMany({ where: { id: slotId } });
    }
    await app.close();
  });

  describe('1. Staff opens a donation slot', () => {
    it('blood-centre staff can create a slot', async () => {
      // Far enough out that it can't collide with seeded demo data.
      const startAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      const endAt = new Date(startAt.getTime() + 30 * 60 * 1000);

      const res = await request(app.getHttpServer())
        .post(`${API}/appointments/organizations/${bloodCenterId}/slots`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          appointmentType: 'BLOOD_DONATION',
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          capacity: 1,
        })
        .expect(201);

      slotId = res.body.data?.id ?? res.body.id;
      expect(slotId).toBeDefined();
    });

    it('a donor cannot create slots', async () => {
      const startAt = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);

      await request(app.getHttpServer())
        .post(`${API}/appointments/organizations/${bloodCenterId}/slots`)
        .set('Authorization', `Bearer ${donorToken}`)
        .send({
          appointmentType: 'BLOOD_DONATION',
          startAt: startAt.toISOString(),
          endAt: new Date(startAt.getTime() + 30 * 60 * 1000).toISOString(),
        })
        .expect(403);
    });
  });

  describe('2. Donor books the slot', () => {
    it('the donor can book the open slot', async () => {
      const res = await request(app.getHttpServer())
        .post(`${API}/appointments`)
        .set('Authorization', `Bearer ${donorToken}`)
        .send({ slotId, appointmentType: 'BLOOD_DONATION' })
        .expect(201);

      appointmentId = res.body.data?.id ?? res.body.id;
      expect(appointmentId).toBeDefined();
    });

    it('the booking is now visible on the donor\'s own appointments', async () => {
      const res = await request(app.getHttpServer())
        .get(`${API}/appointments/me`)
        .set('Authorization', `Bearer ${donorToken}`)
        .expect(200);

      const items = res.body.data?.items ?? res.body.data ?? [];
      expect(items.some((a: { id: string }) => a.id === appointmentId)).toBe(true);
    });

    it('staff cannot book on a donor\'s behalf through the donor route', async () => {
      await request(app.getHttpServer())
        .post(`${API}/appointments`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ slotId, appointmentType: 'BLOOD_DONATION' })
        .expect(403);
    });
  });

  describe('3. Check-in', () => {
    it('staff can confirm the appointment', async () => {
      // 200, not 201: confirming mutates the existing appointment rather than
      // creating anything, so the route carries @HttpCode(HttpStatus.OK) and
      // now matches its own OpenAPI annotation (P3-12).
      await request(app.getHttpServer())
        .post(`${API}/appointments/${appointmentId}/confirm`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({})
        .expect(200);
    });

    it('staff from an unrelated organization cannot check the donor in', async () => {
      // The hospital has nothing to do with this blood-centre appointment. This
      // is the tenant-isolation check: a valid staff token for the *wrong* org
      // must not reach another organization's data.
      const res = await request(app.getHttpServer())
        .post(`${API}/organizations/${hospitalId}/donations/check-in/${appointmentId}`)
        .set('Authorization', `Bearer ${hospitalStaffToken}`)
        .send({});

      expect([403, 404]).toContain(res.status);
    });

    it('blood-centre staff can check the donor in, creating the donation', async () => {
      const res = await request(app.getHttpServer())
        .post(`${API}/organizations/${bloodCenterId}/donations/check-in/${appointmentId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ notes: 'e2e check-in' })
        .expect(201);

      donationId = res.body.data?.id ?? res.body.id;
      expect(donationId).toBeDefined();

      const donation = await db.donation.findUniqueOrThrow({ where: { id: donationId } });
      expect(donation.status).toBe('CHECKED_IN');
      expect(donation.organizationId).toBe(bloodCenterId);
    });
  });

  describe('4. Collection', () => {
    // Order matters and is part of the domain rules, not an accident of the
    // test: the assessment gates the collection. `recordAssessment` only accepts
    // a CHECKED_IN donation, and `startDonation` refuses to proceed unless any
    // assessment on record is APPROVED_FOR_DONATION. So a donor is screened
    // first, and only then is blood drawn.
    it('an assessment can only be recorded while the donation is checked in', async () => {
      const before = await db.donation.findUniqueOrThrow({ where: { id: donationId } });
      expect(before.status).toBe('CHECKED_IN');

      await request(app.getHttpServer())
        .post(`${API}/organizations/${bloodCenterId}/donations/${donationId}/assessment`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ decision: 'APPROVED_FOR_DONATION', notes: 'e2e assessment' })
        .expect(201);

      const assessment = await db.donationAssessment.findFirstOrThrow({ where: { donationId } });
      expect(assessment.decision).toBe('APPROVED_FOR_DONATION');
    });

    it('staff can start the donation once the assessment approves it', async () => {
      // 200 for the same reason as confirm above: a state transition on an
      // existing donation.
      await request(app.getHttpServer())
        .post(`${API}/organizations/${bloodCenterId}/donations/${donationId}/start`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ donationType: 'WHOLE_BLOOD' })
        .expect(200);

      const donation = await db.donation.findUniqueOrThrow({ where: { id: donationId } });
      expect(donation.status).toBe('IN_PROGRESS');
    });

    it('a second assessment is refused once collection is under way', async () => {
      await request(app.getHttpServer())
        .post(`${API}/organizations/${bloodCenterId}/donations/${donationId}/assessment`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ decision: 'DEFERRED' })
        .expect(400);
    });

    it('rejects a completion with an out-of-range volume', async () => {
      // Guards the ValidationPipe actually running on this route (@Min(1)/@Max(10000)).
      const now = new Date();

      await request(app.getHttpServer())
        .post(`${API}/organizations/${bloodCenterId}/donations/${donationId}/complete`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          volumeMl: 999999,
          collectionStartedAt: new Date(now.getTime() - 20 * 60 * 1000).toISOString(),
          collectionCompletedAt: now.toISOString(),
        })
        .expect(400);
    });

    it('staff can complete the donation', async () => {
      const now = new Date();

      await request(app.getHttpServer())
        .post(`${API}/organizations/${bloodCenterId}/donations/${donationId}/complete`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          volumeMl: 450,
          collectionStartedAt: new Date(now.getTime() - 20 * 60 * 1000).toISOString(),
          collectionCompletedAt: now.toISOString(),
          notes: 'e2e completion',
        })
        .expect(200);

      const donation = await db.donation.findUniqueOrThrow({ where: { id: donationId } });
      expect(donation.status).toBe('COMPLETED');
      expect(donation.volumeMl).toBe(450);
    });

    it('put the collected blood into inventory as part of that same completion', async () => {
      // Sprint 3, item 6. This request carried no blood group, and until now
      // that meant the donation completed and no BloodUnit was created: the
      // donor was credited for a bag that inventory had never heard of. The
      // group comes from the donor's verified profile, and it is recorded.
      const profile = await db.donorProfile.findUniqueOrThrow({ where: { userId: donorUserId } });
      const unit = await db.bloodUnit.findFirstOrThrow({ where: { donationId } });

      expect(unit.bloodType).toBe(profile.bloodType);
      expect(unit.rhFactor).toBe(profile.rhFactor);
      expect(unit.volumeMl).toBe(450);
      expect(unit.status).toBe('COLLECTED');
      expect(unit.organizationId).toBe(bloodCenterId);
    });

    it('recorded where that blood group came from, rather than leaving it unattributed', async () => {
      const verified = await db.donationEvent.findFirstOrThrow({
        where: { donationId, eventType: 'VERIFIED' },
      });

      expect(verified.metadata).toEqual(
        expect.objectContaining({ bloodTypeSource: 'VERIFIED_PROFILE' }),
      );
    });

    it('did not treat a routine donation as an emergency one', async () => {
      // Sprint 3, item 5. The donor seeded here has emergency responses on
      // record; this donation is simply not linked to any of them.
      const donation = await db.donation.findUniqueOrThrow({ where: { id: donationId } });

      expect(donation.emergencyResponseId).toBeNull();
    });
  });

  describe('5. The donor sees the result', () => {
    it('the completed donation appears in the donor\'s history', async () => {
      const res = await request(app.getHttpServer())
        .get(`${API}/donations/me?past=true`)
        .set('Authorization', `Bearer ${donorToken}`)
        .expect(200);

      const items = res.body.data?.items ?? res.body.data ?? [];
      const mine = items.find((d: { id: string }) => d.id === donationId);

      expect(mine).toBeDefined();
      expect(mine.status).toBe('COMPLETED');
    });

    it('the donation belongs to the donor who booked it', async () => {
      const donation = await db.donation.findUniqueOrThrow({ where: { id: donationId } });

      expect(donation.donorId).toBe(donorUserId);
    });

    it('a donor cannot read another organization\'s donation list', async () => {
      await request(app.getHttpServer())
        .get(`${API}/organizations/${bloodCenterId}/donations`)
        .set('Authorization', `Bearer ${donorToken}`)
        .expect(403);
    });

    it('the donation is unreachable without a token', async () => {
      await request(app.getHttpServer()).get(`${API}/donations/${donationId}`).expect(401);
    });
  });
});
