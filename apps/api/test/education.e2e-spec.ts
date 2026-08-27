import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { PrismaService } from '../src/database/prisma.service';
import { API, SEEDED, createTestApp, tokenFor, waitFor } from './utils/e2e';

/**
 * P3-10 regression tests.
 *
 * The mobile education screen offered a single "Complete" button and never
 * called `startContent`. The backend refuses that: `completeContent` throws
 * `BadRequestException('You must start the content before completing it')` when
 * no `EducationProgress` row exists. So every tap of the only button on the
 * screen failed — the feature was not merely missing a step, it was
 * unreachable end to end.
 *
 * These tests pin the contract the mobile screen now honours: start first,
 * complete second, both idempotent, and XP awarded exactly once.
 */
describe('P3-10: education progress requires start before complete', () => {
  let app: INestApplication;
  let db: PrismaService;
  let donorToken: string;
  let donorId: string;
  let contentId: string;

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(PrismaService);
    donorToken = await tokenFor(app, SEEDED.donor);
    donorId = (await db.user.findUniqueOrThrow({ where: { email: SEEDED.donor } })).id;

    // Own content fixture: the seeded rows may already carry progress for the
    // demo donor, which would mask the very first assertion.
    const content = await db.educationalContent.create({
      data: {
        type: 'ARTICLE',
        title: `P3-10 fixture ${Date.now()}`,
        description: 'Fixture for the start-before-complete contract.',
        body: 'Body text.',
        category: 'BASICS',
        difficulty: 'BEGINNER',
        xpReward: 25,
        estimatedMinutes: 3,
        isActive: true,
      },
    });
    contentId = content.id;
  });

  afterAll(async () => {
    await db.educationProgress.deleteMany({ where: { contentId } });
    await db.educationalContent.delete({ where: { id: contentId } });
    await app.close();
  });

  it('rejects completing content that was never started', async () => {
    const res = await request(app.getHttpServer())
      .post(`${API}/education/${contentId}/complete`)
      .set('Authorization', `Bearer ${donorToken}`);

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain('start the content');

    const progress = await db.educationProgress.findMany({ where: { contentId, userId: donorId } });
    expect(progress).toHaveLength(0);
  });

  it('starts the content, and starting twice is idempotent', async () => {
    const first = await request(app.getHttpServer())
      .post(`${API}/education/${contentId}/start`)
      .set('Authorization', `Bearer ${donorToken}`)
      .expect(201);

    expect(first.body.data.status).toBe('STARTED');

    const second = await request(app.getHttpServer())
      .post(`${API}/education/${contentId}/start`)
      .set('Authorization', `Bearer ${donorToken}`)
      .expect(201);

    expect(second.body.data.id).toBe(first.body.data.id);

    const rows = await db.educationProgress.findMany({ where: { contentId, userId: donorId } });
    expect(rows).toHaveLength(1);
  });

  it('exposes the started row through GET /education/my/progress, which is how the screen knows', async () => {
    const res = await request(app.getHttpServer())
      .get(`${API}/education/my/progress`)
      .set('Authorization', `Bearer ${donorToken}`)
      .expect(200);

    const mine = res.body.data.items.find((p: { contentId: string }) => p.contentId === contentId);
    expect(mine).toBeDefined();
    expect(mine.status).toBe('STARTED');
  });

  it('completes once started, and completing twice awards XP only once', async () => {
    const before = await db.gamificationProfile.findUnique({ where: { userId: donorId } });

    // 200, not 201: completing updates the existing progress row rather than
    // creating one, and P3-12 aligned each POST's real status with what it
    // does. `start`, which does create a row, answers 201.
    const first = await request(app.getHttpServer())
      .post(`${API}/education/${contentId}/complete`)
      .set('Authorization', `Bearer ${donorToken}`)
      .expect(200);

    expect(first.body.data.status).toBe('COMPLETED');
    expect(first.body.data.xpAwarded).toBe(25);

    // The XP is credited by an @OnEvent handler that the request does not
    // await, so poll rather than assume it has landed by the time the response
    // returns.
    const expectedTotal = (before?.totalXp ?? 0) + 25;
    const afterFirst = await waitFor(
      async () => {
        const profile = await db.gamificationProfile.findUnique({ where: { userId: donorId } });
        return profile && profile.totalXp === expectedTotal ? profile : null;
      },
      { what: `education XP to reach ${expectedTotal}` },
    );
    expect(afterFirst.totalXp).toBe(expectedTotal);

    await request(app.getHttpServer())
      .post(`${API}/education/${contentId}/complete`)
      .set('Authorization', `Bearer ${donorToken}`)
      .expect(200);

    // Give a second award every chance to land before asserting it did not.
    await new Promise((resolve) => setTimeout(resolve, 250));
    const afterSecond = await db.gamificationProfile.findUniqueOrThrow({ where: { userId: donorId } });
    expect(afterSecond.totalXp).toBe(afterFirst.totalXp);
  });

  it('awards the advertised XP to a second donor too, not just the first', async () => {
    // XpTransaction's uniqueness used to be (sourceType, sourceId). For an
    // EDUCATION source that id is the *content* id, shared by every donor — so
    // the first donor to finish a piece of content claimed its XP and everyone
    // after them was silently refused. The same held for ACHIEVEMENT codes and
    // CHALLENGE ids. The key is now scoped by userId.
    const other = await db.user.create({
      data: {
        email: `p310.second.${Date.now()}@e2e.local`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Second',
        lastName: 'Donor',
        emailVerified: true,
        status: 'ACTIVE',
      },
    });
    const donorRole = await db.role.findUniqueOrThrow({ where: { code: 'DONOR' } });
    const organization = await db.organization.findFirstOrThrow();
    await db.organizationMembership.create({
      data: { userId: other.id, organizationId: organization.id, roleId: donorRole.id, status: 'ACTIVE' },
    });

    const otherToken = await tokenFor(app, other.email);

    await request(app.getHttpServer())
      .post(`${API}/education/${contentId}/start`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .post(`${API}/education/${contentId}/complete`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(200);

    const profile = await waitFor(
      async () => {
        const row = await db.gamificationProfile.findUnique({ where: { userId: other.id } });
        return row && row.totalXp > 0 ? row : null;
      },
      { what: "the second donor's education XP" },
    );
    expect(profile.totalXp).toBe(25);

    await db.user.delete({ where: { id: other.id } });
  });

  it('counts the completion in the stats the screen displays', async () => {
    const res = await request(app.getHttpServer())
      .get(`${API}/education/my/stats`)
      .set('Authorization', `Bearer ${donorToken}`)
      .expect(200);

    expect(res.body.data.totalStarted).toBeGreaterThanOrEqual(1);
    expect(res.body.data.totalCompleted).toBeGreaterThanOrEqual(1);
    expect(res.body.data.totalXpEarned).toBeGreaterThanOrEqual(25);
  });
});
