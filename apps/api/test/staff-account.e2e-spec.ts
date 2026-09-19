import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { PrismaService } from '../src/database/prisma.service';
import { API, SEEDED, createTestApp, tokenFor } from './utils/e2e';

/**
 * S4-10: staff can change their own password from the console.
 *
 * Every portal's Settings entry was disabled or held only platform
 * configuration, so a member of staff who wanted a new password had to use the
 * forgotten-password flow on a password they had not forgotten -- which needs a
 * mailbox they may not read. The portals now call the same
 * `POST /auth/change-password` the mobile app calls; there is one password
 * system, and these tests are against that endpoint's real behaviour.
 */
describe('staff can change their own password', () => {
  let app: INestApplication;
  let db: PrismaService;
  let staffToken: string;
  let staffId: string;
  let originalHash: string;

  // The seed's own password for the demo accounts.
  const CURRENT = 'DevelopmentOnly!123';
  const NEXT = 'RotatedInATest!2026';

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(PrismaService);
    staffToken = await tokenFor(app, SEEDED.bloodCenterStaff);

    const staff = await db.user.findUniqueOrThrow({ where: { email: SEEDED.bloodCenterStaff } });
    staffId = staff.id;
    originalHash = staff.passwordHash;
  });

  afterAll(async () => {
    // Put the seeded credential back, byte for byte: the demo accounts are
    // shared and `pnpm demo:check` signs in with the documented password.
    await db.user.update({ where: { id: staffId }, data: { passwordHash: originalHash } });
    await app.close();
  });

  it('refuses a change that gets the current password wrong', async () => {
    await request(app.getHttpServer())
      .post(`${API}/auth/change-password`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ currentPassword: 'NotTheRightOne!123', newPassword: NEXT })
      .expect(401);

    const unchanged = await db.user.findUniqueOrThrow({ where: { id: staffId } });
    expect(unchanged.passwordHash).toBe(originalHash);
  });

  it('refuses a new password that fails the shared policy', async () => {
    await request(app.getHttpServer())
      .post(`${API}/auth/change-password`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ currentPassword: CURRENT, newPassword: 'short' })
      .expect(400);

    const unchanged = await db.user.findUniqueOrThrow({ where: { id: staffId } });
    expect(unchanged.passwordHash).toBe(originalHash);
  });

  it('changes the password and signs every other device out', async () => {
    const before = await db.refreshToken.count({
      where: { userId: staffId, revokedAt: null },
    });

    await request(app.getHttpServer())
      .post(`${API}/auth/change-password`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ currentPassword: CURRENT, newPassword: NEXT })
      .expect(200);

    const updated = await db.user.findUniqueOrThrow({ where: { id: staffId } });
    expect(updated.passwordHash).not.toBe(originalHash);

    // Every refresh token for the account is revoked -- which is why the UI
    // says so rather than leaving people wondering why they were signed out.
    const stillLive = await db.refreshToken.count({
      where: { userId: staffId, revokedAt: null },
    });
    expect(stillLive).toBe(0);
    expect(before).toBeGreaterThanOrEqual(0);

    const audited = await db.auditLog.findFirst({
      where: { actorId: staffId, action: 'PASSWORD_CHANGED' },
      orderBy: { createdAt: 'desc' },
    });
    expect(audited).not.toBeNull();
  });

  it('tells the account holder, every time -- not just the first', async () => {
    // The router's idempotency key used to be `SECURITY:<event>:<user>` with no
    // occurrence in it, so a second password change matched the first and was
    // silently dropped. The key now carries the audit row's id.
    const notifications = await db.notification.findMany({
      where: { recipientId: staffId, type: 'SECURITY' },
      orderBy: { createdAt: 'desc' },
    });

    expect(notifications.length).toBeGreaterThanOrEqual(1);
    expect(notifications[0]!.body).toContain('password');

    // Change it again -- back to the seeded value, which also restores it.
    await request(app.getHttpServer())
      .post(`${API}/auth/change-password`)
      .set('Authorization', `Bearer ${await tokenFor(app, SEEDED.bloodCenterStaff)}`)
      .send({ currentPassword: NEXT, newPassword: CURRENT })
      .expect(200);

    // The second change raises its own notification rather than being
    // deduplicated against the first.
    const deadline = Date.now() + 5000;
    let after = notifications.length;
    while (Date.now() < deadline) {
      after = await db.notification.count({
        where: { recipientId: staffId, type: 'SECURITY' },
      });
      if (after > notifications.length) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    expect(after).toBeGreaterThan(notifications.length);
  });
});
