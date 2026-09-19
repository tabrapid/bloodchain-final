import { INestApplication } from '@nestjs/common';
import { BloodRequestStatus, BloodType, RhFactor } from '@prisma/client';
import request from 'supertest';

import { PrismaService } from '../src/database/prisma.service';
import { API, SEEDED, createTestApp, seededOrganizations, tokenFor, waitFor } from './utils/e2e';

/**
 * S4-6: a blood centre can decline a request, and the hospital finds out.
 *
 * `approve` was the only route that could reach REJECTED, and only as a side
 * effect of approving every item for zero units. So refusing a request meant
 * recording that it had been reviewed and approved for nothing: no reason, no
 * named actor, no rejection timestamp, and no notification -- the hospital was
 * left watching a request that would never move.
 */
describe('a declined blood request is recorded as declined and reaches the hospital', () => {
  let app: INestApplication;
  let db: PrismaService;
  let centreToken: string;
  let hospitalToken: string;
  let hospitalId: string;
  let bloodCenterId: string;
  const createdRequestIds: string[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(PrismaService);
    centreToken = await tokenFor(app, SEEDED.bloodCenterAdmin);
    hospitalToken = await tokenFor(app, SEEDED.hospitalAdmin);

    const { hospital, bloodCenter } = await seededOrganizations(app);
    hospitalId = hospital.id;
    bloodCenterId = bloodCenter.id;
  });

  afterAll(async () => {
    await db.bloodRequestEvent.deleteMany({
      where: { bloodRequestId: { in: createdRequestIds } },
    });
    await db.bloodRequestItem.deleteMany({
      where: { bloodRequestId: { in: createdRequestIds } },
    });
    await db.bloodRequest.deleteMany({ where: { id: { in: createdRequestIds } } });
    await db.notification.deleteMany({
      where: { sourceType: 'BLOOD_REQUEST', sourceId: { in: createdRequestIds } },
    });
    await app.close();
  });

  /** A submitted request from the seeded hospital, as its own staff raise one. */
  async function submitRequest() {
    const res = await request(app.getHttpServer())
      .post(`${API}/organizations/${hospitalId}/blood-requests`)
      .set('Authorization', `Bearer ${hospitalToken}`)
      .send({
        priority: 'ROUTINE',
        notes: 'Rejection path e2e fixture',
        items: [
          {
            bloodType: BloodType.O,
            rhFactor: RhFactor.NEGATIVE,
            componentType: 'WHOLE_BLOOD',
            unitsRequested: 2,
          },
        ],
      })
      .expect(201);

    const created = res.body.data;
    createdRequestIds.push(created.id as string);
    return created as { id: string; requestReference: string; status: string };
  }

  it('records the reason, the actor and the time, and leaves the request in place', async () => {
    const created = await submitRequest();
    expect(created.status).toBe(BloodRequestStatus.SUBMITTED);

    const reason = 'No O- stock until the next collection drive on Friday.';
    const res = await request(app.getHttpServer())
      .post(`${API}/organizations/${bloodCenterId}/blood-requests/${created.id}/reject`)
      .set('Authorization', `Bearer ${centreToken}`)
      .send({ reason })
      .expect(201);

    expect(res.body.data.status).toBe(BloodRequestStatus.REJECTED);

    const stored = await db.bloodRequest.findUniqueOrThrow({
      where: { id: created.id },
      include: { items: true },
    });

    // Not deleted -- the hospital keeps its record of what it asked for.
    expect(stored.status).toBe(BloodRequestStatus.REJECTED);
    expect(stored.rejectionReason).toBe(reason);
    expect(stored.rejectedAt).toBeInstanceOf(Date);
    expect(stored.rejectedById).not.toBeNull();
    expect(stored.fulfillingOrganizationId).toBe(bloodCenterId);
    expect(stored.items.every((item) => item.unitsApproved === 0)).toBe(true);
    // Rejection is not cancellation; the hospital's own withdrawal fields stay
    // untouched so the two remain distinguishable in the record.
    expect(stored.cancelledAt).toBeNull();
    expect(stored.cancellationReason).toBeNull();

    const events = await db.bloodRequestEvent.findMany({
      where: { bloodRequestId: created.id, eventType: 'REJECTED' },
    });
    expect(events).toHaveLength(1);
    expect((events[0]!.metadata as { reason?: string })?.reason).toBe(reason);

    const audits = await db.auditLog.findMany({
      where: { action: 'BLOOD_REQUEST_REJECTED', entityId: created.id },
    });
    expect(audits.length).toBeGreaterThanOrEqual(1);
  });

  it('tells the requesting hospital, exactly once', async () => {
    const created = await submitRequest();

    await request(app.getHttpServer())
      .post(`${API}/organizations/${bloodCenterId}/blood-requests/${created.id}/reject`)
      .set('Authorization', `Bearer ${centreToken}`)
      .send({ reason: 'Component not held at this centre.' })
      .expect(201);

    // The notification is raised by an event handler the request does not
    // await, so this polls rather than asserting on timing.
    const notifications = await waitFor(
      async () => {
        const rows = await db.notification.findMany({
          where: { sourceType: 'BLOOD_REQUEST', sourceId: created.id },
        });
        return rows.length > 0 ? rows : null;
      },
      { what: 'the hospital to be notified of the rejection' },
    );

    const hospitalStaff = await db.organizationMembership.findMany({
      where: { organizationId: hospitalId, status: 'ACTIVE' },
      select: { userId: true },
    });
    const staffIds = new Set(hospitalStaff.map((m) => m.userId));

    expect(notifications.length).toBeGreaterThan(0);
    // Everyone notified works at the hospital that asked, not the centre.
    for (const notification of notifications) {
      expect(staffIds.has(notification.recipientId)).toBe(true);
      expect(notification.type).toBe('BLOOD_REQUEST');
      expect(notification.body).toContain('Component not held at this centre.');
    }

    // One per recipient: the idempotency key is the request id, so a retry of
    // the delivery cannot double up.
    const perRecipient = new Map<string, number>();
    for (const notification of notifications) {
      perRecipient.set(
        notification.recipientId,
        (perRecipient.get(notification.recipientId) ?? 0) + 1,
      );
    }
    expect([...perRecipient.values()].every((count) => count === 1)).toBe(true);
  });

  it('refuses a rejection with no reason, and a second rejection', async () => {
    const created = await submitRequest();

    await request(app.getHttpServer())
      .post(`${API}/organizations/${bloodCenterId}/blood-requests/${created.id}/reject`)
      .set('Authorization', `Bearer ${centreToken}`)
      .send({ reason: '   ' })
      .expect(400);

    // Still open, because the refusal above did nothing.
    const untouched = await db.bloodRequest.findUniqueOrThrow({ where: { id: created.id } });
    expect(untouched.status).toBe(BloodRequestStatus.SUBMITTED);

    await request(app.getHttpServer())
      .post(`${API}/organizations/${bloodCenterId}/blood-requests/${created.id}/reject`)
      .set('Authorization', `Bearer ${centreToken}`)
      .send({ reason: 'Out of stock.' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`${API}/organizations/${bloodCenterId}/blood-requests/${created.id}/reject`)
      .set('Authorization', `Bearer ${centreToken}`)
      .send({ reason: 'Out of stock again.' })
      .expect(400);

    const stored = await db.bloodRequest.findUniqueOrThrow({ where: { id: created.id } });
    expect(stored.rejectionReason).toBe('Out of stock.');
  });

  it('will not let the requesting hospital reject its own request', async () => {
    const created = await submitRequest();

    // The hospital is not a blood centre, and the route is blood-centre only.
    const res = await request(app.getHttpServer())
      .post(`${API}/organizations/${hospitalId}/blood-requests/${created.id}/reject`)
      .set('Authorization', `Bearer ${hospitalToken}`)
      .send({ reason: 'Trying to decline our own request.' });

    expect(res.status).toBe(403);

    const stored = await db.bloodRequest.findUniqueOrThrow({ where: { id: created.id } });
    expect(stored.status).toBe(BloodRequestStatus.SUBMITTED);
  });
});
