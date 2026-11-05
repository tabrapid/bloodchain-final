import { INestApplication } from '@nestjs/common';
import * as argon2 from 'argon2';
import request from 'supertest';

import { PrismaService } from '../src/database/prisma.service';
import { API, createTestApp, createTestDonor, seededOrganizations, type TestDonor } from './utils/e2e';

/**
 * STORE_BLOCKER_ACCOUNT_DELETION: a donor can close their own account.
 *
 * What the stores require is that the person can do it from inside the app
 * and that it takes effect. What a blood service requires is that the
 * donation record survives it. Both are asserted here against the real
 * database: after `DELETE /users/me` the refresh token is dead, a fresh login
 * is refused as deactivated, the optional data the app collected is gone --
 * and the user row, the donor profile's blood group and the audit trail are
 * still there.
 */
describe('a donor closes their own account', () => {
  const PASSWORD = 'ClosesTheDoor!2026';

  let app: INestApplication;
  let db: PrismaService;
  let donor: TestDonor;
  let accessToken: string;
  let refreshToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(PrismaService);
    const { bloodCenter } = await seededOrganizations(app);
    donor = await createTestDonor(app, { label: 'deletion', organizationId: bloodCenter.id });

    // A real password and a real login, so the tokens being revoked are the
    // ones the auth module issued rather than ones minted for the test.
    await db.user.update({
      where: { id: donor.id },
      data: {
        passwordHash: await argon2.hash(PASSWORD),
        displayName: 'Deletion D.',
        donorProfile: { update: { city: 'Jizzakh', district: 'Arnasoy', consentLocation: true } },
      },
    });
    const login = await request(app.getHttpServer())
      .post(`${API}/auth/login`)
      .send({ email: donor.email, password: PASSWORD })
      .expect(200);
    accessToken = login.body.data.accessToken;
    refreshToken = login.body.data.refreshToken;
  });

  afterAll(async () => {
    await donor.cleanup();
    await app.close();
  });

  it('closes the account and signs every device out', async () => {
    const res = await request(app.getHttpServer())
      .delete(`${API}/users/me`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(res.body.data).toEqual({ success: true });

    const user = await db.user.findUniqueOrThrow({ where: { id: donor.id } });
    expect(user.status).toBe('DEACTIVATED');
    expect(user.displayName).toBeNull();

    const openSessions = await db.session.count({ where: { userId: donor.id, revokedAt: null } });
    const openRefresh = await db.refreshToken.count({ where: { userId: donor.id, revokedAt: null } });
    expect(openSessions).toBe(0);
    expect(openRefresh).toBe(0);
  });

  it('refuses the refresh token and a fresh sign-in afterwards', async () => {
    await request(app.getHttpServer()).post(`${API}/auth/refresh`).send({ refreshToken }).expect(401);

    const login = await request(app.getHttpServer())
      .post(`${API}/auth/login`)
      .send({ email: donor.email, password: PASSWORD });
    expect(login.status).toBe(403);
  });

  it('removes the optional data the app collected and keeps the donation record', async () => {
    const profile = await db.donorProfile.findUniqueOrThrow({ where: { userId: donor.id } });
    expect(profile.consentLocation).toBe(false);
    expect(profile.city).toBeNull();
    expect(profile.district).toBeNull();
    expect(profile.latitude).toBeNull();

    // The medical record: identity, blood group and verification untouched.
    const user = await db.user.findUniqueOrThrow({ where: { id: donor.id } });
    expect(user.email).toBe(donor.email);
    expect(user.firstName).toBe('E2E');
    expect(profile.bloodType).toBe('O');
    expect(profile.verificationStatus).toBe('VERIFIED');

    const audit = await db.auditLog.findFirst({
      where: { actorId: donor.id, action: 'ACCOUNT_DELETED_BY_USER' },
    });
    expect(audit).not.toBeNull();
  });

  it('is idempotent: closing a closed account still answers success', async () => {
    // The access token outlives the account until it expires; the endpoint
    // itself must therefore tolerate a repeat rather than 500 on it.
    await request(app.getHttpServer())
      .delete(`${API}/users/me`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
  });
});
