import { INestApplication } from '@nestjs/common';
import { AppointmentStatus, AppointmentType, SlotStatus } from '@prisma/client';
import request from 'supertest';

import { PrismaService } from '../src/database/prisma.service';
import { API, SEEDED, createTestApp, seededOrganizations, tokenFor } from './utils/e2e';

/**
 * P3-14 regression tests.
 *
 * Four routes declared their request bodies as inline anonymous types
 * (`@Body() dto: { ... }`). NestJS's ValidationPipe skips validation entirely
 * when the resolved metatype is a native type, and an inline object type
 * resolves to `Object` — so these routes ran with the app's global
 * `whitelist` / `forbidNonWhitelisted` / `transform` policy simply not applied,
 * and Swagger documented no request body for any of them.
 *
 * The worst of the four is the lab-result route: it accepts clinical data, and
 * malformed input didn't produce a 400, it produced a 500 — a `TypeError` on
 * `dto.items.map` for a missing array, a Prisma enum error for a bogus `flag`
 * (which the controller cast away with `as any`), or a thrown Decimal
 * constructor for a non-numeric value, in one case part-way through the
 * transaction that writes the result.
 *
 * Each test below asserts the post-fix 400. The comment on each says what the
 * route did before, which is what makes them regression tests rather than
 * restatements of the DTO.
 */
describe('P3-14: routes with previously-inline request bodies validate their input', () => {
  let app: INestApplication;
  let db: PrismaService;
  let staffToken: string;
  let donorToken: string;
  let organizationId: string;
  let appointmentId: string;
  let slotId: string;
  let testTypeId: string;
  let parameterId: string;

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(PrismaService);
    staffToken = await tokenFor(app, SEEDED.bloodCenterAdmin);
    donorToken = await tokenFor(app, SEEDED.donor);

    const { bloodCenter } = await seededOrganizations(app);
    organizationId = bloodCenter.id;

    const testType = await db.testType.findFirstOrThrow({
      where: { parameters: { some: {} } },
      include: { parameters: true },
    });
    testTypeId = testType.id;
    parameterId = testType.parameters[0].id;

    const donor = await db.user.findUniqueOrThrow({ where: { email: SEEDED.donor } });

    // An appointment awaiting results is the only state createResult accepts.
    const slot = await db.appointmentSlot.create({
      data: {
        organizationId,
        appointmentType: AppointmentType.BLOOD_TEST,
        startAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
        endAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        capacity: 1,
        bookedCount: 1,
        status: SlotStatus.FULL,
      },
    });
    slotId = slot.id;

    const appointment = await db.appointment.create({
      data: {
        referenceNumber: `P314-${Date.now()}`,
        donorId: donor.id,
        organizationId,
        slotId: slot.id,
        appointmentType: AppointmentType.BLOOD_TEST,
        status: AppointmentStatus.RESULT_PENDING,
        scheduledStart: slot.startAt,
        scheduledEnd: slot.endAt,
      },
    });
    appointmentId = appointment.id;
  });

  afterAll(async () => {
    // Appointment and LaboratoryResult both cascade from the slot.
    await db.appointmentSlot.delete({ where: { id: slotId } });
    await app.close();
  });

  const postResult = (body: unknown) =>
    request(app.getHttpServer())
      .post(`${API}/organizations/${organizationId}/laboratory-results`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send(body as object);

  describe('POST /organizations/:organizationId/laboratory-results', () => {
    it('rejects a body with no items array (previously a 500 TypeError on dto.items.map)', async () => {
      const res = await postResult({ appointmentId, testTypeId });

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toContain('items');
    });

    // Pre-fix this was accepted with a 201: a published-track lab result row
    // was created carrying no measurements at all.
    it('rejects an empty items array', async () => {
      const res = await postResult({ appointmentId, testTypeId, items: [] });

      expect(res.status).toBe(400);
    });

    it('rejects a flag outside the ResultFlag enum (previously cast with `as any` into Prisma)', async () => {
      const res = await postResult({
        appointmentId,
        testTypeId,
        items: [{ parameterId, value: '13.4', flag: 'DEFINITELY_FINE' }],
      });

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toContain('flag');
    });

    it('rejects a non-numeric numericValue (previously threw in the Decimal constructor)', async () => {
      const res = await postResult({
        appointmentId,
        testTypeId,
        items: [{ parameterId, value: 'thirteen', numericValue: 'thirteen' }],
      });

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toContain('numericValue');
    });

    it('rejects an unknown property inside a nested item', async () => {
      const res = await postResult({
        appointmentId,
        testTypeId,
        items: [{ parameterId, value: '13.4', override: true }],
      });

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toContain('override');
    });

    it('accepts a valid body and stores a numericValue of 0 as 0, not null', async () => {
      const res = await postResult({
        appointmentId,
        testTypeId,
        items: [{ parameterId, value: '0', numericValue: 0, unit: 'g/dL', flag: 'NORMAL' }],
      });

      expect(res.status).toBe(201);

      const item = await db.laboratoryResultItem.findFirstOrThrow({
        where: { result: { appointmentId } },
      });

      // A truthiness check on the incoming plain number used to turn a
      // legitimate result of 0 — an undetectable marker, a zero count — into a
      // stored null, losing the measurement outright.
      expect(item.numericValue).not.toBeNull();
      expect(Number(item.numericValue)).toBe(0);
    });
  });

  describe('POST /laboratory-appointments', () => {
    it('rejects an empty body (previously reached Prisma with undefined ids and 500ed)', async () => {
      const res = await request(app.getHttpServer())
        .post(`${API}/laboratory-appointments`)
        .set('Authorization', `Bearer ${donorToken}`)
        .send({});

      expect(res.status).toBe(400);
      const body = JSON.stringify(res.body);
      expect(body).toContain('laboratoryId');
      expect(body).toContain('testTypeId');
      expect(body).toContain('slotId');
    });
  });

  describe('POST /me/laboratory-appointments/:appointmentId/cancel', () => {
    it('rejects an unknown property', async () => {
      const res = await request(app.getHttpServer())
        .post(`${API}/me/laboratory-appointments/${appointmentId}/cancel`)
        .set('Authorization', `Bearer ${donorToken}`)
        .send({ reason: 'Feeling unwell', force: true });

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toContain('force');
    });
  });

  describe('POST /organizations/:organizationId/shipments/:shipmentId/assign', () => {
    it('rejects a body with no courierId before the handler runs', async () => {
      // A shipment id that does not exist. Pre-fix this body reached the
      // handler unvalidated and the request came back 500 (measured), because
      // `courierId` arrived as undefined. Post-fix the pipe rejects it before
      // the handler runs, so the 400 is the proof.
      const res = await request(app.getHttpServer())
        .post(`${API}/organizations/${organizationId}/shipments/does-not-exist/assign`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toContain('courierId');
    });
  });
});
