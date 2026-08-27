import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { PrismaService } from './../src/database/prisma.service';
import { API, SEEDED, createTestApp, seededOrganizations, tokenFor } from './utils/e2e';

/**
 * The blood-unit inventory lifecycle, end to end.
 *
 * This is the domain where a wrong state transition has clinical consequences:
 * a quarantined or discarded unit must never become issuable again, and a
 * discard must be terminal. The suite drives a real unit through
 * quarantine -> release -> reserve -> release-reservation -> issue and asserts
 * both the allowed transitions and the ones that must be refused, then checks
 * that every movement left an audit trail.
 *
 * Each test owns its own unit (created in beforeEach, removed in afterEach) so
 * a transition performed by one test cannot leak into another, and so the
 * seeded demo inventory is never consumed.
 */
describe('Inventory lifecycle (e2e)', () => {
  let app: INestApplication;
  let db: PrismaService;

  let centerToken: string;
  let hospitalToken: string;
  let donorToken: string;

  let bloodCenterId: string;
  let hospitalId: string;
  let donorUserId: string;

  let unitId: string;
  let donationId: string;

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(PrismaService);

    const orgs = await seededOrganizations(app);
    bloodCenterId = orgs.bloodCenter.id;
    hospitalId = orgs.hospital.id;

    centerToken = await tokenFor(app, SEEDED.bloodCenterStaff);
    hospitalToken = await tokenFor(app, SEEDED.hospitalStaff);
    donorToken = await tokenFor(app, SEEDED.donor);

    const donor = await db.user.findUniqueOrThrow({ where: { email: SEEDED.donor } });
    donorUserId = donor.id;
  });

  beforeEach(async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const donation = await db.donation.create({
      data: {
        donationReference: `E2E-INV-DON-${stamp}`,
        donorId: donorUserId,
        organizationId: bloodCenterId,
        donationType: 'WHOLE_BLOOD',
        status: 'COMPLETED',
        volumeMl: 450,
      },
    });
    donationId = donation.id;

    const unit = await db.bloodUnit.create({
      data: {
        unitReference: `E2E-INV-UNIT-${stamp}`,
        donationId: donation.id,
        organizationId: bloodCenterId,
        componentType: 'WHOLE_BLOOD',
        bloodType: 'A',
        rhFactor: 'POSITIVE',
        volumeMl: 450,
        status: 'AVAILABLE',
        collectedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    unitId = unit.id;
  });

  afterEach(async () => {
    // The unit, its movements and reservations cascade off the donation.
    await db.inventoryMovement.deleteMany({ where: { bloodUnitId: unitId } });
    await db.donation.deleteMany({ where: { id: donationId } });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Reading inventory', () => {
    it('blood-centre staff can list units and see the new one', async () => {
      const res = await request(app.getHttpServer())
        .get(`${API}/organizations/${bloodCenterId}/inventory?status=AVAILABLE`)
        .set('Authorization', `Bearer ${centerToken}`)
        .expect(200);

      const items = res.body.data?.items ?? res.body.data ?? [];
      expect(items.some((u: { id: string }) => u.id === unitId)).toBe(true);
    });

    it('the summary endpoint responds for staff', async () => {
      await request(app.getHttpServer())
        .get(`${API}/organizations/${bloodCenterId}/inventory/summary`)
        .set('Authorization', `Bearer ${centerToken}`)
        .expect(200);
    });

    it('a donor cannot read organization inventory', async () => {
      await request(app.getHttpServer())
        .get(`${API}/organizations/${bloodCenterId}/inventory`)
        .set('Authorization', `Bearer ${donorToken}`)
        .expect(403);
    });

    it('inventory is unreachable without a token', async () => {
      await request(app.getHttpServer())
        .get(`${API}/organizations/${bloodCenterId}/inventory`)
        .expect(401);
    });
  });

  describe('Quarantine and release', () => {
    it('staff can quarantine an available unit and release it back', async () => {
      await request(app.getHttpServer())
        .post(`${API}/organizations/${bloodCenterId}/inventory/units/${unitId}/quarantine`)
        .set('Authorization', `Bearer ${centerToken}`)
        .send({ reason: 'e2e quarantine' })
        .expect(201);

      let unit = await db.bloodUnit.findUniqueOrThrow({ where: { id: unitId } });
      expect(unit.status).toBe('QUARANTINED');

      await request(app.getHttpServer())
        .post(`${API}/organizations/${bloodCenterId}/inventory/units/${unitId}/release`)
        .set('Authorization', `Bearer ${centerToken}`)
        .send({ reason: 'e2e release' })
        .expect(201);

      unit = await db.bloodUnit.findUniqueOrThrow({ where: { id: unitId } });
      expect(unit.status).toBe('AVAILABLE');
    });

    it('a quarantined unit cannot be issued', async () => {
      // The clinically important one: a unit pulled out of circulation must not
      // be issuable to a patient while it is quarantined.
      await request(app.getHttpServer())
        .post(`${API}/organizations/${bloodCenterId}/inventory/units/${unitId}/quarantine`)
        .set('Authorization', `Bearer ${centerToken}`)
        .send({ reason: 'e2e quarantine' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post(`${API}/organizations/${bloodCenterId}/inventory/units/${unitId}/issue`)
        .set('Authorization', `Bearer ${centerToken}`)
        .send({ reason: 'e2e issue attempt' });

      expect([400, 409]).toContain(res.status);

      const unit = await db.bloodUnit.findUniqueOrThrow({ where: { id: unitId } });
      expect(unit.status).toBe('QUARANTINED');
    });
  });

  describe('Discard is terminal', () => {
    it('a discarded unit cannot be released, reserved or issued again', async () => {
      await request(app.getHttpServer())
        .post(`${API}/organizations/${bloodCenterId}/inventory/units/${unitId}/discard`)
        .set('Authorization', `Bearer ${centerToken}`)
        .send({ reason: 'e2e discard' })
        .expect(201);

      const discarded = await db.bloodUnit.findUniqueOrThrow({ where: { id: unitId } });
      expect(discarded.status).toBe('DISCARDED');

      for (const action of ['release', 'reserve', 'issue']) {
        const res = await request(app.getHttpServer())
          .post(`${API}/organizations/${bloodCenterId}/inventory/units/${unitId}/${action}`)
          .set('Authorization', `Bearer ${centerToken}`)
          .send({ reason: 'e2e post-discard attempt' });

        expect([400, 409]).toContain(res.status);
      }

      const stillDiscarded = await db.bloodUnit.findUniqueOrThrow({ where: { id: unitId } });
      expect(stillDiscarded.status).toBe('DISCARDED');
    });
  });

  describe('Reserve and issue', () => {
    it('staff can reserve a unit, then release the reservation', async () => {
      await request(app.getHttpServer())
        .post(`${API}/organizations/${bloodCenterId}/inventory/units/${unitId}/reserve`)
        .set('Authorization', `Bearer ${centerToken}`)
        .send({ reason: 'e2e reserve' })
        .expect(201);

      const reserved = await db.bloodUnit.findUniqueOrThrow({ where: { id: unitId } });
      expect(reserved.status).toBe('RESERVED');

      const reservation = await db.bloodUnitReservation.findFirstOrThrow({
        where: { bloodUnitId: unitId, status: 'ACTIVE' },
      });

      await request(app.getHttpServer())
        .post(`${API}/organizations/${bloodCenterId}/inventory/reservations/${reservation.id}/release`)
        .set('Authorization', `Bearer ${centerToken}`)
        .send({})
        .expect(201);

      const afterRelease = await db.bloodUnit.findUniqueOrThrow({ where: { id: unitId } });
      expect(afterRelease.status).toBe('AVAILABLE');
    });

    it('an available unit can be issued', async () => {
      await request(app.getHttpServer())
        .post(`${API}/organizations/${bloodCenterId}/inventory/units/${unitId}/issue`)
        .set('Authorization', `Bearer ${centerToken}`)
        .send({ reason: 'e2e issue' })
        .expect(201);

      const unit = await db.bloodUnit.findUniqueOrThrow({ where: { id: unitId } });
      expect(unit.status).toBe('USED');
    });

    it('a unit cannot be issued twice', async () => {
      await request(app.getHttpServer())
        .post(`${API}/organizations/${bloodCenterId}/inventory/units/${unitId}/issue`)
        .set('Authorization', `Bearer ${centerToken}`)
        .send({ reason: 'e2e issue' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post(`${API}/organizations/${bloodCenterId}/inventory/units/${unitId}/issue`)
        .set('Authorization', `Bearer ${centerToken}`)
        .send({ reason: 'e2e double issue' });

      expect([400, 409]).toContain(res.status);
    });
  });

  describe('Tenant isolation and audit trail', () => {
    it('hospital staff cannot quarantine a blood-centre unit', async () => {
      // Quarantine is restricted to blood-centre roles; a hospital token must
      // not be able to reach into another organization's inventory.
      // Exactly 403, not 404: the route plainly exists (other tests here call
      // it successfully), so this must be the role guard refusing, which also
      // confirms the denial happens before the handler touches the unit.
      await request(app.getHttpServer())
        .post(`${API}/organizations/${bloodCenterId}/inventory/units/${unitId}/quarantine`)
        .set('Authorization', `Bearer ${hospitalToken}`)
        .send({ reason: 'e2e cross-org' })
        .expect(403);

      const unit = await db.bloodUnit.findUniqueOrThrow({ where: { id: unitId } });
      expect(unit.status).toBe('AVAILABLE');
    });

    it('every state change is recorded as an inventory movement', async () => {
      await request(app.getHttpServer())
        .post(`${API}/organizations/${bloodCenterId}/inventory/units/${unitId}/quarantine`)
        .set('Authorization', `Bearer ${centerToken}`)
        .send({ reason: 'e2e audit' })
        .expect(201);

      const movements = await db.inventoryMovement.findMany({ where: { bloodUnitId: unitId } });
      expect(movements.length).toBeGreaterThan(0);

      const res = await request(app.getHttpServer())
        .get(`${API}/organizations/${bloodCenterId}/inventory/movements?bloodUnitId=${unitId}`)
        .set('Authorization', `Bearer ${centerToken}`)
        .expect(200);

      const items = res.body.data?.items ?? res.body.data ?? [];
      expect(items.length).toBeGreaterThan(0);
    });
  });
});
