#!/usr/bin/env node
/**
 * Sprint 6 verification: the e2e suite is self-isolating.
 *
 * The suite used to depend on global state it did not own. Completing a
 * donation opens a 56-day recovery window on whoever made it, and the domain
 * suites all pointed their donation fixtures at the shared `donor@donor.local`
 * -- so any completed donation anywhere, whether from an earlier run of the
 * suite itself or from `pnpm demo:verify`, made every later booking answer
 * `409 DONOR_IN_RECOVERY_WINDOW`. The suite that went red was never the one
 * that caused it, and the standing remedy was "run `pnpm demo:reset` first",
 * which is not a property a test suite should need from its environment.
 *
 * Re-running the suite twice would only prove that it cleans up after itself.
 * This goes further and proves it does not care: it deliberately puts the
 * shared donor inside a recovery window first -- exactly the state
 * `demo:verify` leaves behind -- and then runs the suite twice against it.
 *
 * It also checks the suite leaves nothing behind, by counting the rows that
 * matter before and after.
 */
import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { closeSync, mkdtempSync, openSync, readSync, rmSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertLocalDatabase, fail } from './demo-guard.mjs';

try {
  assertLocalDatabase();
} catch (error) {
  fail(error.message);
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require_ = createRequire(path.join(ROOT, 'apps', 'api', 'package.json'));
const { PrismaClient } = require_('@prisma/client');

const db = new PrismaClient();
const results = [];
const record = (ok, label, detail = '') => {
  results.push({ ok, label, detail });
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
};

/**
 * Rows the suites create; any growth across a run is a leak.
 *
 * `bookedSlotCapacity` is not a row count, and it is here because counting rows
 * missed a real leak for a whole sprint. `AppointmentSlot.bookedCount` is
 * maintained by the booking and cancellation paths rather than by a foreign
 * key, so a suite that deletes its donor -- cascading the appointment away --
 * leaves the counter incremented and that slot's capacity permanently spent.
 * The slot row is still there, so the census was satisfied, and the symptom
 * appeared runs later as a booking that could not find a free slot.
 */
async function census() {
  const [users, donations, units, appointments, slots, emergencies, shipments, booked, decisions, deferrals] =
    await Promise.all([
      db.user.count(),
      db.donation.count(),
      db.bloodUnit.count(),
      db.appointment.count(),
      db.appointmentSlot.count(),
      db.emergencyRequest.count(),
      db.shipment.count(),
      db.appointmentSlot.aggregate({ _sum: { bookedCount: true } }),
      db.releaseDecision.count(),
      db.donorDeferral.count(),
    ]);

  return {
    users,
    donations,
    units,
    appointments,
    slots,
    emergencies,
    shipments,
    bookedSlotCapacity: booked._sum.bookedCount ?? 0,
    releaseDecisions: decisions,
    donorDeferrals: deferrals,
  };
}

/** Where each run's streams are written. Removed again once everything passes. */
const LOG_DIR = mkdtempSync(path.join(tmpdir(), 'bloodchain-e2e-isolation-'));

/** The last `bytes` of a file, without reading the whole thing into memory. */
function tailOf(file, bytes) {
  const { size } = statSync(file);
  const start = Math.max(0, size - bytes);
  const buffer = Buffer.alloc(size - start);
  const fd = openSync(file, 'r');
  try {
    readSync(fd, buffer, 0, buffer.length, start);
  } finally {
    closeSync(fd);
  }
  return buffer.toString('utf8');
}

/**
 * Run the suite once, with its output going to files rather than down a pipe.
 *
 * This used to be `execFileSync(..., { stdio: 'pipe' })`, which buffers the
 * child's output in memory under Node's default `maxBuffer` of 1 MiB. The e2e
 * suite writes about 0.95 MiB of request logs to stdout all by itself, so this
 * check spent its whole life roughly one log line short of the ceiling. On a
 * machine that logged a little more -- a CI runner, as it turned out -- Node
 * killed jest partway through the run and threw ENOBUFS, and this script
 * faithfully reported that as "the suite is not isolated".
 *
 * It was the most misleading failure available. The label named the property
 * under test, so the report read as a real regression in donor-state coupling;
 * the captured output was a 4 KiB fragment that began mid-stack-trace and
 * ended on a row of PASS lines with no jest summary anywhere in it; and the
 * suite itself was green the whole time. The check was not measuring the
 * suite. It was measuring how chatty the application's logger is.
 *
 * Files have no such ceiling, so the run is never truncated and never killed.
 * Keeping the two streams apart is the other half of the fix: jest writes its
 * results to stderr and the application writes its request log to stdout, so
 * the failure report below quotes the stream that says which test failed
 * instead of the one that says which requests were served.
 */
function runSuite(label) {
  const outFile = path.join(LOG_DIR, `${label}.stdout.log`);
  const errFile = path.join(LOG_DIR, `${label}.stderr.log`);
  const out = openSync(outFile, 'w');
  const err = openSync(errFile, 'w');
  try {
    execFileSync('pnpm', ['test:e2e'], { cwd: ROOT, stdio: ['ignore', out, err] });
    return { ok: true, output: '' };
  } catch (error) {
    closeSync(out);
    closeSync(err);
    const reported = tailOf(errFile, 8000).trim() || tailOf(outFile, 8000).trim();
    return {
      ok: false,
      output:
        `the suite exited ${error.status ?? error.signal}. jest's own output ends:\n` +
        `${reported}\n  (full streams kept at ${outFile} and ${errFile})`,
    };
  } finally {
    // Closing a descriptor twice throws EBADF, and the catch above has already
    // closed both on the failing path.
    try {
      closeSync(out);
      closeSync(err);
    } catch {
      /* already closed on the failure path */
    }
  }
}

console.log('\n  Sprint 6 — the e2e suite does not depend on shared donor state\n');

let poisonId = null;

try {
  const donor = await db.user.findUnique({ where: { email: 'donor@donor.local' } });
  if (!donor) {
    fail('donor@donor.local is missing. Run `pnpm demo:reset` once to seed the database.');
  }

  const organization = await db.organization.findFirst({
    where: { type: 'BLOOD_CENTER', status: 'ACTIVE' },
    orderBy: { createdAt: 'asc' },
  });
  if (!organization) {
    fail('No active blood centre in the database. Run `pnpm demo:reset` once.');
  }

  // The hostile starting state: the shared donor finished a donation moments
  // ago, so every eligibility check on them refuses for the next 56 days.
  const poison = await db.donation.create({
    data: {
      donationReference: `E2E-ISOLATION-${Date.now()}`,
      donorId: donor.id,
      organizationId: organization.id,
      donationType: 'WHOLE_BLOOD',
      status: 'COMPLETED',
      volumeMl: 450,
      completedAt: new Date(),
    },
  });
  poisonId = poison.id;
  record(true, 'shared donor placed inside a recovery window', 'the state demo:verify leaves');

  const before = await census();

  const first = runSuite('first');
  record(first.ok, 'first run is green against that state', first.ok ? '' : first.output);

  const second = runSuite('second');
  record(second.ok, 'second run is green with no reset between them', second.ok ? '' : second.output);

  const after = await census();
  const leaks = Object.keys(before).filter((key) => after[key] !== before[key]);
  record(
    leaks.length === 0,
    'both runs left the database exactly as they found it',
    leaks.length === 0
      ? ''
      : leaks.map((key) => `${key}: ${before[key]} -> ${after[key]}`).join(', '),
  );
} finally {
  if (poisonId) {
    await db.donation.deleteMany({ where: { id: poisonId } });
  }
  await db.$disconnect();
}

const failed = results.filter((r) => !r.ok);
console.log('');
if (failed.length > 0) {
  console.log(`  ✗ ${failed.length} of ${results.length} checks failed.\n`);
  process.exit(1);
}
rmSync(LOG_DIR, { recursive: true, force: true });
console.log(`  ✓ All ${results.length} checks passed. The suite owns its own data.\n`);
