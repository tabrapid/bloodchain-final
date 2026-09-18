import { INestApplication } from '@nestjs/common';
import { AppointmentType, SlotStatus } from '@prisma/client';
import request from 'supertest';

import { PrismaService } from '../src/database/prisma.service';
import { API, SEEDED, createTestApp, seededOrganizations, tokenFor } from './utils/e2e';

/**
 * S4-1: the test type the donor picks is the test type the laboratory sees.
 *
 * The mobile app's "Book a blood test" used to push into the *generic*
 * appointment wizard, which posts `POST /appointments` -- a DTO with no
 * `testTypeId` field. Every blood test booked from the app therefore arrived at
 * the blood centre as an untyped appointment, and staff had to telephone the
 * donor to ask which panel they had come for. The app now has its own
 * laboratory wizard that posts `POST /laboratory-appointments`.
 *
 * These tests walk the real routes the two clients call, against the real
 * response bodies, so they fail if either side of that contract moves: if the
 * booking route stops persisting the choice, if the staff console's list stops
 * returning it, or if the donor's own appointment stops naming it back.
 */
describe('a laboratory booking carries its test type to the laboratory', () => {
  let app: INestApplication;
  let db: PrismaService;
  let donorToken: string;
  let staffToken: string;
  let organizationId: string;
  let testTypeId: string;
  let testTypeName: string;
  let otherTestTypeId: string;
  const createdSlotIds: string[] = [];
  const createdAppointmentIds: string[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(PrismaService);
    donorToken = await tokenFor(app, SEEDED.donor);
    staffToken = await tokenFor(app, SEEDED.bloodCenterAdmin);

    const { bloodCenter } = await seededOrganizations(app);
    organizationId = bloodCenter.id;

    // The laboratory has to be able to run the panel, or the booking is
    // rightly refused -- which is exactly what the wizard's second step filters
    // on, so the fixture mirrors it instead of picking any two test types.
    const profile = await db.laboratoryProfile.findFirstOrThrow({
      where: { organizationId },
      include: { testTypes: { where: { isActive: true } } },
    });

    expect(profile.testTypes.length).toBeGreaterThanOrEqual(2);
    testTypeId = profile.testTypes[0].id;
    testTypeName = profile.testTypes[0].name;
    otherTestTypeId = profile.testTypes[1].id;
  });

  afterAll(async () => {
    // These suites run against the shared demo database, so the fixtures clean
    // up after themselves rather than leaving bookings the demo would show.
    await db.appointmentHistory.deleteMany({
      where: { appointmentId: { in: createdAppointmentIds } },
    });
    await db.appointment.deleteMany({ where: { id: { in: createdAppointmentIds } } });
    await db.appointmentSlot.deleteMany({ where: { id: { in: createdSlotIds } } });
    await app.close();
  });

  /** A fresh, bookable BLOOD_TEST slot at the seeded blood centre. */
  async function openSlot(hoursFromNow = 48) {
    const startAt = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
    const slot = await db.appointmentSlot.create({
      data: {
        organizationId,
        appointmentType: AppointmentType.BLOOD_TEST,
        startAt,
        endAt: new Date(startAt.getTime() + 30 * 60 * 1000),
        capacity: 1,
        bookedCount: 0,
        status: SlotStatus.AVAILABLE,
      },
    });
    createdSlotIds.push(slot.id);
    return slot;
  }

  async function book(slotId: string, chosenTestTypeId: string) {
    const res = await request(app.getHttpServer())
      .post(`${API}/laboratory-appointments`)
      .set('Authorization', `Bearer ${donorToken}`)
      .send({ laboratoryId: organizationId, testTypeId: chosenTestTypeId, slotId });

    if (res.status === 201 && res.body?.data?.id) {
      createdAppointmentIds.push(res.body.data.id as string);
    }
    return res;
  }

  it('lists only laboratories that offer the chosen panel, which is what step 2 filters on', async () => {
    const res = await request(app.getHttpServer())
      .get(`${API}/laboratories`)
      .set('Authorization', `Bearer ${donorToken}`)
      .expect(200);

    const laboratories = res.body.data as Array<{
      id: string;
      laboratoryProfile?: { isActive: boolean; testTypes: Array<{ id: string }> };
    }>;

    expect(Array.isArray(laboratories)).toBe(true);

    // The client's `laboratoriesOfferingTestType` helper is this predicate. If
    // the payload stopped carrying `laboratoryProfile.testTypes`, the mobile
    // step would silently offer nothing, so the shape is asserted here.
    const offering = laboratories.filter((laboratory) =>
      (laboratory.laboratoryProfile?.testTypes ?? []).some((type) => type.id === testTypeId),
    );

    expect(offering.map((laboratory) => laboratory.id)).toContain(organizationId);
  });

  it('persists the donor choice and hands the laboratory the same panel', async () => {
    const slot = await openSlot(49);
    const booking = await book(slot.id, testTypeId);

    expect(booking.status).toBe(201);
    const appointmentId = booking.body.data.id as string;
    expect(booking.body.data.testTypeId).toBe(testTypeId);

    // The row itself, not just the response: this is what the laboratory reads.
    const stored = await db.appointment.findUniqueOrThrow({ where: { id: appointmentId } });
    expect(stored.testTypeId).toBe(testTypeId);
    expect(stored.appointmentType).toBe(AppointmentType.BLOOD_TEST);

    // The staff console's own route, with its own response contract.
    const staffList = await request(app.getHttpServer())
      .get(`${API}/organizations/${organizationId}/laboratory-appointments`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    const staffRow = (staffList.body.data as Array<{ id: string; testType?: { id: string; name: string } }>)
      .find((row) => row.id === appointmentId);

    expect(staffRow).toBeDefined();
    expect(staffRow!.testType).toBeDefined();
    expect(staffRow!.testType!.id).toBe(testTypeId);
    expect(staffRow!.testType!.name).toBe(testTypeName);
  });

  it('names the booked panel back to the donor in their own list and detail', async () => {
    const slot = await openSlot(50);
    const booking = await book(slot.id, otherTestTypeId);
    expect(booking.status).toBe(201);
    const appointmentId = booking.body.data.id as string;

    const list = await request(app.getHttpServer())
      .get(`${API}/me/laboratory-appointments`)
      .set('Authorization', `Bearer ${donorToken}`)
      .expect(200);

    const row = (list.body.data as Array<{ id: string; testType?: { id: string } }>).find(
      (candidate) => candidate.id === appointmentId,
    );
    expect(row).toBeDefined();
    expect(row!.testType?.id).toBe(otherTestTypeId);

    const detail = await request(app.getHttpServer())
      .get(`${API}/me/laboratory-appointments/${appointmentId}`)
      .set('Authorization', `Bearer ${donorToken}`)
      .expect(200);

    expect(detail.body.data.testType?.id).toBe(otherTestTypeId);
    expect(detail.body.data.status).toBe('PENDING');
    expect(detail.body.data.referenceNumber).toEqual(expect.stringMatching(/^LAB-/));
  });

  it('refuses a panel the laboratory does not run, rather than booking an untyped visit', async () => {
    const offered = await db.laboratoryProfile.findFirstOrThrow({
      where: { organizationId },
      include: { testTypes: { select: { id: true } } },
    });
    const notOffered = await db.testType.findFirst({
      where: { id: { notIn: offered.testTypes.map((type) => type.id) } },
    });

    if (!notOffered) {
      // Every test type in this deployment is offered here; there is nothing to
      // refuse, and asserting anyway would be asserting the fixture.
      return;
    }

    const slot = await openSlot(51);
    const res = await book(slot.id, notOffered.id);

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);

    const stored = await db.appointment.findFirst({ where: { slotId: slot.id } });
    expect(stored).toBeNull();
  });

  it('will not hand two donors the same single-capacity slot', async () => {
    const slot = await openSlot(52);

    const first = await book(slot.id, testTypeId);
    expect(first.status).toBe(201);

    const second = await book(slot.id, testTypeId);
    expect(second.status).toBe(400);

    const bookings = await db.appointment.count({
      where: { slotId: slot.id, status: { notIn: ['CANCELLED', 'NO_SHOW'] } },
    });
    expect(bookings).toBe(1);
  });
});
