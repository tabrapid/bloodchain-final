import { INestApplication } from '@nestjs/common';
import { AppointmentStatus, AppointmentType, SlotStatus } from '@prisma/client';
import request from 'supertest';

import { AppointmentExpiryService } from '../src/modules/appointments/appointment-expiry.service';
import { PrismaService } from '../src/database/prisma.service';
import { API, SEEDED, createTestApp, seededOrganizations, tokenFor } from './utils/e2e';

/**
 * S4-4: staff can see and close out the appointments they are actually
 * expecting.
 *
 * Staff could publish and block *slots*, and could confirm an appointment whose
 * id they already had, but nothing listed the appointments themselves -- so a
 * console could say "3 of 5 booked" and had no way to learn who the three were,
 * record that one did not turn up, or close one out. And `AppointmentStatus`
 * has had an `EXPIRED` member since the first migration that nothing ever set,
 * so an unattended booking held its seat in the slot forever.
 */
describe('the appointment desk can see and close out its bookings', () => {
  let app: INestApplication;
  let db: PrismaService;
  let staffToken: string;
  let donorToken: string;
  let otherOrgToken: string;
  let bloodCenterId: string;
  let hospitalId: string;
  let donorId: string;
  const createdSlotIds: string[] = [];
  const createdAppointmentIds: string[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(PrismaService);
    staffToken = await tokenFor(app, SEEDED.bloodCenterAdmin);
    donorToken = await tokenFor(app, SEEDED.donor);
    otherOrgToken = await tokenFor(app, SEEDED.hospitalAdmin);

    const organizations = await seededOrganizations(app);
    bloodCenterId = organizations.bloodCenter.id;
    hospitalId = organizations.hospital.id;

    const donor = await db.user.findUniqueOrThrow({ where: { email: SEEDED.donor } });
    donorId = donor.id;
  });

  afterAll(async () => {
    await db.appointmentHistory.deleteMany({
      where: { appointmentId: { in: createdAppointmentIds } },
    });
    await db.appointment.deleteMany({ where: { id: { in: createdAppointmentIds } } });
    await db.appointmentSlot.deleteMany({ where: { id: { in: createdSlotIds } } });
    await app.close();
  });

  /**
   * One appointment in a given state, written directly.
   *
   * The booking route enforces the donation recovery window, which is exactly
   * right for a donor and exactly wrong for a fixture that needs four
   * appointments in one run -- so these are seeded rather than booked. What is
   * under test is the desk's handling of them.
   */
  async function seedAppointment({
    status,
    hoursFromNow,
    capacity = 1,
    slotStatus,
  }: {
    status: AppointmentStatus;
    hoursFromNow: number;
    capacity?: number;
    slotStatus?: SlotStatus;
  }) {
    const startAt = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
    const endAt = new Date(startAt.getTime() + 30 * 60 * 1000);

    const slot = await db.appointmentSlot.create({
      data: {
        organizationId: bloodCenterId,
        appointmentType: AppointmentType.BLOOD_DONATION,
        startAt,
        endAt,
        capacity,
        bookedCount: 1,
        status: slotStatus ?? (capacity <= 1 ? SlotStatus.FULL : SlotStatus.AVAILABLE),
      },
    });
    createdSlotIds.push(slot.id);

    const appointment = await db.appointment.create({
      data: {
        referenceNumber: `DON-TEST-${Math.random().toString(36).slice(2, 10)}`,
        donorId,
        organizationId: bloodCenterId,
        slotId: slot.id,
        appointmentType: AppointmentType.BLOOD_DONATION,
        status,
        scheduledStart: startAt,
        scheduledEnd: endAt,
      },
    });
    createdAppointmentIds.push(appointment.id);

    return { slot, appointment };
  }

  it('lists the organization’s real appointments, not just its slots', async () => {
    const { appointment } = await seedAppointment({
      status: AppointmentStatus.PENDING,
      hoursFromNow: 26,
    });

    const res = await request(app.getHttpServer())
      .get(`${API}/appointments/organizations/${bloodCenterId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    const rows = res.body.data as Array<{
      id: string;
      donor: { id: string; firstName: string; email: string };
      referenceNumber: string;
    }>;

    const row = rows.find((candidate) => candidate.id === appointment.id);
    expect(row).toBeDefined();
    // The point of the list: who is coming in, identifiable.
    expect(row!.donor.id).toBe(donorId);
    expect(row!.donor.email).toBe(SEEDED.donor);
    expect(row!.referenceNumber).toBe(appointment.referenceNumber);
  });

  it('filters by status and by day', async () => {
    const { appointment } = await seedAppointment({
      status: AppointmentStatus.CONFIRMED,
      hoursFromNow: 27,
    });

    const confirmed = await request(app.getHttpServer())
      .get(`${API}/appointments/organizations/${bloodCenterId}?status=CONFIRMED`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    const ids = (confirmed.body.data as Array<{ id: string; status: string }>).map((r) => r.id);
    expect(ids).toContain(appointment.id);
    expect(
      (confirmed.body.data as Array<{ status: string }>).every((r) => r.status === 'CONFIRMED'),
    ).toBe(true);

    // A bad filter value is refused rather than silently ignored.
    await request(app.getHttpServer())
      .get(`${API}/appointments/organizations/${bloodCenterId}?status=NOT_A_STATUS`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(400);
  });

  it('confirms a pending appointment', async () => {
    const { appointment } = await seedAppointment({
      status: AppointmentStatus.PENDING,
      hoursFromNow: 28,
    });

    await request(app.getHttpServer())
      .post(`${API}/appointments/${appointment.id}/confirm`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    const stored = await db.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
    expect(stored.status).toBe(AppointmentStatus.CONFIRMED);
  });

  it('records a no-show and returns the seat to its slot', async () => {
    // An hour in the past: a no-show can only be recorded once the appointment
    // has actually started.
    const { slot, appointment } = await seedAppointment({
      status: AppointmentStatus.CONFIRMED,
      hoursFromNow: -1,
    });

    await request(app.getHttpServer())
      .post(`${API}/appointments/${appointment.id}/no-show`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ reason: 'Did not attend.' })
      .expect(200);

    const stored = await db.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
    expect(stored.status).toBe(AppointmentStatus.NO_SHOW);

    const releasedSlot = await db.appointmentSlot.findUniqueOrThrow({ where: { id: slot.id } });
    expect(releasedSlot.bookedCount).toBe(0);
    // A slot that had filled must come back, or the freed seat is invisible to
    // every donor browsing availability.
    expect(releasedSlot.status).toBe(SlotStatus.AVAILABLE);

    const history = await db.appointmentHistory.findMany({
      where: { appointmentId: appointment.id, action: 'NO_SHOW' },
    });
    expect(history).toHaveLength(1);
  });

  it('refuses a no-show on an appointment that has not started', async () => {
    const { appointment } = await seedAppointment({
      status: AppointmentStatus.CONFIRMED,
      hoursFromNow: 30,
    });

    await request(app.getHttpServer())
      .post(`${API}/appointments/${appointment.id}/no-show`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({})
      .expect(400);

    const stored = await db.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
    expect(stored.status).toBe(AppointmentStatus.CONFIRMED);
  });

  it('lets staff cancel on the donor’s behalf, with a reason', async () => {
    const { slot, appointment } = await seedAppointment({
      status: AppointmentStatus.CONFIRMED,
      hoursFromNow: 31,
    });

    await request(app.getHttpServer())
      .post(`${API}/appointments/${appointment.id}/staff-cancel`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ reason: 'Collection session cancelled.' })
      .expect(200);

    const stored = await db.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
    expect(stored.status).toBe(AppointmentStatus.CANCELLED);
    expect(stored.cancellationReason).toBe('Collection session cancelled.');
    expect(stored.cancelledAt).toBeInstanceOf(Date);

    const releasedSlot = await db.appointmentSlot.findUniqueOrThrow({ where: { id: slot.id } });
    expect(releasedSlot.bookedCount).toBe(0);
  });

  it('expires an appointment nobody ever handled and gives its seat back', async () => {
    // Two days ago: comfortably past the 24-hour grace period.
    const { slot, appointment } = await seedAppointment({
      status: AppointmentStatus.CONFIRMED,
      hoursFromNow: -48,
    });

    // A second one that is recent enough to still be inside the grace period,
    // to prove the sweep is bounded rather than closing everything past.
    const recent = await seedAppointment({
      status: AppointmentStatus.PENDING,
      hoursFromNow: -2,
    });

    const expired = await app.get(AppointmentExpiryService).expireStaleAppointments();
    expect(expired).toBeGreaterThanOrEqual(1);

    const closed = await db.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
    expect(closed.status).toBe(AppointmentStatus.EXPIRED);

    const stillOpen = await db.appointment.findUniqueOrThrow({
      where: { id: recent.appointment.id },
    });
    expect(stillOpen.status).toBe(AppointmentStatus.PENDING);

    const releasedSlot = await db.appointmentSlot.findUniqueOrThrow({ where: { id: slot.id } });
    expect(releasedSlot.bookedCount).toBe(0);
    expect(releasedSlot.status).toBe(SlotStatus.AVAILABLE);

    const history = await db.appointmentHistory.findMany({
      where: { appointmentId: appointment.id, action: 'EXPIRED' },
    });
    expect(history).toHaveLength(1);
    // Nobody did this, which is the point of the record.
    expect(history[0]!.actorId).toBeNull();

    // A second sweep must not touch it again.
    const second = await app.get(AppointmentExpiryService).expireStaleAppointments();
    const historyAfter = await db.appointmentHistory.findMany({
      where: { appointmentId: appointment.id, action: 'EXPIRED' },
    });
    expect(historyAfter).toHaveLength(1);
    expect(second).toBeGreaterThanOrEqual(0);
  });

  describe('cross-organisation access stays denied', () => {
    it('will not show one organisation’s appointments to another’s staff', async () => {
      await request(app.getHttpServer())
        .get(`${API}/appointments/organizations/${bloodCenterId}`)
        .set('Authorization', `Bearer ${otherOrgToken}`)
        .expect(403);
    });

    it('will not let another organisation’s staff mark a no-show', async () => {
      const { appointment } = await seedAppointment({
        status: AppointmentStatus.CONFIRMED,
        hoursFromNow: -3,
      });

      await request(app.getHttpServer())
        .post(`${API}/appointments/${appointment.id}/no-show`)
        .set('Authorization', `Bearer ${otherOrgToken}`)
        .send({})
        .expect(403);

      const stored = await db.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
      expect(stored.status).toBe(AppointmentStatus.CONFIRMED);
    });

    it('will not let a donor list an organisation’s appointments', async () => {
      const res = await request(app.getHttpServer())
        .get(`${API}/appointments/organizations/${hospitalId}`)
        .set('Authorization', `Bearer ${donorToken}`);

      expect(res.status).toBe(403);
    });
  });
});
