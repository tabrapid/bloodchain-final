import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { PrismaService } from '../src/database/prisma.service';
import { API, createTestApp, createTestDonor, seededOrganizations, TestDonor } from './utils/e2e';

describe('live HTTP session and grant revocation', () => {
  let app: INestApplication;
  let db: PrismaService;
  let donor: TestDonor;
  let organizationId: string;
  const sessionId = () => app.get(JwtService).decode(donor.token).sid as string;
  const get = (path: string) => request(app.getHttpServer()).get(`${API}${path}`)
    .set('Authorization', `Bearer ${donor.token}`);

  beforeAll(async () => {
    app = await createTestApp(); db = app.get(PrismaService);
    organizationId = (await seededOrganizations(app)).bloodCenter.id;
  });
  beforeEach(async () => {
    donor = await createTestDonor(app, { label: 'access-revocation', organizationId });
  });
  afterEach(async () => { await donor.cleanup(); });
  afterAll(async () => { await app.close(); });

  it('revoking the current device immediately invalidates its existing access token', async () => {
    await get('/users/me').expect(200);
    await request(app.getHttpServer()).delete(`${API}/auth/sessions/${sessionId()}`)
      .set('Authorization', `Bearer ${donor.token}`).expect(200);
    await get('/users/me').expect(401);
  });
  it('suspension immediately blocks a previously valid token', async () => {
    await get('/users/me').expect(200);
    await db.user.update({ where: { id: donor.id }, data: { status: 'SUSPENDED' } });
    await get('/users/me').expect(401);
  });
  it('session expiry applies even before the JWT itself expires', async () => {
    await get('/users/me').expect(200);
    await db.session.update({ where: { id: sessionId() }, data: { expiresAt: new Date(0) } });
    await get('/users/me').expect(401);
  });
  it('removed memberships stop authorizing donor routes without refreshing the JWT', async () => {
    await get('/me/laboratory-results').expect(200);
    await db.organizationMembership.updateMany({ where: { userId: donor.id }, data: { status: 'INACTIVE' } });
    await get('/me/laboratory-results').expect(403);
  });
});
