import { INestApplication } from '@nestjs/common';
import { AppointmentType, SlotStatus } from '@prisma/client';
import request from 'supertest';

import { PrismaService } from '../src/database/prisma.service';
import { API, SEEDED, createTestApp, seededOrganizations, tokenFor } from './utils/e2e';

/**
 * S5-2: the donor's laboratory calendar asks one question, not twenty-one.
 *
 * `GET /laboratories/:id/slots` answers a single day, so the booking wizard's
 * date step could not draw a month grid without firing one request per visible
 * cell -- it showed a flat list of days instead, with no availability on it at
 * all, and the donor found out a day was closed only after picking it.
 *
 * `GET /laboratories/:id/available-dates` answers the whole window with just
 * the per-day summary the grid shades with. These tests walk the real route
 * against real slot rows, so they fail if the summary stops matching what the
 * slots route would say for the same day, if the range stops being bounded, or
 * if a malformed date stops being refused.
 */
describe('laboratory availability over a date range', () => {
  let app: INestApplication;
  let db: PrismaService;
  let donorToken: string;
  let organizationId: string;
  let testTypeId: string;
  let unofferedTestTypeId: string | null = null;
  const createdSlotIds: string[] = [];

  /** A calendar date `days` from today, in the server's own timezone. */
  function dateParam(days: number): string {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + days);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate(),
    ).padStart(2, '0')}`;
  }

  /** A bookable BLOOD_TEST slot `days` from today at 10:00 local. */
  async function openSlot(days: number, capacity = 1, bookedCount = 0) {
    const startAt = new Date();
    startAt.setHours(10, 0, 0, 0);
    startAt.setDate(startAt.getDate() + days);

    const slot = await db.appointmentSlot.create({
      data: {
        organizationId,
        appointmentType: AppointmentType.BLOOD_TEST,
        startAt,
        endAt: new Date(startAt.getTime() + 30 * 60 * 1000),
        capacity,
        bookedCount,
        status: bookedCount >= capacity ? SlotStatus.FULL : SlotStatus.AVAILABLE,
      },
    });
    createdSlotIds.push(slot.id);
    return slot;
  }

  /** Deliberately not `async`: the caller chains supertest's own `.expect()`. */
  function availableDates(query: Record<string, string>) {
    const params = new URLSearchParams(query);
    return request(app.getHttpServer())
      .get(`${API}/laboratories/${organizationId}/available-dates?${params.toString()}`)
      .set('Authorization', `Bearer ${donorToken}`);
  }

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(PrismaService);
    donorToken = await tokenFor(app, SEEDED.donor);

    const { bloodCenter } = await seededOrganizations(app);
    organizationId = bloodCenter.id;

    const profile = await db.laboratoryProfile.findFirstOrThrow({
      where: { organizationId },
      include: { testTypes: { where: { isActive: true } } },
    });
    testTypeId = profile.testTypes[0].id;

    const offeredIds = new Set(profile.testTypes.map((type) => type.id));
    const stranger = await db.testType.findFirst({
      where: { isActive: true, id: { notIn: Array.from(offeredIds) } },
    });
    unofferedTestTypeId = stranger?.id ?? null;
  });

  afterAll(async () => {
    await db.appointmentSlot.deleteMany({ where: { id: { in: createdSlotIds } } });
    await app.close();
  });

  it('returns one gap-free entry per day in the window, so the grid never guesses', async () => {
    const res = await availableDates({
      testTypeId,
      from: dateParam(1),
      to: dateParam(7),
    }).expect(200);

    const body = res.body.data as {
      from: string;
      to: string;
      dates: Array<{ date: string; totalSlots: number; availableSlots: number; isAvailable: boolean }>;
    };

    expect(body.from).toBe(dateParam(1));
    expect(body.to).toBe(dateParam(7));
    expect(body.dates).toHaveLength(7);
    expect(body.dates.map((day) => day.date)).toEqual(
      Array.from({ length: 7 }, (_, offset) => dateParam(offset + 1)),
    );

    // Only the summary the calendar shades with -- no slot rows, no capacities
    // per slot, nothing the grid would throw away.
    for (const day of body.dates) {
      expect(Object.keys(day).sort()).toEqual(
        ['availableSlots', 'date', 'isAvailable', 'totalSlots'].sort(),
      );
    }
  });

  it('agrees with the slots route it replaces, for the same day', async () => {
    const day = 9;
    await openSlot(day);
    await openSlot(day);

    const summary = await availableDates({
      testTypeId,
      from: dateParam(day),
      to: dateParam(day),
    }).expect(200);

    const bucket = (summary.body.data.dates as Array<{ date: string; availableSlots: number }>).find(
      (entry) => entry.date === dateParam(day),
    );

    const slots = await request(app.getHttpServer())
      .get(`${API}/laboratories/${organizationId}/slots?testTypeId=${testTypeId}&date=${dateParam(day)}`)
      .set('Authorization', `Bearer ${donorToken}`)
      .expect(200);

    const bookable = (slots.body.data as Array<{ isAvailable: boolean; startAt: string }>).filter(
      (slot) => slot.isAvailable && new Date(slot.startAt) > new Date(),
    );

    expect(bucket?.availableSlots).toBe(bookable.length);
    expect(bucket?.availableSlots).toBeGreaterThanOrEqual(2);
  });

  it('does not count a slot that is already full', async () => {
    const day = 11;
    await openSlot(day, 1, 1);

    const res = await availableDates({
      testTypeId,
      from: dateParam(day),
      to: dateParam(day),
    }).expect(200);

    const bucket = (
      res.body.data.dates as Array<{
        date: string;
        totalSlots: number;
        availableSlots: number;
        isAvailable: boolean;
      }>
    ).find((entry) => entry.date === dateParam(day));

    // The day exists and is visibly staffed; it just cannot be booked. The
    // calendar needs both facts to explain itself.
    expect(bucket?.totalSlots).toBeGreaterThanOrEqual(1);
    expect(bucket?.availableSlots).toBe(0);
    expect(bucket?.isAvailable).toBe(false);
  });

  it('refuses a window wider than the calendar can ask for', async () => {
    const res = await availableDates({ testTypeId, from: dateParam(0), to: dateParam(120) });

    expect(res.status).toBe(400);
    expect(String(res.body.message)).toMatch(/at most/i);
  });

  it('refuses a range that ends before it starts', async () => {
    const res = await availableDates({ testTypeId, from: dateParam(10), to: dateParam(3) });
    expect(res.status).toBe(400);
  });

  it('refuses a malformed or impossible date instead of silently rolling it over', async () => {
    await availableDates({ testTypeId, from: '19-09-2026', to: dateParam(3) }).expect(400);
    await availableDates({ testTypeId, from: dateParam(1), to: '2026-02-30' }).expect(400);
  });

  it('refuses a panel this laboratory does not run, matching the booking rule', async () => {
    if (!unofferedTestTypeId) {
      // Every active test type is on this laboratory's profile, so there is no
      // negative case to construct. Asserting nothing is better than asserting
      // against a fabricated one.
      return;
    }

    const res = await availableDates({
      testTypeId: unofferedTestTypeId,
      from: dateParam(1),
      to: dateParam(7),
    });

    expect(res.status).toBe(400);
    expect(String(res.body.message)).toMatch(/does not offer/i);
  });

  it('requires authentication', async () => {
    await request(app.getHttpServer())
      .get(`${API}/laboratories/${organizationId}/available-dates?testTypeId=${testTypeId}&from=${dateParam(1)}&to=${dateParam(2)}`)
      .expect(401);
  });
});
