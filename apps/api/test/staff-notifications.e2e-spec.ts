import { INestApplication } from '@nestjs/common';
import { AlertType, BloodType, RhFactor } from '@prisma/client';
import request from 'supertest';

import { InventoryService } from '../src/modules/inventory/inventory.service';
import { PrismaService } from '../src/database/prisma.service';
import { API, SEEDED, createTestApp, seededOrganizations, tokenFor, waitFor } from './utils/e2e';

/**
 * S4-2 and S4-3: the inbox staff can now read, and the events that fill it.
 *
 * `Topbar` rendered a notification bell only when given an `onNotifications`
 * handler and no portal passed one, so the inbox existed in the API and no
 * console read it. At the same time `inventory.alert` and `security.event` had
 * handlers in the notification module and nothing anywhere emitted them -- so
 * a blood centre was never told a unit had expired, and a donor was never told
 * their password had changed.
 */
describe('staff notifications reach the people who have to act on them', () => {
  let app: INestApplication;
  let db: PrismaService;
  let staffToken: string;
  let donorToken: string;
  let bloodCenterId: string;
  const createdAlertIds: string[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(PrismaService);
    staffToken = await tokenFor(app, SEEDED.bloodCenterAdmin);
    donorToken = await tokenFor(app, SEEDED.donor);

    const { bloodCenter } = await seededOrganizations(app);
    bloodCenterId = bloodCenter.id;
  });

  afterAll(async () => {
    await db.notification.deleteMany({
      where: { sourceType: 'INVENTORY', sourceId: { in: createdAlertIds } },
    });
    await db.inventoryAlert.deleteMany({ where: { id: { in: createdAlertIds } } });
    await app.close();
  });

  it('serves the inbox and an unread count the bell can badge', async () => {
    const list = await request(app.getHttpServer())
      .get(`${API}/notifications?limit=5`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    // The cursor envelope the shared client unwraps: `{ data: { items, nextCursor } }`.
    expect(Array.isArray(list.body.data.items)).toBe(true);
    expect(list.body.data).toHaveProperty('nextCursor');

    const count = await request(app.getHttpServer())
      .get(`${API}/notifications/unread-count`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    expect(typeof count.body.data.count).toBe('number');
  });

  it('raises an inventory alert to this organisation’s staff, and only once', async () => {
    const inventory = app.get(InventoryService);

    // A brand-new alert is what staff have not heard about yet. The same call
    // repeated refreshes the open alert instead of raising a second one --
    // which is what stops the hourly maintenance cron announcing the same
    // shortage twenty-four times a day.
    const alert = await inventory.ensureAlert(
      bloodCenterId,
      AlertType.LOW_STOCK,
      'Low stock: only 1 unit(s) of AB- available.',
      BloodType.AB,
      RhFactor.NEGATIVE,
      1,
      5,
    );
    createdAlertIds.push(alert.id);

    const members = await db.organizationMembership.findMany({
      where: { organizationId: bloodCenterId, status: 'ACTIVE' },
      select: { userId: true },
    });
    const memberIds = new Set(members.map((m) => m.userId));

    // Wait for the whole fan-out, not the first row: the handler writes one
    // notification per active member, and sampling part-way through would make
    // the duplicate check below compare against a half-finished count.
    const notifications = await waitFor(
      async () => {
        const rows = await db.notification.findMany({
          where: { sourceType: 'INVENTORY', sourceId: alert.id },
        });
        return rows.length >= memberIds.size ? rows : null;
      },
      { what: 'the inventory alert to reach every member of staff' },
    );

    expect(notifications.length).toBeGreaterThan(0);
    for (const notification of notifications) {
      // The organisation that has to act on it, nobody else.
      expect(memberIds.has(notification.recipientId)).toBe(true);
      expect(notification.type).toBe('INVENTORY');
      // The alert type the domain actually raised, not "low stock" for
      // everything -- an expiring batch and a shortage call for different work.
      expect(notification.title).toBe('Low stock');
      expect(notification.body).toContain('AB-');
    }

    const before = notifications.length;
    expect(before).toBe(memberIds.size);

    await inventory.ensureAlert(
      bloodCenterId,
      AlertType.LOW_STOCK,
      'Low stock: only 1 unit(s) of AB- available.',
      BloodType.AB,
      RhFactor.NEGATIVE,
      1,
      5,
    );

    // Give any duplicate a chance to appear before asserting it did not.
    await new Promise((resolve) => setTimeout(resolve, 250));

    const after = await db.notification.count({
      where: { sourceType: 'INVENTORY', sourceId: alert.id },
    });
    expect(after).toBe(before);
  });

  it('marks a notification read, and the unread count follows', async () => {
    const recipient = await db.user.findUniqueOrThrow({
      where: { email: SEEDED.bloodCenterAdmin },
    });

    const unreadBefore = await request(app.getHttpServer())
      .get(`${API}/notifications/unread-count`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    const unread = await db.notification.findFirst({
      where: { recipientId: recipient.id, readAt: null, status: { not: 'ARCHIVED' } },
    });

    if (!unread) {
      // Nothing unread to act on; asserting anyway would be asserting the seed.
      expect(unreadBefore.body.data.count).toBe(0);
      return;
    }

    await request(app.getHttpServer())
      .patch(`${API}/notifications/${unread.id}/read`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    const stored = await db.notification.findUniqueOrThrow({ where: { id: unread.id } });
    expect(stored.readAt).not.toBeNull();

    const unreadAfter = await request(app.getHttpServer())
      .get(`${API}/notifications/unread-count`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    expect(unreadAfter.body.data.count).toBe(unreadBefore.body.data.count - 1);
  });

  it('will not let one account read or act on another’s notifications', async () => {
    const staffUser = await db.user.findUniqueOrThrow({
      where: { email: SEEDED.bloodCenterAdmin },
    });

    const theirs = await db.notification.findFirst({
      where: { recipientId: staffUser.id },
    });

    if (!theirs) return;

    // The donor is a different account entirely.
    const read = await request(app.getHttpServer())
      .get(`${API}/notifications/${theirs.id}`)
      .set('Authorization', `Bearer ${donorToken}`);
    expect(read.status).toBeGreaterThanOrEqual(400);

    const act = await request(app.getHttpServer())
      .patch(`${API}/notifications/${theirs.id}/read`)
      .set('Authorization', `Bearer ${donorToken}`);
    expect(act.status).toBeGreaterThanOrEqual(400);
  });
});
