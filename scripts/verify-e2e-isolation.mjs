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
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
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

/** Rows the suites create; any growth across a run is a leak. */
async function census() {
  const [users, donations, units, appointments, slots, emergencies, shipments] = await Promise.all([
    db.user.count(),
    db.donation.count(),
    db.bloodUnit.count(),
    db.appointment.count(),
    db.appointmentSlot.count(),
    db.emergencyRequest.count(),
    db.shipment.count(),
  ]);
  return { users, donations, units, appointments, slots, emergencies, shipments };
}

function runSuite(label) {
  try {
    execFileSync('pnpm', ['test:e2e'], { cwd: ROOT, stdio: 'pipe' });
    return { ok: true, output: '' };
  } catch (error) {
    return {
      ok: false,
      output: `${error.stdout ?? ''}${error.stderr ?? ''}`.slice(-4000),
    };
  } finally {
    void label;
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
console.log(`  ✓ All ${results.length} checks passed. The suite owns its own data.\n`);
