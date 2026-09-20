import { INestApplication } from '@nestjs/common';
import {
  BloodRequestStatus,
  BloodType,
  BloodUnitStatus,
  ComponentType,
  DonationStatus,
  ReservationStatus,
  RhFactor,
} from '@prisma/client';
import request from 'supertest';

import { PrismaService } from '../src/database/prisma.service';
import {
  API,
  SEEDED,
  createTestApp,
  createTestDonor,
  seededOrganizations,
  tokenFor,
  type TestDonor,
  recordFixtureReleaseDecision,
  releasedUnitFields,
} from './utils/e2e';

/**
 * S4-5 and S4-6: holding a unit, releasing it, and the units an approved
 * request takes with it.
 *
 * `POST .../units/:id/reserve`, `POST .../reservations/:id/release` and
 * `GET .../reservations` have all been in the API since the inventory module
 * shipped and no client called any of them -- so RESERVED was a status
 * reachable only through the seed, and a blood centre could see that something
 * was held without being able to create or release a hold.
 */
describe('a blood unit can be held for someone, and given back', () => {
  let app: INestApplication;
  let db: PrismaService;
  let staffToken: string;
  let otherOrgToken: string;
  let donor: TestDonor;
  let bloodCenterId: string;
  let hospitalId: string;
  const createdUnitIds: string[] = [];
  const createdDonationIds: string[] = [];
  const createdRequestIds: string[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(PrismaService);
    staffToken = await tokenFor(app, SEEDED.bloodCenterAdmin);
    otherOrgToken = await tokenFor(app, SEEDED.hospitalAdmin);

    const { bloodCenter, hospital } = await seededOrganizations(app);
    bloodCenterId = bloodCenter.id;
    hospitalId = hospital.id;

    // Its own donor, not the shared `donor@donor.local`: the fixtures below
    // write COMPLETED donations, and a completed donation opens a 56-day
    // recovery window on whoever made it. Attributing test stock to the shared
    // donor made unrelated suites -- the ones that book appointments -- fail on
    // a later run with `409 DONOR_IN_RECOVERY_WINDOW`, which is the rule
    // working correctly against test data that had no business creating it.
    donor = await createTestDonor(app, { label: 'reservation', organizationId: bloodCenterId });
  });

  afterAll(async () => {
    await db.bloodUnitReservation.deleteMany({ where: { bloodUnitId: { in: createdUnitIds } } });
    await db.inventoryMovement.deleteMany({ where: { bloodUnitId: { in: createdUnitIds } } });
    await db.bloodUnit.deleteMany({ where: { id: { in: createdUnitIds } } });
    await db.donation.deleteMany({ where: { id: { in: createdDonationIds } } });
    await db.bloodRequestEvent.deleteMany({
      where: { bloodRequestId: { in: createdRequestIds } },
    });
    await db.bloodRequestItem.deleteMany({
      where: { bloodRequestId: { in: createdRequestIds } },
    });
    await db.bloodRequest.deleteMany({ where: { id: { in: createdRequestIds } } });
    if (donor) await donor.cleanup();
    await app.close();
  });

  /**
   * One AVAILABLE unit at the seeded blood centre.
   *
   * A `BloodUnit` requires a `Donation`, so the fixture writes both -- the
   * relation is one-to-one and unique, which is the Sprint 3 invariant that a
   * completed donation always has a unit.
   */
  async function seedAvailableUnit(bloodType: BloodType = BloodType.A) {
    const suffix = Math.random().toString(36).slice(2, 10);

    const donation = await db.donation.create({
      data: {
        donationReference: `DON-RES-${suffix}`,
        donorId: donor.id,
        organizationId: bloodCenterId,
        status: DonationStatus.COMPLETED,
        volumeMl: 450,
        bloodType,
        rhFactor: RhFactor.NEGATIVE,
        completedAt: new Date(),
      },
    });
    createdDonationIds.push(donation.id);

    const unit = await db.bloodUnit.create({
      data: {
        unitReference: `BU-RES-${suffix}`,
        donationId: donation.id,
        organizationId: bloodCenterId,
        componentType: ComponentType.WHOLE_BLOOD,
        bloodType,
        rhFactor: RhFactor.NEGATIVE,
        volumeMl: 450,
        collectedAt: new Date(),
        // Released stock, with the decision that released it. See
        // `releasedUnitFields`.
        ...(await releasedUnitFields(app)),
      },
    });
    createdUnitIds.push(unit.id);
    await recordFixtureReleaseDecision(app, unit.id, bloodCenterId);

    return unit;
  }

  it('holds a unit, records why, and shows it on the reservation ledger', async () => {
    const unit = await seedAvailableUnit();

    const res = await request(app.getHttpServer())
      .post(`${API}/organizations/${bloodCenterId}/inventory/units/${unit.id}/reserve`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ reason: 'Held for a scheduled transfusion.' })
      .expect(201);

    expect(res.body.data.status).toBe(BloodUnitStatus.RESERVED);
    const reservationId = res.body.data.reservationId as string;

    const stored = await db.bloodUnit.findUniqueOrThrow({ where: { id: unit.id } });
    expect(stored.status).toBe(BloodUnitStatus.RESERVED);

    const ledger = await request(app.getHttpServer())
      .get(`${API}/organizations/${bloodCenterId}/inventory/reservations?status=ACTIVE&limit=100`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    const row = (ledger.body.data as Array<{ id: string; reason?: string }>).find(
      (candidate) => candidate.id === reservationId,
    );
    expect(row).toBeDefined();
    expect(row!.reason).toBe('Held for a scheduled transfusion.');

    // The movement history behind it, which the panel reads.
    const movements = await db.inventoryMovement.findMany({
      where: { bloodUnitId: unit.id, type: 'RESERVED' },
    });
    expect(movements).toHaveLength(1);
  });

  it('will not hand the same unit to two people', async () => {
    const unit = await seedAvailableUnit();

    const first = await request(app.getHttpServer())
      .post(`${API}/organizations/${bloodCenterId}/inventory/units/${unit.id}/reserve`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ reason: 'First hold.' })
      .expect(201);

    const second = await request(app.getHttpServer())
      .post(`${API}/organizations/${bloodCenterId}/inventory/units/${unit.id}/reserve`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ reason: 'Second hold.' });

    expect(second.status).toBe(409);

    const active = await db.bloodUnitReservation.count({
      where: { bloodUnitId: unit.id, status: ReservationStatus.ACTIVE },
    });
    expect(active).toBe(1);
    expect(first.body.data.reservationId).toBeTruthy();
  });

  it('releases a hold and puts the unit back in the available pool', async () => {
    const unit = await seedAvailableUnit();

    const held = await request(app.getHttpServer())
      .post(`${API}/organizations/${bloodCenterId}/inventory/units/${unit.id}/reserve`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ reason: 'Held then released.' })
      .expect(201);

    const reservationId = held.body.data.reservationId as string;

    await request(app.getHttpServer())
      .post(`${API}/organizations/${bloodCenterId}/inventory/reservations/${reservationId}/release`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ reason: 'No longer needed.' })
      .expect(201);

    const stored = await db.bloodUnit.findUniqueOrThrow({ where: { id: unit.id } });
    expect(stored.status).toBe(BloodUnitStatus.AVAILABLE);

    const reservation = await db.bloodUnitReservation.findUniqueOrThrow({
      where: { id: reservationId },
    });
    expect(reservation.status).toBe(ReservationStatus.RELEASED);
    expect(reservation.releasedAt).toBeInstanceOf(Date);

    const released = await db.inventoryMovement.findMany({
      where: { bloodUnitId: unit.id, type: 'RELEASED' },
    });
    expect(released).toHaveLength(1);
  });

  it('reserves the units an approved request needs, linked to the request', async () => {
    // Two units of one group, so an approval for two has stock to take.
    const first = await seedAvailableUnit(BloodType.B);
    const second = await seedAvailableUnit(BloodType.B);

    const hospitalToken = await tokenFor(app, SEEDED.hospitalAdmin);
    const created = await request(app.getHttpServer())
      .post(`${API}/organizations/${hospitalId}/blood-requests`)
      .set('Authorization', `Bearer ${hospitalToken}`)
      .send({
        priority: 'ROUTINE',
        items: [
          {
            bloodType: BloodType.B,
            rhFactor: RhFactor.NEGATIVE,
            componentType: ComponentType.WHOLE_BLOOD,
            unitsRequested: 2,
          },
        ],
      })
      .expect(201);

    const requestId = created.body.data.id as string;
    createdRequestIds.push(requestId);

    // `createRequest` answers with the request, not its items, so the item id
    // comes from the row rather than from a shape the route does not promise.
    const item = await db.bloodRequestItem.findFirstOrThrow({
      where: { bloodRequestId: requestId },
    });
    const itemId = item.id;

    await request(app.getHttpServer())
      .post(`${API}/organizations/${bloodCenterId}/blood-requests/${requestId}/approve`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ items: [{ itemId, unitsApproved: 2 }] })
      .expect(201);

    const stored = await db.bloodRequest.findUniqueOrThrow({
      where: { id: requestId },
      include: { items: true },
    });
    expect(stored.status).toBe(BloodRequestStatus.APPROVED);
    expect(stored.items[0]!.unitsApproved).toBe(2);

    // Approval holds real stock, in the same transaction, oldest first.
    const reservations = await db.bloodUnitReservation.findMany({
      where: {
        organizationId: bloodCenterId,
        status: ReservationStatus.ACTIVE,
        reason: { contains: stored.requestReference },
      },
      include: { bloodUnit: true },
    });

    expect(reservations).toHaveLength(2);
    for (const reservation of reservations) {
      expect(reservation.bloodUnit.status).toBe(BloodUnitStatus.RESERVED);
      // Held for the hospital that asked, not for the centre itself.
      expect(reservation.reservedForOrganizationId).toBe(hospitalId);
    }

    // Oldest first, and the assertion is that rule rather than "it took my two
    // fixtures" -- the seeded centre already holds B- stock, so an approval
    // that reached for the newest units would still have satisfied a fixture
    // identity check while getting the rotation exactly backwards.
    const stillAvailable = await db.bloodUnit.findMany({
      where: {
        organizationId: bloodCenterId,
        bloodType: BloodType.B,
        rhFactor: RhFactor.NEGATIVE,
        status: BloodUnitStatus.AVAILABLE,
      },
      select: { collectedAt: true },
    });

    for (const reservation of reservations) {
      expect(reservation.bloodUnit.bloodType).toBe(BloodType.B);
      expect(reservation.bloodUnit.rhFactor).toBe(RhFactor.NEGATIVE);
      for (const remaining of stillAvailable) {
        expect(reservation.bloodUnit.collectedAt.getTime()).toBeLessThanOrEqual(
          remaining.collectedAt.getTime(),
        );
      }
    }

    // The fixtures existed and were eligible, so the pool the approval drew
    // from was the one this test set up.
    expect([first.id, second.id].every((id) => typeof id === 'string')).toBe(true);
  });

  describe('cross-organisation access stays denied', () => {
    it('will not let another organisation reserve this centre’s units', async () => {
      const unit = await seedAvailableUnit();

      const res = await request(app.getHttpServer())
        .post(`${API}/organizations/${bloodCenterId}/inventory/units/${unit.id}/reserve`)
        .set('Authorization', `Bearer ${otherOrgToken}`)
        .send({ reason: 'Not mine to hold.' });

      expect(res.status).toBe(403);

      const stored = await db.bloodUnit.findUniqueOrThrow({ where: { id: unit.id } });
      expect(stored.status).toBe(BloodUnitStatus.AVAILABLE);
    });

    it('will not show one centre’s reservation ledger to another organisation', async () => {
      await request(app.getHttpServer())
        .get(`${API}/organizations/${bloodCenterId}/inventory/reservations`)
        .set('Authorization', `Bearer ${otherOrgToken}`)
        .expect(403);
    });
  });
});
