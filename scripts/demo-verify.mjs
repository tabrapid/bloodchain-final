#!/usr/bin/env node
/**
 * Drives the three demo flows against the running local API, end to end.
 *
 * `demo:check` answers "is everything present". This answers the question that
 * actually matters the morning of a demo: "does the thing I am about to show
 * still work". Every step here is a real HTTP call producing a real database
 * change, in the same order the presenter will click through.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertLocalDatabase, fail } from './demo-guard.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = process.env.DEMO_API_URL ?? 'http://localhost:3001';
const BASE = `${API}/api/v1`;
const PW = 'DevelopmentOnly!123';

try {
  assertLocalDatabase();
} catch (error) {
  fail(error.message);
}

let failures = 0;
let currentFlow = '';

function step(name, ok, detail = '') {
  if (!ok) failures += 1;
  console.log(`    ${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  return ok;
}

function flow(name) {
  currentFlow = name;
  console.log(`\n  ${name}`);
}

/**
 * One retry on a transport error -- but only for GET.
 *
 * This script pauses for several seconds while a reset truncates the database,
 * and Node reuses keep-alive sockets across that gap, so the first call after a
 * reset can land on a connection the server has since closed and fail with
 * "other side closed".
 *
 * Retrying that blindly is worse than the problem: a POST whose response was
 * lost may well have succeeded, and re-sending it books the slot twice -- the
 * retry then fails with "slot no longer available" and the run reports a
 * booking bug that does not exist. That is exactly what made this script flaky.
 * GET is safe to repeat; everything else is not, so the connection is warmed
 * with a GET after each reset instead (see `reset`).
 */
async function call(method, path, token, body, attempt = 0) {
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    if (method === 'GET' && attempt === 0) return call(method, path, token, body, 1);
    throw error;
  }
  let parsed = {};
  try {
    parsed = await res.json();
  } catch {
    /* empty body */
  }
  return { status: res.status, body: parsed?.data ?? parsed, raw: parsed };
}

function list(body) {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.items)) return body.items;
  return [];
}

async function login(email) {
  const res = await call('POST', '/auth/login', null, { email, password: PW });
  if (res.status === 429) {
    fail(
      'Rate limited while signing in. Sign-in allows 5 attempts per minute per IP. ' +
        'Restart the API with AUTH_THROTTLE_LIMIT=100 (pnpm demo:start does this) and re-run.',
    );
  }
  if (res.status !== 200) {
    fail(`Could not sign in as ${email} (${res.status}). Run pnpm demo:reset first.`);
  }
  return res.body.accessToken;
}

async function reset() {
  console.log('\n  Resetting to the seeded starting state...');
  execFileSync('node', [path.join(root, 'scripts', 'demo-reset.mjs')], {
    cwd: root,
    stdio: ['ignore', 'ignore', 'pipe'],
    env: process.env,
  });
  // Spend the stale keep-alive socket on a request that is safe to repeat, so
  // the first real call of the next flow starts on a live connection.
  await call('GET', '/health');
}

/**
 * Waits for a value that arrives on an event rather than in the response.
 *
 * XP, achievements and notifications are awarded by handlers listening for
 * DONATION_COMPLETED, so they land a moment after the call that triggers them
 * returns. Reading once, immediately, reports "no XP awarded" for what is only
 * a few hundred milliseconds of lag -- a real client refetches, and so does
 * this. It gives up rather than hanging, so a genuine regression still fails.
 */
async function eventually(read, satisfied, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  let value = await read();
  while (!satisfied(value) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    value = await read();
  }
  return value;
}

const today = () => new Date().toISOString().slice(0, 10);
const dayAfter = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

async function firstSlot(token, organizationId, type) {
  for (let offset = 0; offset < 6; offset += 1) {
    const res = await call(
      'GET',
      `/appointments/availability?organizationId=${organizationId}&appointmentType=${type}&date=${dayAfter(offset)}`,
      token,
    );
    const slots = list(res.body);
    if (res.status === 200 && slots.length) return slots[0];
  }
  return null;
}

// ---------------------------------------------------------------- flow C
async function labFlow() {
  flow('Flow C — blood test: book, collect, publish, donor sees the result');
  const donor = await login('donor@donor.local');

  const labs = list((await call('GET', '/laboratories', donor)).body);
  if (!step('donor can list laboratories', labs.length >= 2, `${labs.length} found`)) return;
  const lab = labs[0];

  const detail = (await call('GET', `/laboratories/${lab.id}`, donor)).body;
  const testTypes = detail?.laboratoryProfile?.testTypes ?? [];
  if (!step('laboratory exposes test types', testTypes.length > 0)) return;
  const testType = testTypes[0];

  let slot = null;
  for (let offset = 0; offset < 6 && !slot; offset += 1) {
    const res = await call(
      'GET',
      `/laboratories/${lab.id}/slots?testTypeId=${testType.id}&date=${dayAfter(offset)}`,
      donor,
    );
    const slots = list(res.body);
    if (res.status === 200 && slots.length) slot = slots[0];
  }
  if (!step('a laboratory slot is bookable', slot !== null)) return;

  const booked = await call('POST', '/laboratory-appointments', donor, {
    laboratoryId: lab.id,
    testTypeId: testType.id,
    slotId: slot.id,
  });
  if (!step('donor books the test', booked.status === 201, booked.body?.referenceNumber)) return;
  const appointmentId = booked.body.id;

  const staff = await login('blood.center.staff@donor.local');
  const staffList = list((await call('GET', `/organizations/${lab.id}/laboratory-appointments`, staff)).body);
  step(
    'booking reaches the blood centre console',
    staffList.some((a) => a.id === appointmentId),
  );

  for (const action of ['confirm', 'check-in', 'start', 'complete']) {
    const res = await call('POST', `/organizations/${lab.id}/laboratory-appointments/${appointmentId}/${action}`, staff, {});
    if (!step(`staff: ${action}`, res.status === 200 || res.status === 201, res.raw?.message)) return;
  }

  const VALUES = {
    HEMOGLOBIN: ['14.2', 14.2],
    RBC: ['4.9', 4.9],
    WBC: ['6800', 6800],
    HEMATOCRIT: ['42.5', 42.5],
    PLATELETS: ['250000', 250000],
    FERRITIN_LEVEL: ['95', 95],
  };
  const params = testTypes.find((t) => t.id === testType.id)?.parameters ?? [];
  const items = params.map((p) => {
    const [value, numericValue] = VALUES[p.code] ?? ['1', 1];
    return { parameterId: p.id, value, numericValue, ...(p.unit ? { unit: p.unit } : {}) };
  });
  const entered = await call('POST', `/organizations/${lab.id}/laboratory-results`, staff, {
    appointmentId,
    testTypeId: testType.id,
    items,
  });
  if (!step('staff enter the results', entered.status === 201, entered.raw?.message)) return;
  const resultId = entered.body.id;

  const reviewer = await login('lab.reviewer@donor.local');
  step('reviewer reviews', (await call('POST', `/organizations/${lab.id}/laboratory-results/${resultId}/review`, reviewer, {})).status === 201);
  step('reviewer publishes', (await call('POST', `/organizations/${lab.id}/laboratory-results/${resultId}/publish`, reviewer, {})).status === 201);

  const mine = list((await call('GET', '/me/laboratory-results', donor)).body);
  step('donor sees the published result', mine.some((r) => r.id === resultId));

  const one = (await call('GET', `/me/laboratory-results/${resultId}`, donor)).body;
  const flagged = (one?.items ?? []).filter((i) => i.flag && i.flag !== 'NOT_AVAILABLE');
  step(
    'values carry a reference flag, not "no reference"',
    flagged.length === items.length,
    `${flagged.length}/${items.length} flagged`,
  );

  const trends = (await call('GET', '/me/health-trends', donor)).body;
  step('health trends include the new test', (trends?.totalTests ?? 0) >= 2, `${trends?.totalTests} tests`);
  step('a next test date is shown', Boolean(trends?.nextUpcomingAppointment));
}

// ---------------------------------------------------------------- flow B
async function sosFlow() {
  flow('Flow B — emergency SOS: match, accept, travel, arrive, complete');
  const donor = await login('donor@donor.local');
  const staff = await login('hospital.staff@donor.local');

  const profile = (await call('GET', '/donors/profile', donor)).body;
  const hospitals = list((await call('GET', '/organizations/discover?type=HOSPITAL&limit=100', donor)).body);
  const hospital = hospitals.find((o) => o.name.includes('Northstar')) ?? hospitals[0];
  if (!step('a hospital is available', Boolean(hospital))) return;

  const created = await call('POST', `/organizations/${hospital.id}/emergencies`, staff, {
    bloodType: profile.bloodType,
    rhFactor: profile.rhFactor,
    componentType: 'WHOLE_BLOOD',
    unitsRequired: 2,
    urgencyLevel: 'CRITICAL',
    patientReference: 'VERIFY-01',
    description: 'Automated verification run',
    donationLocation: hospital.name,
    latitude: 40.1158,
    longitude: 67.8422,
  });
  if (!step('hospital creates the request', created.status === 201, created.raw?.message)) return;
  const emergencyId = created.body.id;

  const activated = await call('POST', `/organizations/${hospital.id}/emergencies/${emergencyId}/activate`, staff, {});
  if (!step('hospital activates it', activated.status === 201)) return;

  const read = (await call('GET', `/organizations/${hospital.id}/emergencies/${emergencyId}`, staff)).body;
  step('the backend matched donors', (read?.matches?.length ?? 0) > 0, `${read?.matches?.length ?? 0} matches`);

  const active = (await call('GET', '/donor/emergencies', donor)).body?.active ?? [];
  const match = active.find((m) => m.emergencyReference === created.body.emergencyReference);
  if (!step('the request reaches the donor', Boolean(match))) return;
  const matchId = match.matchId ?? match.id;

  step('donor opens it', (await call('POST', `/donor/emergency-matches/${matchId}/view`, donor, {})).status === 201);
  const accepted = await call('POST', `/donor/emergency-matches/${matchId}/accept`, donor, {});
  if (!step('donor accepts', accepted.status === 201, accepted.raw?.message)) return;
  const responseId = accepted.body.id;

  step('donor starts the journey', (await call('POST', `/donor/emergency-responses/${responseId}/start-journey`, donor, {})).status === 201);
  step(
    'donor shares a location',
    (await call('POST', `/donor/emergency-responses/${responseId}/update-location`, donor, { latitude: 40.112, longitude: 67.838 })).status === 201,
  );

  const tracking = (await call('GET', `/organizations/${hospital.id}/emergencies/${emergencyId}/tracking`, staff)).body;
  step('hospital sees the donor en route', tracking?.status === 'DONOR_EN_ROUTE', tracking?.status);

  step('donor marks arrival', (await call('POST', `/donor/emergency-responses/${responseId}/arrive`, donor, {})).status === 201);
  step('hospital confirms arrival', (await call('POST', `/organizations/${hospital.id}/emergency-responses/${responseId}/confirm-arrival`, staff, {})).status === 201);

  const before = (await call('GET', '/donations/me/statistics', donor)).body;
  const completed = await call('POST', `/organizations/${hospital.id}/emergency-responses/${responseId}/complete`, staff, { volumeMl: 450 });
  if (!step('staff complete it with a volume', completed.status === 201, completed.raw?.message)) return;

  const after = await eventually(
    async () => (await call('GET', '/donations/me/statistics', donor)).body,
    (s) => s.totalVolumeMl === before.totalVolumeMl + 450,
  );
  step(
    'the donation lands in the donor stats',
    after.totalVolumeMl === before.totalVolumeMl + 450,
    `${before.totalVolumeMl} → ${after.totalVolumeMl} mL`,
  );
  step('eligibility moves forward', new Date(after.nextDonationDate) > new Date(), after.nextDonationDate?.slice(0, 10));
}

// ---------------------------------------------------------------- flow A
async function donationFlow() {
  flow('Flow A — donation: book, check in, collect, donor sees the volume');
  const donor = await login('donor@donor.local');

  const orgs = list((await call('GET', '/organizations/discover?limit=100', donor)).body);
  step('several organisations are bookable', orgs.length >= 5, `${orgs.length} listed`);
  const target = orgs.find((o) => o.name === 'Jizzakh City Hospital') ?? orgs[0];

  const slot = await firstSlot(donor, target.id, 'BLOOD_DONATION');
  if (!step(`a slot is free at ${target.name}`, slot !== null)) return;

  const booked = await call('POST', '/appointments', donor, {
    slotId: slot.id,
    appointmentType: 'BLOOD_DONATION',
  });
  if (!step('donor books it', booked.status === 201, booked.body?.referenceNumber ?? `${booked.status} ${booked.raw?.message ?? ''}`)) return;
  const appointmentId = booked.body.id;
  step('the reference is labelled as a donation', String(booked.body.referenceNumber).startsWith('DON-'));

  const staff = await login('jizzakh.staff@donor.local');
  // The console's queue is per-day: `today-appointments` is the right list only
  // when the free slot the donor took is today. Late in the day every remaining
  // slot is tomorrow's, so the date-independent check-in lookup -- the same call
  // the console makes when staff open a booking -- is what proves it arrived.
  const bookedDay = String(slot.startAt).slice(0, 10);
  const isToday = bookedDay === new Date().toISOString().slice(0, 10);
  if (isToday) {
    const todays = list((await call('GET', `/organizations/${target.id}/donations/today-appointments`, staff)).body);
    step("booking reaches that hospital's console", todays.some((a) => a.id === appointmentId), `today (${bookedDay})`);
  } else {
    const details = await call('GET', `/organizations/${target.id}/donations/check-in/${appointmentId}`, staff);
    step(
      "booking reaches that hospital's console",
      details.status === 200 && details.body?.appointment?.id === appointmentId,
      `scheduled ${bookedDay}, opened from the check-in queue`,
    );
  }

  const checkedIn = await call('POST', `/organizations/${target.id}/donations/check-in/${appointmentId}`, staff, {});
  if (!step('staff check the donor in', checkedIn.status === 201, checkedIn.raw?.message)) return;
  const donationId = checkedIn.body.id;

  step(
    'staff record the assessment',
    (await call('POST', `/organizations/${target.id}/donations/${donationId}/assessment`, staff, { decision: 'APPROVED_FOR_DONATION' })).status === 201,
  );
  step('staff start collection', (await call('POST', `/organizations/${target.id}/donations/${donationId}/start`, staff, {})).status === 200);

  const xpBefore = (await call('GET', '/me/gamification', donor)).body?.totalXp ?? 0;
  const now = new Date();
  const done = await call('POST', `/organizations/${target.id}/donations/${donationId}/complete`, staff, {
    volumeMl: 475,
    collectionStartedAt: new Date(now.getTime() - 10 * 60000).toISOString(),
    collectionCompletedAt: now.toISOString(),
  });
  if (!step('staff complete it with 475 mL', done.status === 200 || done.status === 201, done.raw?.message)) return;

  const history = list((await call('GET', '/donations/me', donor)).body);
  const newest = history[0];
  step('donor history shows the same 475 mL', newest?.volumeMl === 475, `${newest?.volumeMl} mL`);
  step('recorded against the right organisation', newest?.organization?.name === target.name, newest?.organization?.name);

  const stats = (await call('GET', '/donations/me/statistics', donor)).body;
  step('total volume includes it', stats.totalVolumeMl >= 475, `${stats.totalVolumeMl} mL`);
  step('eligibility moves forward', new Date(stats.nextDonationDate) > new Date(), stats.nextDonationDate?.slice(0, 10));

  const xpAfter = await eventually(
    async () => (await call('GET', '/me/gamification', donor)).body?.totalXp ?? 0,
    (xp) => xp > xpBefore,
  );
  step('the donor earns XP', xpAfter > xpBefore, `${xpBefore} → ${xpAfter}`);

  const notes = await eventually(
    async () => list((await call('GET', '/notifications', donor)).body),
    (n) => n.some((x) => x.type === 'DONATION'),
  );
  step('a notification is raised', notes.some((n) => n.type === 'DONATION'));

  const appts = list((await call('GET', '/appointments/me', donor)).body);
  step('the appointment closes', appts.find((a) => a.id === appointmentId)?.status === 'COMPLETED');
}

// ---------------------------------------------------------------- run
console.log('\n  Bloodchain demo verification');

try {
  await fetch(`${BASE}/health`);
} catch {
  fail(`The API is not answering at ${API}. Start it with pnpm demo:start.`);
}

await reset();
await labFlow();
// The SOS completes a donation, which puts the donor inside the recovery
// window -- so the booked donation needs a clean slate after it.
await sosFlow();
await reset();
await donationFlow();
await reset();

console.log('');
if (failures) {
  console.log(`  ✗ ${failures} step(s) failed.\n`);
  process.exit(1);
}
console.log('  ✓ All three flows work end to end. Demo data is back at its starting state.\n');
