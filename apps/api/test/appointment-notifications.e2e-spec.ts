import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { PrismaService } from './../src/database/prisma.service';
import { AppointmentReminderService } from './../src/modules/appointments/appointment-reminder.service';
import { API, SEEDED, createTestApp, seededOrganizations, tokenFor, waitFor } from './utils/e2e';

/**
 * The appointment notification lifecycle, end to end against a real database.
 *
 * Three handlers for appointment.created, appointment.reminder and
 * appointment.cancelled had been sitting in the notifications module with
 * nothing emitting any of them, so a donor booked an appointment and the
 * platform said nothing at all -- then the day came with no reminder. What
 * this suite asserts is the persisted record, not a mocked emit: the row a
 * donor's notification list actually reads from.
 */
describe('Appointment notifications (e2e)', () => {
  let app: INestApplication;
  let db: PrismaService;
  let reminders: AppointmentReminderService;

  let donorToken: string;
  let staffToken: string;
  let donorUserId: string;
  let bloodCenterId: string;

  let slotId: string;
  let appointmentId: string;

  const notificationsFor = (action: string) =>
    db.notification.findMany({
      where: { recipientId: donorUserId, sourceType: 'APPOINTMENT', sourceId: appointmentId },
    }).then((rows) => rows.filter((r) => (r.data as { action?: string } | null)?.action === action));

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(PrismaService);
    reminders = app.get(AppointmentReminderService);

    const orgs = await seededOrganizations(app);
    bloodCenterId = orgs.bloodCenter.id;

    donorToken = await tokenFor(app, SEEDED.donor);
    staffToken = await tokenFor(app, SEEDED.bloodCenterStaff);

    const donor = await db.user.findUniqueOrThrow({ where: { email: SEEDED.donor } });
    donorUserId = donor.id;
  });

  afterAll(async () => {
    if (appointmentId) {
      await db.notification.deleteMany({ where: { sourceType: 'APPOINTMENT', sourceId: appointmentId } });
      await db.appointment.deleteMany({ where: { id: appointmentId } });
    }
    if (slotId) {
      await db.appointmentSlot.deleteMany({ where: { id: slotId } });
    }
    await app.close();
  });

  describe('1. Booking tells the donor, in writing', () => {
    it('creates the slot and books it', async () => {
      // Two hours out: a consultation, so no donation recovery window applies,
      // and inside the default 24-hour reminder lead time.
      const startAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const endAt = new Date(startAt.getTime() + 30 * 60 * 1000);

      const slot = await request(app.getHttpServer())
        .post(`${API}/appointments/organizations/${bloodCenterId}/slots`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          appointmentType: 'CONSULTATION',
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          capacity: 1,
        })
        .expect(201);
      slotId = slot.body.data?.id ?? slot.body.id;

      const booked = await request(app.getHttpServer())
        .post(`${API}/appointments`)
        .set('Authorization', `Bearer ${donorToken}`)
        .send({ slotId, appointmentType: 'CONSULTATION' })
        .expect(201);

      appointmentId = booked.body.data?.id ?? booked.body.id;
      expect(appointmentId).toBeDefined();
    });

    it('persists a booking notification the donor can read back', async () => {
      const [created] = await waitFor(
        async () => {
          const rows = await notificationsFor('created');
          return rows.length > 0 ? rows : null;
        },
        { what: 'the appointment.created notification' },
      );

      expect(created.type).toBe('APPOINTMENT');
      expect(created.title).toBe('Appointment Booked');
      expect(created.deepLink).toBe(`/(app)/appointment/${appointmentId}`);
    });
  });

  describe('2. The reminder job runs once per appointment, whatever happens to the process', () => {
    it('sends the reminder for an appointment inside the lead window', async () => {
      const sent = await reminders.sendDueReminders();
      expect(sent).toBeGreaterThan(0);

      const [reminder] = await waitFor(
        async () => {
          const rows = await notificationsFor('reminder');
          return rows.length > 0 ? rows : null;
        },
        { what: 'the appointment.reminder notification' },
      );

      expect(reminder.title).toBe('Appointment Reminder');
      expect(reminder.priority).toBe('HIGH');
    });

    it('records on the appointment that it has been reminded', async () => {
      const appointment = await db.appointment.findUniqueOrThrow({ where: { id: appointmentId } });

      expect(appointment.reminderSentAt).toBeInstanceOf(Date);
    });

    it('a second run sends this donor nothing more — the claim is already taken', async () => {
      const before = await notificationsFor('reminder');

      await reminders.sendDueReminders();
      await reminders.sendDueReminders();

      const after = await notificationsFor('reminder');
      expect(after).toHaveLength(before.length);
      expect(after).toHaveLength(1);
    });
  });

  describe('3. The donor can actually read their inbox', () => {
    it('returns the appointment notifications through the paginated route', async () => {
      // `?limit=N` used to answer 500: the filter was a TypeScript interface,
      // which the ValidationPipe cannot transform, so `take: limit + 1` on the
      // string "5" asked Prisma for "51" rows. Persisting a notification the
      // donor's app cannot list is not a notification.
      const res = await request(app.getHttpServer())
        .get(`${API}/notifications?limit=5`)
        .set('Authorization', `Bearer ${donorToken}`)
        .expect(200);

      const items = res.body.data?.items ?? res.body.items ?? [];
      expect(items.some((n: { sourceId: string }) => n.sourceId === appointmentId)).toBe(true);
    });

    it('narrows to one appointment when asked, instead of the whole inbox', async () => {
      const res = await request(app.getHttpServer())
        .get(`${API}/notifications?sourceType=APPOINTMENT&sourceId=${appointmentId}&limit=20`)
        .set('Authorization', `Bearer ${donorToken}`)
        .expect(200);

      const items = res.body.data?.items ?? res.body.items ?? [];
      expect(items.length).toBeGreaterThan(0);
      expect(items.every((n: { sourceId: string }) => n.sourceId === appointmentId)).toBe(true);
    });

    it('refuses a page size that is not a number rather than failing later', async () => {
      await request(app.getHttpServer())
        .get(`${API}/notifications?limit=all`)
        .set('Authorization', `Bearer ${donorToken}`)
        .expect(400);
    });
  });

  describe('4. Cancelling tells the donor too', () => {
    it('persists a cancellation notification', async () => {
      await request(app.getHttpServer())
        .post(`${API}/appointments/${appointmentId}/cancel`)
        .set('Authorization', `Bearer ${donorToken}`)
        .send({ reason: 'e2e cancellation' })
        .expect(200);

      const [cancelled] = await waitFor(
        async () => {
          const rows = await notificationsFor('cancelled');
          return rows.length > 0 ? rows : null;
        },
        { what: 'the appointment.cancelled notification' },
      );

      expect(cancelled.title).toBe('Appointment Cancelled');
    });

    it('does not remind a donor about an appointment that is no longer happening', async () => {
      // Reset the claim so the only thing keeping this appointment out of the
      // job's query is its CANCELLED status.
      await db.appointment.update({
        where: { id: appointmentId },
        data: { reminderSentAt: null },
      });

      await reminders.sendDueReminders();

      const appointment = await db.appointment.findUniqueOrThrow({ where: { id: appointmentId } });
      expect(appointment.reminderSentAt).toBeNull();
      expect(await notificationsFor('reminder')).toHaveLength(1);
    });
  });
});
