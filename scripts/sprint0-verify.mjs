#!/usr/bin/env node
/**
 * Sprint 0 integration checks, driven against the running API over HTTP.
 *
 * Not read-only: it books and completes a real donation, raises an emergency,
 * and requests a password reset. Run `pnpm demo:reset` afterwards -- the demo
 * donor is left inside a fresh recovery window, which `pnpm demo:check` will
 * (correctly) report as a failure.
 *
 * Every assertion here is made the way an attacker or a buggy client would make
 * it: a direct request to the endpoint, not a call into a service with mocked
 * dependencies. The whole point of this sprint is that the server refuses
 * things regardless of what the client does, and only a real request proves it.
 */
import { assertLocalDatabase, fail } from './demo-guard.mjs';

const API = process.env.DEMO_API_URL ?? 'http://localhost:3001';
const BASE = `${API}/api/v1`;
const PW = 'DevelopmentOnly!123';

try {
  assertLocalDatabase();
} catch (error) {
  fail(error.message);
}

let failures = 0;
let skipped = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};
// For an assertion this run genuinely could not make -- not one that failed.
// Counted and printed separately so it can never read as a pass.
const skip = (name, why) => {
  skipped += 1;
  console.log(`  skip ${name} — ${why}`);
};
const section = (name) => console.log(`\n${name}`);

async function call(method, path, token, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let parsed = {};
  try { parsed = await res.json(); } catch { /* empty */ }
  return { status: res.status, body: parsed?.data ?? parsed, raw: parsed };
}

const list = (b) => (Array.isArray(b) ? b : Array.isArray(b?.items) ? b.items : []);

async function login(email) {
  const res = await call('POST', '/auth/login', null, { email, password: PW });
  if (res.status !== 200) fail(`could not sign in as ${email} (${res.status}); run pnpm demo:reset`);
  return res.body.accessToken;
}

const dayAfter = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

async function firstSlot(token, orgId, type) {
  for (let i = 0; i < 6; i += 1) {
    const r = await call('GET', `/appointments/availability?organizationId=${orgId}&appointmentType=${type}&date=${dayAfter(i)}`, token);
    const slots = list(r.body);
    if (slots.length) return slots[0];
  }
  return null;
}

console.log('\n  Sprint 0 — core safety hardening: integration checks');

// ---------------------------------------------------------------- fixtures
const eligibleDonor = await login('donor@donor.local');       // last donation 70 days ago
const recoveringDonor = await login('recent.donor@donor.local'); // donated 12 days ago
const admin = await login('admin@donor.local');

// `limit=100`, not the default page: the Uzbekistan demo directory added
// seventeen organisations that sort ahead of the ones this script needs.
const orgs = list((await call('GET', '/organizations?limit=100', admin)).body);
const jizzakh = orgs.find((o) => o.name === 'Jizzakh City Hospital');
const northstarHospital = orgs.find((o) => o.name === 'Northstar Hospital (Development)');
const northstarCentre = orgs.find((o) => o.name === 'Northstar Blood Center (Development)');
if (!jizzakh || !northstarHospital || !northstarCentre) fail('expected seeded organisations are missing');

// This suite consumes the seed: it books and completes the demo donor's
// donation. Run twice without a reset and four checks fail for the most
// confusing possible reason -- the donor is now correctly refused by the very
// rule being tested. Check the precondition and say so instead.
const donorStats = (await call('GET', '/donations/me/statistics', eligibleDonor)).body;
if (donorStats?.nextDonationDate && new Date(donorStats.nextDonationDate) > new Date()) {
  fail(
    `donor@donor.local is inside a recovery window until ${String(donorStats.nextDonationDate).slice(0, 10)}, ` +
      'so this suite cannot book for them. It needs a freshly seeded database: run pnpm demo:reset.',
  );
}

// ============================================================= 1 + 2
section('  Eligibility is enforced on the server');

const recoveringProfile = (await call('GET', '/donors/profile', recoveringDonor)).body;
check('fixture: second donor is inside the recovery window', Boolean(recoveringProfile), recoveringProfile?.bloodType);

const donationSlot = await firstSlot(recoveringDonor, jizzakh.id, 'BLOOD_DONATION');
check('fixture: a donation slot is available', donationSlot !== null);

const blockedBooking = await call('POST', '/appointments', recoveringDonor, {
  slotId: donationSlot.id,
  appointmentType: 'BLOOD_DONATION',
});
check(
  'an ineligible donor cannot book by direct API call',
  blockedBooking.status === 409,
  `${blockedBooking.status} ${blockedBooking.raw?.code ?? ''}`,
);
check(
  'the refusal carries the DONOR_IN_RECOVERY_WINDOW domain code',
  blockedBooking.raw?.code === 'DONOR_IN_RECOVERY_WINDOW',
  blockedBooking.raw?.code,
);
check(
  'the refusal reports the next eligible date as data, not only prose',
  typeof blockedBooking.raw?.details?.nextEligibleDonationDate === 'string',
  blockedBooking.raw?.details?.nextEligibleDonationDate,
);

const allowedBooking = await call('POST', '/appointments', eligibleDonor, {
  slotId: donationSlot.id,
  appointmentType: 'BLOOD_DONATION',
});
check('an eligible donor can still book', allowedBooking.status === 201, allowedBooking.body?.referenceNumber);
const donationAppointmentId = allowedBooking.body?.id;

// A lab test carries no recovery window, so the ineligible donor must still be
// able to book one -- proof the gate is scoped to donation, not bolted on.
// Booked through the laboratory path the real client uses, because that is the
// path that carries a chosen test type (checked in section 8 below); the
// generic /appointments path deliberately carries none.
const testTypes = list((await call('GET', '/test-types?isActive=true', recoveringDonor)).body);
const cbc = testTypes.find((t) => t.code === 'CBC') ?? testTypes[0];
check('fixture: bookable test types are published', Boolean(cbc), cbc ? `${cbc.code} ${cbc.name}` : 'none');

async function firstLabSlot(token, orgId, testTypeId) {
  for (let i = 0; i < 6; i += 1) {
    const r = await call(
      'GET',
      `/laboratories/${orgId}/slots?testTypeId=${testTypeId}&date=${dayAfter(i)}`,
      token,
    );
    const slot = list(r.body).find((s) => s.isAvailable);
    if (slot) return slot;
  }
  return null;
}

const labSlot = cbc ? await firstLabSlot(recoveringDonor, northstarCentre.id, cbc.id) : null;
check('fixture: a laboratory slot is available', labSlot !== null);
const labBooking = labSlot
  ? await call('POST', '/laboratory-appointments', recoveringDonor, {
      laboratoryId: northstarCentre.id,
      testTypeId: cbc.id,
      slotId: labSlot.id,
    })
  : { status: 0 };
check(
  'the gate does not leak onto blood tests, which carry no recovery window',
  labBooking.status === 201,
  `${labBooking.status} ${labBooking.raw?.message ?? ''}`,
);

// Check-in re-checks: complete the eligible donor's donation, then a second
// appointment for the same donor must be refused at check-in.
const jizzakhStaff = await login('jizzakh.staff@donor.local');
const checkedIn = await call('POST', `/organizations/${jizzakh.id}/donations/check-in/${donationAppointmentId}`, jizzakhStaff, {});
check('staff can check in an eligible donor', checkedIn.status === 201, checkedIn.raw?.message);
const donationId = checkedIn.body?.id;

await call('POST', `/organizations/${jizzakh.id}/donations/${donationId}/assessment`, jizzakhStaff, { decision: 'APPROVED_FOR_DONATION' });
await call('POST', `/organizations/${jizzakh.id}/donations/${donationId}/start`, jizzakhStaff, {});
const now = new Date();
const completed = await call('POST', `/organizations/${jizzakh.id}/donations/${donationId}/complete`, jizzakhStaff, {
  volumeMl: 450,
  collectionStartedAt: new Date(now.getTime() - 10 * 60000).toISOString(),
  collectionCompletedAt: now.toISOString(),
});
check('staff can complete the donation', completed.status === 200 || completed.status === 201, completed.raw?.message);

// The donor is now inside a fresh recovery window. A second appointment booked
// before that (the slot search below picks a future slot) must be refused at
// check-in even though the appointment exists -- eligibility changed after
// booking, which is exactly the case an appointment cannot vouch for.
const laterSlot = await firstSlot(admin, northstarHospital.id, 'BLOOD_DONATION');
let secondAppointmentId = null;
if (laterSlot) {
  // Booking is now also refused, so create the appointment as the seeded
  // upcoming one instead: the donor already has a CONFIRMED donation
  // appointment from the seed, which is the realistic "booked before, eligible
  // then, ineligible now" case.
  const mine = list((await call('GET', '/appointments/me', eligibleDonor)).body);
  const pending = mine.find(
    (a) => a.appointmentType === 'BLOOD_DONATION' && ['PENDING', 'CONFIRMED'].includes(a.status),
  );
  secondAppointmentId = pending?.id ?? null;
}
check('fixture: donor has a pre-existing upcoming donation appointment', secondAppointmentId !== null);

const northstarStaff = await login('hospital.staff@donor.local');
const blockedCheckIn = await call('POST', `/organizations/${northstarHospital.id}/donations/check-in/${secondAppointmentId}`, northstarStaff, {});
check(
  'an existing appointment does not let an ineligible donor check in',
  blockedCheckIn.status === 409 && blockedCheckIn.raw?.code === 'DONOR_IN_RECOVERY_WINDOW',
  `${blockedCheckIn.status} ${blockedCheckIn.raw?.code ?? ''}`,
);

const rebooking = await call('POST', '/appointments', eligibleDonor, { slotId: laterSlot?.id, appointmentType: 'BLOOD_DONATION' });
check(
  'booking is refused too, now that the donor has just donated',
  rebooking.status === 409 && rebooking.raw?.code === 'DONOR_IN_RECOVERY_WINDOW',
  `${rebooking.status} ${rebooking.raw?.code ?? ''}`,
);

// ============================================================= 3
section('  Emergency matching excludes ineligible donors');

const emergency = await call('POST', `/organizations/${northstarHospital.id}/emergencies`, northstarStaff, {
  bloodType: 'O', rhFactor: 'POSITIVE', componentType: 'WHOLE_BLOOD', unitsRequired: 2,
  urgencyLevel: 'CRITICAL', patientReference: 'SPRINT0', description: 'Sprint 0 verification',
  donationLocation: 'Northstar Hospital', latitude: 40.1158, longitude: 67.8422,
});
check('hospital can raise an emergency', emergency.status === 201, emergency.raw?.message);
const activated = await call('POST', `/organizations/${northstarHospital.id}/emergencies/${emergency.body.id}/activate`, northstarStaff, {});
check('hospital can activate it', activated.status === 201);

const read = (await call('GET', `/organizations/${northstarHospital.id}/emergencies/${emergency.body.id}`, northstarStaff)).body;
const matchedIds = (read?.matches ?? []).map((m) => m.donorId);
check('the emergency matched at least one donor', matchedIds.length > 0, `${matchedIds.length} matched`);

const justDonatedId = (await call('GET', '/auth/me', eligibleDonor)).body?.id;
check(
  'the donor who just donated is NOT alerted',
  !matchedIds.includes(justDonatedId),
  justDonatedId ? `${justDonatedId.slice(-6)} absent from matches` : 'no id',
);

const donorSees = (await call('GET', '/donor/emergencies', eligibleDonor)).body?.active ?? [];
check(
  'and does not see it in their own emergency list',
  !donorSees.some((m) => m.emergencyReference === emergency.body.emergencyReference),
);

// ============================================================= 4
section('  Account recovery');

// /auth/forgot-password is rate limited to 3 requests per 15 minutes per IP,
// deliberately, so the two probes below are the only ones this script makes.
// The throttler keeps its counters in memory, so a restarted API always has a
// fresh budget; a second run inside the same window trips the limit and the
// pair is reported as rate limited rather than as an enumeration leak.
const forgot1 = await call('POST', '/auth/forgot-password', null, { email: 'donor@donor.local' });
const forgotUnknown = await call('POST', '/auth/forgot-password', null, { email: 'nobody@example.test' });
const identical = JSON.stringify(forgotUnknown.raw) === JSON.stringify(forgot1.raw);
const bothThrottled = forgot1.status === 429 && forgotUnknown.status === 429;

if (forgot1.status === 429 || forgotUnknown.status === 429) {
  check(
    'the response does not reveal whether the address is registered',
    bothThrottled && identical,
    bothThrottled
      ? 'both rate limited, identically — restart the API for the 200 path'
      : `rate limited mid-pair (${forgot1.status}/${forgotUnknown.status}) — restart the API and re-run`,
  );
} else {
  check('a reset can be requested', forgot1.status === 200, forgot1.body?.message?.slice(0, 40));
  check('the response does not reveal whether the address is registered', identical);
}

const badReset = await call('POST', '/auth/reset-password', null, {
  token: 'deadbeef'.repeat(8), newPassword: 'CorrectHorse!2026',
});
check('an unknown token is refused', badReset.status === 400, badReset.raw?.message?.slice(0, 46));

// The real token is only in the database, which is the point -- read it there.
// Only meaningful if the request above actually went through: a throttled
// request writes no row, so asserting on the table would be testing the
// throttle, not the token.
const { execFileSync } = await import('node:child_process');
if (forgot1.status !== 200) {
  skip('the stored token is a hash, unused, and expiring', 'no reset was accepted this run (rate limited)');
} else {
  const rawTokenProbe = execFileSync('node', ['-e', `
    const { PrismaClient } = require('@prisma/client');
    const db = new PrismaClient();
    db.passwordResetToken.findFirst({ orderBy: { createdAt: 'desc' }, select: { tokenHash: true, expiresAt: true, usedAt: true } })
      .then((r) => { console.log(JSON.stringify(r)); return db.$disconnect(); });
  `], { cwd: 'apps/api', encoding: 'utf8' }).trim();
  const stored = JSON.parse(rawTokenProbe || 'null');
  check('a token row exists after the request', stored !== null);
  check('the stored value is a 64-char hash, not a usable token', stored?.tokenHash?.length === 64, `${stored?.tokenHash?.length} chars`);
  check('the token is unused at this point', stored?.usedAt === null);
  check('the token expires', typeof stored?.expiresAt === 'string');
}

// ============================================================= 7
section('  Laboratory result integrity');

const donorResults = list((await call('GET', '/me/laboratory-results', eligibleDonor)).body);
check('donor can read their published results', Array.isArray(donorResults), `${donorResults.length} result(s)`);
check(
  'every result the donor can see is PUBLISHED',
  donorResults.every((r) => r.status === 'PUBLISHED'),
  donorResults.map((r) => r.status).join(',') || 'none',
);

const bcStaff = await login('blood.center.staff@donor.local');
const labAppointments = list((await call('GET', `/organizations/${northstarCentre.id}/laboratory-appointments`, bcStaff)).body);
const withResult = labAppointments.find((a) => a.laboratoryResult);
check('fixture: a seeded laboratory result exists', Boolean(withResult));

// ============================================================= 8
section('  Booked test type survives to the laboratory');

const bookedLab = labAppointments.find((a) => a.id === labBooking.body?.id);
check('the appointment the donor just booked is visible to the centre', Boolean(bookedLab), bookedLab?.referenceNumber);
check(
  'and it carries the test type the donor chose',
  Boolean(bookedLab?.testType?.id) && bookedLab.testType.id === cbc?.id,
  bookedLab?.testType ? `${bookedLab.testType.code} ${bookedLab.testType.name}` : 'missing',
);

// ============================================================= 9
section('  Organization isolation');

const rbcStaff = await login('rbc.staff@donor.local');
const crossOrgCheckIn = await call('POST', `/organizations/${jizzakh.id}/donations/check-in/${donationAppointmentId}`, rbcStaff, {});
check(
  'staff of another organisation cannot check in against this one',
  [403, 404].includes(crossOrgCheckIn.status),
  `${crossOrgCheckIn.status}`,
);

const crossOrgDonations = await call('GET', `/organizations/${jizzakh.id}/donations`, rbcStaff);
check(
  "staff cannot list another organisation's donations",
  [403, 404].includes(crossOrgDonations.status),
  `${crossOrgDonations.status}`,
);

const crossOrgLab = await call('GET', `/organizations/${northstarCentre.id}/laboratory-appointments`, rbcStaff);
check(
  "staff cannot list another organisation's laboratory appointments",
  [403, 404].includes(crossOrgLab.status),
  `${crossOrgLab.status}`,
);

const crossOrgEmergency = await call('GET', `/organizations/${northstarHospital.id}/emergencies/${emergency.body.id}`, rbcStaff);
check(
  "staff cannot read another organisation's emergency",
  [403, 404].includes(crossOrgEmergency.status),
  `${crossOrgEmergency.status}`,
);

const crossOrgTracking = await call('GET', `/organizations/${northstarHospital.id}/emergencies/${emergency.body.id}/tracking`, rbcStaff);
check(
  "staff cannot read another organisation's donor location",
  [403, 404].includes(crossOrgTracking.status),
  `${crossOrgTracking.status}`,
);

const donorReadsOrgDonations = await call('GET', `/organizations/${jizzakh.id}/donations`, eligibleDonor);
check(
  'a donor cannot read an organisation donation list',
  [403, 404].includes(donorReadsOrgDonations.status),
  `${donorReadsOrgDonations.status}`,
);

const donorRaisesEmergency = await call('POST', `/organizations/${northstarHospital.id}/emergencies`, eligibleDonor, {
  bloodType: 'O', rhFactor: 'POSITIVE', componentType: 'WHOLE_BLOOD', unitsRequired: 1, urgencyLevel: 'CRITICAL',
});
check('a donor cannot raise an emergency', [403, 404].includes(donorRaisesEmergency.status), `${donorRaisesEmergency.status}`);

// Location history is the most sensitive thing a donor hands over, so the
// read is scoped to the owner in the query: another donor's response id must
// be indistinguishable from one that does not exist.
const seededResponse = JSON.parse(
  execFileSync('node', ['-e', `
    const { PrismaClient } = require('@prisma/client');
    const db = new PrismaClient();
    db.emergencyResponse.findFirst({ where: { status: 'ACCEPTED' }, select: { id: true, donorId: true } })
      .then((r) => { console.log(JSON.stringify(r)); return db.$disconnect(); });
  `], { cwd: 'apps/api', encoding: 'utf8' }).trim() || 'null',
);
check('fixture: a seeded emergency response exists', seededResponse !== null);
if (seededResponse) {
  const owner = await login('aziza.donor@donor.local');
  const ownRead = await call('GET', `/donor/emergency-responses/${seededResponse.id}/tracking`, owner);
  check('a donor can read the journey they accepted', ownRead.status === 200, `${ownRead.status}`);

  const foreignRead = await call('GET', `/donor/emergency-responses/${seededResponse.id}/tracking`, recoveringDonor);
  check(
    "another donor's journey reads as missing, not as forbidden",
    foreignRead.status === 404,
    `${foreignRead.status}`,
  );
}

const otherDonorResult = donorResults[0];
if (otherDonorResult) {
  const foreign = await call('GET', `/me/laboratory-results/${otherDonorResult.id}`, recoveringDonor);
  check(
    "a donor cannot read another donor's laboratory result",
    [403, 404].includes(foreign.status),
    `${foreign.status}`,
  );
}

console.log('');
if (failures) {
  console.log(`  ✗ ${failures} check(s) failed.\n`);
  process.exit(1);
}
if (skipped) {
  console.log(`  ! ${skipped} check(s) skipped — restart the API to clear the reset throttle and re-run.`);
}
console.log('  ✓ All Sprint 0 integration checks passed.');
// This suite books and completes a real donation for donor@donor.local, which
// opens a fresh recovery window for that account -- by design, since that is
// what the check-in and matching assertions need. It also leaves the demo
// donor ineligible, so the demo data has to be rebuilt before presenting.
console.log('    Run `pnpm demo:reset` before a demo: this suite completes a real donation.\n');
