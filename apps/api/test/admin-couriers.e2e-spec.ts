import { INestApplication } from '@nestjs/common';
import { CourierStatus } from '@prisma/client';
import request from 'supertest';

import { PrismaService } from '../src/database/prisma.service';
import { API, SEEDED, createTestApp, seededOrganizations, tokenFor } from './utils/e2e';

/**
 * P3-7 regression test.
 *
 * `POST /admin/couriers/:id/suspend` declared its request body as an inline
 * anonymous type — `@Body() body: { reason?: string }`. NestJS's ValidationPipe
 * skips validation outright when the resolved metatype is a native type
 * (`Object` is on its skip list), so this route ran with **no** validation at
 * all: the app's global `whitelist` / `forbidNonWhitelisted` policy simply did
 * not apply to it, and Swagger documented no request body for it either.
 *
 * The correctly-written `AdminSuspendCourierDto` for exactly this route already
 * existed three lines away in the DTO file, unreferenced — it was one of the
 * classes P3-7 set out to delete as "dead scaffolding". Wiring it in is the
 * real fix; these tests pin it.
 *
 * The unknown-property case is the load-bearing assertion: it is precisely what
 * the pre-fix route let through. Note that the DTO's `@IsString()` on `reason`
 * is deliberately *not* asserted here — the app configures the pipe with
 * `enableImplicitConversion: true`, so class-transformer stringifies almost any
 * scalar or object before `@IsString()` ever sees it (measured: a `{ ... }`
 * body for `reason` is accepted, not rejected). What this fix actually restores
 * on this route is the global whitelist / forbidNonWhitelisted policy, so that
 * is what these tests pin.
 */
describe('P3-7: admin courier suspend validates its request body', () => {
  let app: INestApplication;
  let db: PrismaService;
  let adminToken: string;
  let courierId: string;
  let courierUserId: string;

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(PrismaService);
    adminToken = await tokenFor(app, SEEDED.superAdmin);

    // Own fixture rather than the seeded courier: suspending mutates status,
    // and other suites borrow the seeded courier's status for shipment flows.
    const { bloodCenter } = await seededOrganizations(app);
    const user = await db.user.create({
      data: {
        email: `p37.courier.${Date.now()}@e2e.local`,
        passwordHash: 'not-a-real-hash',
        firstName: 'P37',
        lastName: 'Courier',
        emailVerified: true,
      },
    });
    courierUserId = user.id;

    const courier = await db.courier.create({
      data: {
        userId: user.id,
        organizationId: bloodCenter.id,
        displayName: 'P3-7 fixture courier',
        status: CourierStatus.OFFLINE,
      },
    });
    courierId = courier.id;
  });

  afterAll(async () => {
    // Courier cascades from User. The audit entries this suite produced are
    // deliberately NOT cleaned up: AuditLog is append-only in the database as
    // of Sprint 9, so this delete would now raise -- and the rows are harmless,
    // since `AuditLog.actorId` is SetNull on user deletion and nothing counts
    // audit rows for leak detection.
    await db.user.delete({ where: { id: courierUserId } });
    await app.close();
  });

  it('rejects an unknown property instead of silently ignoring it', async () => {
    const res = await request(app.getHttpServer())
      .post(`${API}/admin/couriers/${courierId}/suspend`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Vehicle failed inspection', status: 'ACTIVE' });

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain('status');

    // And the request had no effect — the courier is untouched.
    const courier = await db.courier.findUniqueOrThrow({ where: { id: courierId } });
    expect(courier.status).toBe(CourierStatus.OFFLINE);
  });

  it('accepts a valid body, suspends the courier and records the reason', async () => {
    const reason = 'Vehicle failed inspection';

    const res = await request(app.getHttpServer())
      .post(`${API}/admin/couriers/${courierId}/suspend`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ id: courierId, status: CourierStatus.SUSPENDED });

    const courier = await db.courier.findUniqueOrThrow({ where: { id: courierId } });
    expect(courier.status).toBe(CourierStatus.SUSPENDED);

    const log = await db.auditLog.findFirstOrThrow({
      where: { action: 'COURIER_SUSPENDED', entityId: courierId },
      orderBy: { createdAt: 'desc' },
    });
    expect(log.metadata).toMatchObject({ reason });
  });

  it('accepts an omitted reason (the field is genuinely optional)', async () => {
    await request(app.getHttpServer())
      .post(`${API}/admin/couriers/${courierId}/restore`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    const res = await request(app.getHttpServer())
      .post(`${API}/admin/couriers/${courierId}/suspend`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe(CourierStatus.SUSPENDED);
  });
});
