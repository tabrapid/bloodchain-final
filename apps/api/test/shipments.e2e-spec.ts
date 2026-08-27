import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { PrismaService } from './../src/database/prisma.service';
import { API, SEEDED, createTestApp, seededOrganizations, tokenFor } from './utils/e2e';

/**
 * The blood request -> shipment -> delivery chain, end to end.
 *
 * This is the hand-off between two organizations and a courier, and it is the
 * flow with the most state transitions in the product. Every step here goes
 * through the real routes and the real database, with four actors whose roles
 * genuinely differ: hospital staff raise the request, blood-centre staff
 * approve and dispatch it, a courier carries it, and the hospital confirms
 * receipt.
 *
 * The suite brings its own inventory (a dedicated donation + blood unit created
 * in beforeAll) rather than consuming one of the seeded units, so running it
 * does not quietly deplete the demo data.
 */
describe('Blood request and shipment chain (e2e)', () => {
  let app: INestApplication;
  let db: PrismaService;

  let hospitalToken: string;
  let centerToken: string;
  let courierToken: string;
  let donorUserId: string;

  let hospitalId: string;
  let bloodCenterId: string;
  let courierId: string;
  let previousCourierStatus: string;

  // Fixtures this suite owns and cleans up.
  let fixtureDonationId: string;
  let fixtureUnitId: string;

  // Created through the API during the flow.
  let requestId: string;
  let shipmentId: string;

  const UNIT_REF = `E2E-UNIT-${Date.now()}`;
  const DONATION_REF = `E2E-DON-${Date.now()}`;

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(PrismaService);

    const orgs = await seededOrganizations(app);
    hospitalId = orgs.hospital.id;
    bloodCenterId = orgs.bloodCenter.id;

    hospitalToken = await tokenFor(app, SEEDED.hospitalStaff);
    centerToken = await tokenFor(app, SEEDED.bloodCenterStaff);
    courierToken = await tokenFor(app, SEEDED.courier);

    const donor = await db.user.findUniqueOrThrow({ where: { email: SEEDED.donor } });
    donorUserId = donor.id;

    // A dedicated AB- unit for this suite to ship, deliberately collected long
    // before any seeded unit. Approval picks stock with
    // `orderBy: { collectedAt: 'asc' }` -- oldest first, which is correct stock
    // rotation -- so dating this unit back is what makes "the unit this suite
    // created is the one that gets reserved" a deterministic claim rather than
    // a race against whatever the seed happens to hold. It still expires in the
    // future, so it is genuinely issuable.
    const collectedAt = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const donation = await db.donation.create({
      data: {
        donationReference: DONATION_REF,
        donorId: donorUserId,
        organizationId: bloodCenterId,
        donationType: 'WHOLE_BLOOD',
        status: 'COMPLETED',
        volumeMl: 450,
      },
    });
    fixtureDonationId = donation.id;

    const unit = await db.bloodUnit.create({
      data: {
        unitReference: UNIT_REF,
        donationId: donation.id,
        organizationId: bloodCenterId,
        componentType: 'WHOLE_BLOOD',
        bloodType: 'AB',
        rhFactor: 'NEGATIVE',
        volumeMl: 450,
        status: 'AVAILABLE',
        collectedAt,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    fixtureUnitId = unit.id;

    // The seeded courier is OFFLINE by default; assignment requires AVAILABLE.
    const courier = await db.courier.findFirstOrThrow({
      where: { organizationId: bloodCenterId },
    });
    courierId = courier.id;
    previousCourierStatus = courier.status;
    await db.courier.update({ where: { id: courierId }, data: { status: 'AVAILABLE' } });
  });

  afterAll(async () => {
    // No catch-and-ignore here on purpose: a silently swallowed cleanup error
    // leaves rows behind that make a later run fail for an unrelated-looking
    // reason. deleteMany on a non-existent row is already a no-op, so a throw
    // here means something genuinely wrong, and the suite should say so.
    //
    // Shipment events/units and blood-request items/events/reservations all
    // cascade off their parent, and the blood unit cascades off its donation,
    // so only the roots need deleting -- in dependency order.
    if (shipmentId) {
      await db.shipment.deleteMany({ where: { id: shipmentId } });
    }
    if (requestId) {
      await db.bloodRequest.deleteMany({ where: { id: requestId } });
    }
    if (fixtureUnitId) {
      await db.inventoryMovement.deleteMany({ where: { bloodUnitId: fixtureUnitId } });
    }
    if (fixtureDonationId) {
      await db.donation.deleteMany({ where: { id: fixtureDonationId } });
    }
    if (courierId) {
      await db.courier.update({
        where: { id: courierId },
        data: { status: previousCourierStatus as never },
      });
    }

    await app.close();
  });

  describe('1. The hospital raises a request', () => {
    it('hospital staff can submit a blood request', async () => {
      const res = await request(app.getHttpServer())
        .post(`${API}/organizations/${hospitalId}/blood-requests`)
        .set('Authorization', `Bearer ${hospitalToken}`)
        .send({
          priority: 'ROUTINE',
          notes: 'e2e shipment chain',
          items: [{ bloodType: 'AB', rhFactor: 'NEGATIVE', unitsRequested: 1 }],
        })
        .expect(201);

      requestId = res.body.data?.id ?? res.body.id;
      expect(requestId).toBeDefined();

      const created = await db.bloodRequest.findUniqueOrThrow({ where: { id: requestId } });
      expect(created.status).toBe('SUBMITTED');
      expect(created.requestingOrganizationId).toBe(hospitalId);
    });

    it('rejects a request with no items', async () => {
      await request(app.getHttpServer())
        .post(`${API}/organizations/${hospitalId}/blood-requests`)
        .set('Authorization', `Bearer ${hospitalToken}`)
        .send({ priority: 'ROUTINE' })
        .expect(400);
    });

    it('a courier cannot raise blood requests', async () => {
      await request(app.getHttpServer())
        .post(`${API}/organizations/${hospitalId}/blood-requests`)
        .set('Authorization', `Bearer ${courierToken}`)
        .send({ items: [{ bloodType: 'AB', rhFactor: 'NEGATIVE', unitsRequested: 1 }] })
        .expect(403);
    });
  });

  describe('2. The blood centre approves and prepares it', () => {
    it('hospital staff cannot approve their own request', async () => {
      // Approval is the blood centre's decision; the requester must not be able
      // to self-approve.
      const item = await db.bloodRequestItem.findFirstOrThrow({
        where: { bloodRequestId: requestId },
      });

      await request(app.getHttpServer())
        .post(`${API}/organizations/${bloodCenterId}/blood-requests/${requestId}/approve`)
        .set('Authorization', `Bearer ${hospitalToken}`)
        .send({ items: [{ itemId: item.id, unitsApproved: 1 }] })
        .expect(403);
    });

    it('blood-centre staff can approve it, reserving a real unit', async () => {
      const item = await db.bloodRequestItem.findFirstOrThrow({
        where: { bloodRequestId: requestId },
      });

      await request(app.getHttpServer())
        .post(`${API}/organizations/${bloodCenterId}/blood-requests/${requestId}/approve`)
        .set('Authorization', `Bearer ${centerToken}`)
        .send({ items: [{ itemId: item.id, unitsApproved: 1 }] })
        .expect(201);

      const updated = await db.bloodRequest.findUniqueOrThrow({ where: { id: requestId } });
      expect(updated.fulfillingOrganizationId).toBe(bloodCenterId);

      // The approval must take a real unit out of general availability, not
      // just advance the request's status. Because this suite's AB- unit is the
      // oldest matching stock, correct FIFO rotation must select exactly it --
      // so this also pins the rotation rule, not just "something got reserved".
      const unit = await db.bloodUnit.findUniqueOrThrow({ where: { id: fixtureUnitId } });
      expect(unit.status).toBe('RESERVED');

      const reservation = await db.bloodUnitReservation.findFirstOrThrow({
        where: { bloodUnitId: fixtureUnitId, status: 'ACTIVE' },
      });
      expect(reservation.reservedForOrganizationId).toBe(hospitalId);
    });

    it('blood-centre staff can mark it ready for pickup', async () => {
      await request(app.getHttpServer())
        .post(`${API}/organizations/${bloodCenterId}/blood-requests/${requestId}/ready-for-pickup`)
        .set('Authorization', `Bearer ${centerToken}`)
        .send({})
        .expect(201);

      const updated = await db.bloodRequest.findUniqueOrThrow({ where: { id: requestId } });
      expect(updated.status).toBe('READY_FOR_PICKUP');
    });
  });

  describe('3. Dispatch', () => {
    it('blood-centre staff can create the shipment', async () => {
      const res = await request(app.getHttpServer())
        .post(`${API}/organizations/${bloodCenterId}/blood-requests/${requestId}/shipments`)
        .set('Authorization', `Bearer ${centerToken}`)
        .send({ pickupAddress: 'Northstar Blood Center dock' })
        .expect(201);

      shipmentId = res.body.data?.id ?? res.body.id;
      expect(shipmentId).toBeDefined();

      const shipment = await db.shipment.findUniqueOrThrow({ where: { id: shipmentId } });
      expect(shipment.status).toBe('CREATED');
      expect(shipment.sourceOrganizationId).toBe(bloodCenterId);
      expect(shipment.destinationOrganizationId).toBe(hospitalId);
    });

    it('refuses a second shipment for the same request', async () => {
      await request(app.getHttpServer())
        .post(`${API}/organizations/${bloodCenterId}/blood-requests/${requestId}/shipments`)
        .set('Authorization', `Bearer ${centerToken}`)
        .send({})
        .expect(409);
    });

    it('blood-centre staff can assign the courier', async () => {
      await request(app.getHttpServer())
        .post(`${API}/organizations/${bloodCenterId}/shipments/${shipmentId}/assign`)
        .set('Authorization', `Bearer ${centerToken}`)
        .send({ courierId })
        .expect(201);

      const shipment = await db.shipment.findUniqueOrThrow({ where: { id: shipmentId } });
      expect(shipment.courierId).toBe(courierId);
    });

    it('the hospital cannot assign couriers to another org\'s shipment', async () => {
      await request(app.getHttpServer())
        .post(`${API}/organizations/${hospitalId}/shipments/${shipmentId}/assign`)
        .set('Authorization', `Bearer ${hospitalToken}`)
        .send({ courierId })
        .expect(403);
    });
  });

  describe('4. The courier carries it', () => {
    it('the shipment appears on the courier\'s own list', async () => {
      const res = await request(app.getHttpServer())
        .get(`${API}/courier/shipments`)
        .set('Authorization', `Bearer ${courierToken}`)
        .expect(200);

      const items = res.body.data?.items ?? res.body.data ?? [];
      expect(items.some((s: { id: string }) => s.id === shipmentId)).toBe(true);
    });

    it('blood-centre staff cannot act as the courier', async () => {
      await request(app.getHttpServer())
        .post(`${API}/courier/shipments/${shipmentId}/accept`)
        .set('Authorization', `Bearer ${centerToken}`)
        .send({})
        .expect(403);
    });

    it('the courier walks the shipment through to arrival', async () => {
      const steps = ['accept', 'start-pickup', 'confirm-pickup', 'start-delivery', 'arrive'];

      for (const step of steps) {
        const res = await request(app.getHttpServer())
          .post(`${API}/courier/shipments/${shipmentId}/${step}`)
          .set('Authorization', `Bearer ${courierToken}`)
          .send({});

        expect([200, 201]).toContain(res.status);
      }

      const shipment = await db.shipment.findUniqueOrThrow({ where: { id: shipmentId } });
      expect(shipment.status).toBe('ARRIVED_AT_HOSPITAL');
    });

    it('the same step cannot be replayed out of order', async () => {
      // Re-accepting an already-arrived shipment must be refused, not silently
      // accepted -- the state machine has to actually hold.
      const res = await request(app.getHttpServer())
        .post(`${API}/courier/shipments/${shipmentId}/accept`)
        .set('Authorization', `Bearer ${courierToken}`)
        .send({});

      expect([400, 409]).toContain(res.status);
    });
  });

  describe('5. The hospital receives it', () => {
    it('requires a unit count on the confirmation', async () => {
      await request(app.getHttpServer())
        .post(`${API}/organizations/${hospitalId}/shipments/${shipmentId}/confirm-delivery`)
        .set('Authorization', `Bearer ${hospitalToken}`)
        .send({})
        .expect(400);
    });

    it('refuses to receive more units than were shipped', async () => {
      await request(app.getHttpServer())
        .post(`${API}/organizations/${hospitalId}/shipments/${shipmentId}/confirm-delivery`)
        .set('Authorization', `Bearer ${hospitalToken}`)
        .send({ unitsReceived: 99 })
        .expect(400);
    });

    it('requires a reason when the count does not match what was shipped', async () => {
      // Receiving fewer units than shipped is a chain-of-custody discrepancy;
      // the API must not let it through silently.
      await request(app.getHttpServer())
        .post(`${API}/organizations/${hospitalId}/shipments/${shipmentId}/confirm-delivery`)
        .set('Authorization', `Bearer ${hospitalToken}`)
        .send({ unitsReceived: 0 })
        .expect(400);
    });

    it('the receiving hospital can confirm delivery', async () => {
      const shipped = await db.shipmentUnit.count({ where: { shipmentId } });

      const res = await request(app.getHttpServer())
        .post(`${API}/organizations/${hospitalId}/shipments/${shipmentId}/confirm-delivery`)
        .set('Authorization', `Bearer ${hospitalToken}`)
        .send({ unitsReceived: shipped, condition: 'GOOD', notes: 'e2e delivery' });

      expect([200, 201]).toContain(res.status);

      const shipment = await db.shipment.findUniqueOrThrow({ where: { id: shipmentId } });
      expect(shipment.status).toBe('DELIVERED');
    });

    it('both organizations can see the finished shipment', async () => {
      for (const [orgId, token] of [
        [hospitalId, hospitalToken],
        [bloodCenterId, centerToken],
      ] as const) {
        const res = await request(app.getHttpServer())
          .get(`${API}/organizations/${orgId}/shipments/${shipmentId}`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(res.body.data?.id ?? res.body.id).toBe(shipmentId);
      }
    });

    it('the shipment is unreachable without a token', async () => {
      await request(app.getHttpServer())
        .get(`${API}/organizations/${hospitalId}/shipments/${shipmentId}`)
        .expect(401);
    });
  });
});
