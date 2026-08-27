import { INestApplication } from '@nestjs/common';

import { PrismaService } from './../src/database/prisma.service';
import { GamificationService } from './../src/modules/gamification/gamification.service';
import { XpService } from './../src/modules/gamification/services/xp.service';
import { createTestApp, seededOrganizations } from './utils/e2e';

/**
 * P3-13 regression: gamification profile creation must survive concurrency.
 *
 * Gamification runs from fire-and-forget @OnEvent handlers, so several events
 * for the same user routinely land at once. Profile creation used to be an
 * `upsert`, which Prisma compiles on this model to SELECT-then-INSERT rather
 * than a native ON CONFLICT: concurrent callers all saw no row, all inserted,
 * and the losers died with a P2002 on `userId`. Because the handlers only log
 * their errors, the XP, reputation and achievement work for those events was
 * then silently lost — this was first seen as a real failure in a CI run.
 *
 * A unit test cannot catch this: it needs a real database and real parallel
 * connections. Hence an e2e spec.
 */
describe('Gamification profile creation under concurrency (e2e)', () => {
  let app: INestApplication;
  let db: PrismaService;
  let xp: XpService;
  let gamification: GamificationService;

  let organizationId: string;
  let donorRoleId: string;
  const createdUserIds: string[] = [];

  // Tuned against the unfixed implementation until detection was reliable. A
  // single burst of 32 consistently MISSED the race - the first burst after the
  // pool warms up is effectively serialised - so the guard uses a higher
  // concurrency and repeats over fresh users. Measured on the reverted code:
  // 32x1 caught it 0/3 runs, 32x3 and 64x1 caught it 3/3 runs each.
  const CONCURRENCY = 64;
  const TRIALS = 3;

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(PrismaService);
    xp = app.get(XpService);
    gamification = app.get(GamificationService);

    const orgs = await seededOrganizations(app);
    organizationId = orgs.hospital.id;
    donorRoleId = (await db.role.findUniqueOrThrow({ where: { code: 'DONOR' } })).id;
  });

  afterAll(async () => {
    for (const id of createdUserIds) {
      await db.gamificationProfile.deleteMany({ where: { userId: id } });
      await db.xpTransaction.deleteMany({ where: { userId: id } });
      await db.user.deleteMany({ where: { id } });
    }
    await app.close();
  });

  async function makeDonor(): Promise<string> {
    const user = await db.user.create({
      data: {
        email: `e2e.gamification.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@donor.local`,
        firstName: 'E2E',
        lastName: 'Gamification',
        passwordHash: 'not-used-this-suite-calls-services-directly',
        status: 'ACTIVE',
        emailVerified: true,
        memberships: { create: { organizationId, roleId: donorRoleId, status: 'ACTIVE' } },
      },
    });
    createdUserIds.push(user.id);
    return user.id;
  }

  it('creates exactly one profile when many callers race to create it', async () => {
    for (let trial = 0; trial < TRIALS; trial++) {
      const userId = await makeDonor();

      const results = await Promise.allSettled(
        Array.from({ length: CONCURRENCY }, () => xp.ensureProfileExists(userId)),
      );

      // The assertion that actually pins the fix: nobody is allowed to lose.
      expect(results.filter((r) => r.status === 'rejected')).toHaveLength(0);
      expect(await db.gamificationProfile.count({ where: { userId } })).toBe(1);
    }
  });

  it('is still safe when the profile already exists', async () => {
    const userId = await makeDonor();
    await xp.ensureProfileExists(userId);

    const results = await Promise.allSettled(
      Array.from({ length: CONCURRENCY }, () => xp.ensureProfileExists(userId)),
    );

    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(0);
    expect(await db.gamificationProfile.count({ where: { userId } })).toBe(1);
    // A repeat call must not reset progress, so confirm it stayed at the
    // freshly-created baseline rather than being overwritten.
    const profile = await db.gamificationProfile.findUniqueOrThrow({ where: { userId } });
    expect(profile.totalXp).toBe(0);
  });

  it('goes through the service wrapper the event handlers actually call', async () => {
    // handleDonationCompleted and friends call ensureGamificationProfile, not
    // the XpService method directly, so cover that entry point too.
    for (let trial = 0; trial < TRIALS; trial++) {
      const userId = await makeDonor();

      const results = await Promise.allSettled(
        Array.from({ length: CONCURRENCY }, () => gamification.ensureGamificationProfile(userId)),
      );

      expect(results.filter((r) => r.status === 'rejected')).toHaveLength(0);
      expect(await db.gamificationProfile.count({ where: { userId } })).toBe(1);
    }
  });

  it('awards XP correctly when concurrent awards land on a user with no profile', async () => {
    // awardXp upserts inside a transaction, which had the same racy shape. Each
    // award has a distinct sourceId so all of them are legitimate writes, and
    // the totals must add up exactly - no lost updates, no crashes.
    const userId = await makeDonor();
    const awards = 6;
    const amount = 10;

    const results = await Promise.allSettled(
      Array.from({ length: awards }, (_, i) =>
        xp.awardXp(userId, amount, 'ADMIN_ADJUSTMENT', 'E2E_RACE', `e2e-race-${userId}-${i}`, 'e2e concurrency'),
      ),
    );

    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(0);
    expect(await db.gamificationProfile.count({ where: { userId } })).toBe(1);

    const profile = await db.gamificationProfile.findUniqueOrThrow({ where: { userId } });
    expect(profile.totalXp).toBe(awards * amount);
  });
});
