/**
 * Fixtures the verification scripts own, so they stop borrowing the demo's.
 *
 * `pnpm verify:safety` and `pnpm demo:verify` both drove their flows through
 * `donor@donor.local`, and both completed real donations with it. Completing a
 * donation opens a 56-day recovery window, so the second script to run found
 * the donor correctly refused by the very rule the first had just exercised.
 * The standing remedies were "run `pnpm demo:reset` first" and, in
 * demo:verify's case, calling the reset itself three times mid-run -- which
 * truncates the database underneath whatever else is using it, including a
 * running API, and made `verify:safety` and `demo:verify` mutually
 * unrunnable.
 *
 * This is the same move `apps/api/test/utils/e2e.ts` made for the e2e suites
 * in Sprint 6: the rules stay exactly as they are, and each script gets actors
 * with no history for them to fire on.
 *
 * Two things live here:
 *
 * 1. `tokenFor` -- an access token minted directly, rather than fetched from
 *    `POST /auth/login`. Sign-in is rate limited to five attempts per minute
 *    per IP (deliberately), and these scripts need a dozen actors, so driving
 *    them through the login route made the scripts trip the app's real rate
 *    limiter on themselves -- the 429 that made `verify:safety` fail when run
 *    after `demo:verify`. The rate limiter is shared global state like any
 *    other, and this is how the scripts stop depending on it. The token is
 *    genuine: same secret, same `{ sub, roles, permissions }` payload the login
 *    route mints, with roles and permissions read from the database, and every
 *    guard validates it for real.
 *
 * 2. `createScriptDonor` -- a donor that belongs to one run of one script and
 *    to nobody else, with a `cleanup` that removes it and everything that
 *    cascades off it.
 *
 * Neither weakens a rule. Eligibility, cooldown and deferral are untouched.
 */
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadEnvFile } from './demo-guard.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require_ = createRequire(path.join(ROOT, 'apps', 'api', 'package.json'));

let client = null;

/** One Prisma client per process, opened lazily. */
export function db() {
  if (!client) {
    const { PrismaClient } = require_('@prisma/client');
    client = new PrismaClient();
  }
  return client;
}

export async function disconnect() {
  if (client) {
    await client.$disconnect();
    client = null;
  }
}

const base64url = (input) =>
  Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/**
 * Sign an HS256 JWT by hand.
 *
 * Hand-rolled rather than pulled from a library because these scripts are
 * plain Node with no dependencies of their own, and HS256 is a base64url
 * header, a base64url payload and an HMAC over the two. The secret is the same
 * `JWT_ACCESS_SECRET` the API validates with, read from the same .env file, so
 * a token that this produces and the API rejects means the two have diverged --
 * which is a thing worth finding out.
 */
function signAccessToken({ sub, roles, permissions, secret, expiresInSeconds = 900 }) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url(
    JSON.stringify({ sub, roles, permissions, iat: now, exp: now + expiresInSeconds }),
  );
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return `${header}.${payload}.${signature}`;
}

/** The permissions a user holds, by the same rule `PermissionsService` applies. */
async function permissionsFor(userId) {
  const memberships = await db().organizationMembership.findMany({
    where: { userId, status: 'ACTIVE' },
    include: { role: { include: { permissions: { include: { permission: true } } } } },
  });

  const permissions = new Set();
  for (const membership of memberships) {
    for (const rp of membership.role.permissions) {
      permissions.add(rp.permission.code);
    }
  }
  if (memberships.some((m) => m.role.code === 'SUPER_ADMIN')) {
    permissions.add('admin.manage');
  }

  return { roles: memberships.map((m) => m.role.code), permissions: Array.from(permissions) };
}

/** An access token for a user, by email. Never touches /auth/login. */
export async function tokenFor(email) {
  loadEnvFile();
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) {
    throw new Error('JWT_ACCESS_SECRET is not set, so no token can be minted. Copy .env.example to .env.');
  }

  const user = await db().user.findUnique({ where: { email }, select: { id: true } });
  if (!user) {
    throw new Error(`No user ${email}. Run \`pnpm demo:reset\` once to seed the database.`);
  }

  const { roles, permissions } = await permissionsFor(user.id);
  return signAccessToken({ sub: user.id, roles, permissions, secret });
}

/** The same, by user id. */
export async function tokenForId(userId) {
  loadEnvFile();
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) {
    throw new Error('JWT_ACCESS_SECRET is not set, so no token can be minted. Copy .env.example to .env.');
  }
  const { roles, permissions } = await permissionsFor(userId);
  return signAccessToken({ sub: userId, roles, permissions, secret });
}

/**
 * A donor this run owns.
 *
 * `cleanup` deletes the user; `Donation`, `DonorProfile`,
 * `OrganizationMembership`, `Appointment`, `DonorDeferral` and (through
 * `Donation`) `BloodUnit` all cascade off it, so a run that dies halfway
 * through still leaves nothing behind for the next one to trip over.
 */
export async function createScriptDonor({
  label,
  organizationId,
  bloodType = 'O',
  rhFactor = 'POSITIVE',
  verificationStatus = 'VERIFIED',
  /** Backdate a completed donation this many days, to place the donor inside a recovery window. */
  donatedDaysAgo = null,
  /** Location consent, for flows that share a journey location. */
  consentLocation = false,
  latitude = null,
  longitude = null,
}) {
  const prisma = db();
  const donorRole = await prisma.role.findUniqueOrThrow({ where: { code: 'DONOR' } });

  const email = `verify.${label}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@donor.local`;

  const donor = await prisma.user.create({
    data: {
      email,
      // A real, verifiable number so phone-first flows work against this donor
      // if they ever need to; unique per run like the email.
      firstName: 'Verify',
      lastName: label,
      passwordHash: 'not-used-tokens-are-minted-directly',
      status: 'ACTIVE',
      emailVerified: true,
      donorProfile: {
        create: {
          bloodType,
          rhFactor,
          donorStatus: 'ACTIVE',
          verificationStatus,
          consentLocation,
          latitude,
          longitude,
        },
      },
      memberships: {
        create: { organizationId, roleId: donorRole.id, status: 'ACTIVE' },
      },
    },
  });

  let seededDonationId = null;
  if (donatedDaysAgo !== null) {
    const completedAt = new Date(Date.now() - donatedDaysAgo * 24 * 60 * 60 * 1000);
    const donation = await prisma.donation.create({
      data: {
        donationReference: `VERIFY-${label}-${Date.now()}`,
        donorId: donor.id,
        organizationId,
        donationType: 'WHOLE_BLOOD',
        status: 'COMPLETED',
        volumeMl: 450,
        collectionStartedAt: completedAt,
        collectionCompletedAt: completedAt,
        completedAt,
      },
    });
    seededDonationId = donation.id;
  }

  return {
    id: donor.id,
    email,
    seededDonationId,
    token: await tokenForId(donor.id),
    cleanup: async () => {
      // Slots first, then the user.
      //
      // `AppointmentSlot.bookedCount` is maintained by the booking and
      // cancellation paths, not by a foreign key -- so deleting an appointment
      // row directly, which is what the cascade below does, leaves the counter
      // incremented and the capacity gone. Nothing notices until a slot reaches
      // FULL and the next run cannot book it: the script starts failing at
      // "donor books the test" for a reason that has nothing to do with the
      // software, and the only cure is a reset, which is exactly the dependency
      // this harness exists to remove.
      const slotIds = (
        await prisma.appointment.findMany({
          where: { donorId: donor.id },
          select: { slotId: true },
          distinct: ['slotId'],
        })
      ).map((appointment) => appointment.slotId);

      await prisma.user.deleteMany({ where: { id: donor.id } });
      await restoreSlotCounts(prisma, slotIds);
    },
  };
}

/**
 * Recompute `bookedCount` for each slot from the appointments that actually
 * remain, and reopen any slot that is no longer full.
 *
 * Recomputed rather than decremented: a decrement assumes it knows how many
 * bookings this run made against the slot, and a run that died halfway through
 * does not. Counting what is left is correct however the run ended.
 */
export async function restoreSlotCounts(prisma, slotIds) {
  for (const slotId of new Set(slotIds)) {
    const slot = await prisma.appointmentSlot.findUnique({ where: { id: slotId } });
    if (!slot) continue;

    const remaining = await prisma.appointment.count({
      where: {
        slotId,
        status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'RESULT_PENDING', 'RESULT_READY'] },
      },
    });

    if (remaining === slot.bookedCount && !(slot.status === 'FULL' && remaining < slot.capacity)) {
      continue;
    }

    await prisma.appointmentSlot.update({
      where: { id: slotId },
      data: {
        bookedCount: remaining,
        status: remaining >= slot.capacity ? 'FULL' : slot.status === 'FULL' ? 'AVAILABLE' : slot.status,
      },
    });
  }
}

/**
 * Delete every donor a run created, even if the run failed.
 *
 * A failure here is reported, not swallowed. Silent cleanup is how a leak
 * hides: the run goes green, the rows stay, and the next run fails somewhere
 * unrelated -- a slot that is full, an email that is taken -- with nothing
 * pointing back at the cleanup that did not happen.
 */
export async function cleanupAll(donors) {
  const failures = [];
  for (const donor of donors) {
    try {
      await donor.cleanup();
    } catch (error) {
      failures.push(`${donor.email}: ${String(error?.stack ?? error?.message ?? error).split('\n').slice(0, 4).join(' | ')}`);
    }
  }

  if (failures.length > 0) {
    console.error(`\n  ! cleanup left ${failures.length} donor(s) behind:`);
    for (const failure of failures) console.error(`      ${failure}`);
  }

  return failures;
}
