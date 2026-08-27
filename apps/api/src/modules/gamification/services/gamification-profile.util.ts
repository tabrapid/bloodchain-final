import { Prisma } from '@prisma/client';

/** Anything that can run Prisma writes: the client itself or a transaction. */
type ProfileWriter = {
  gamificationProfile: {
    createMany: (args: {
      data: Prisma.GamificationProfileCreateManyInput[];
      skipDuplicates?: boolean;
    }) => Promise<unknown>;
  };
};

/**
 * Create the user's gamification profile if it does not already exist.
 *
 * Deliberately not `upsert()`. Prisma compiles upsert on this model to
 * SELECT-then-INSERT rather than a native ON CONFLICT, so two concurrent
 * callers both see no row, both insert, and one dies with a P2002 unique
 * violation on `userId`. That is not theoretical: gamification work runs from
 * fire-and-forget event handlers, so several events for the same user routinely
 * land at once, and those handlers only log the error — so the XP, reputation
 * and achievement work for that event is silently lost.
 *
 * `createMany` with `skipDuplicates` compiles to a single
 * `INSERT ... ON CONFLICT DO NOTHING`, which the database resolves atomically:
 * no retry, and no concurrent caller can lose.
 *
 * Callers that need to *increment* a profile still use upsert inside their own
 * transaction; calling this first guarantees the row already exists, so that
 * upsert always takes its update branch and can never hit the racy insert path.
 */
export async function ensureGamificationProfileRow(
  db: ProfileWriter,
  userId: string,
): Promise<void> {
  await db.gamificationProfile.createMany({
    data: [{ userId, totalXp: 0, level: 1 }],
    skipDuplicates: true,
  });
}
