#!/usr/bin/env node
/**
 * Drives the three demo flows against the running local API, end to end.
 *
 * `demo:check` answers "is everything present". This answers the question that
 * actually matters the morning of a demo: "does the thing I am about to show
 * still work". Every step here is a real HTTP call producing a real database
 * change, in the same order the presenter will click through.
 *
 * Since Sprint 7 it does all of that against donors it creates for the run and
 * deletes at the end, and it no longer resets the database at all.
 *
 * What it used to do: run all three flows through `donor@donor.local` and, in
 * between, shell out to `pnpm demo:reset` -- three times. Two things followed
 * from that. The flows and `pnpm verify:safety` fought over one donor's
 * recovery window, so whichever ran second failed on a rule the first had just
 * proved. And the reset truncates every table while the API is still running,
 * which is not something a verification script should do to a live process:
 * the API re-seeds its gamification catalogue at boot, a regenerated Prisma
 * client makes `nest start --watch` reload, and the reset died on a unique
 * constraint somewhere in the middle, leaving a half-populated database and an
 * error pointing at achievements.
 *
 * Nothing about the flows or the rules they exercise has changed. What changed
 * is that each flow gets its own donor, with no history for the recovery window
 * to fire on, and the demo's own data is left exactly as it was found.
 */
import { assertLocalDatabase, fail } from './demo-guard.mjs';
import { cleanupAll, createScriptDonor, db, disconnect, tokenFor } from './verify-fixtures.mjs';

const API = process.env.DEMO_API_URL ?? 'http://localhost:3001';
const BASE = `${API}/api/v1`;

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

/**
 * A token for a seeded staff account, minted rather than fetched.
 *
 * This used to be `POST /auth/login`, which is rate limited to five attempts
 * per minute per IP -- deliberately, and this script signs in six actors. The
 * old advice was to restart the API with `AUTH_THROTTLE_LIMIT=100`, i.e. to
 * turn off a real protection so a verification script could run. The rate
 * limiter is shared global state like any other, and not depending on it is
 * what makes this script runnable back to back with `pnpm verify:safety`.
 *
 * The token is genuine and every guard validates it; see verify-fixtures.mjs.
 * The login route itself is covered end to end by app.e2e-spec.ts.
 */
async function login(email) {
  try {
    return await tokenFor(email);
  } catch (error) {
    fail(`${error.message}`);
  }
}

/** Donors this run created, deleted at the end however the run ends. */
const ownedDonors = [];

/** Emergencies this run raised. They belong to a hospital, not to a donor. */
const ownedEmergencyIds = [];

async function ownDonor(options) {
  const donor = await createScriptDonor(options);
  ownedDonors.push(donor);
  return donor;
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

/**
 * The donor's in-app notification raised *by this thing*, once it arrives.
 *
 * Matched on `sourceId` rather than on the notification type, because the seed
 * already gives the demo donor an appointment reminder, a laboratory result and
 * an emergency in their list: a check for "is there an APPOINTMENT
 * notification" passes before the demo has done anything at all. Every one of
 * these is raised by an event handler rather than by the request that triggered
 * it, so it lands a moment later -- see `eventually`.
 */
async function notificationFor(donor, sourceId) {
  const found = await eventually(
    async () =>
      list((await call('GET', '/notifications?limit=50', donor)).body).filter((n) => n.sourceId === sourceId),
    (rows) => rows.length > 0,
  );
  return found[0] ?? null;
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

  // This flow's own donor. It books a laboratory test rather than a donation,
  // so it carries no recovery window either way -- but giving each flow its own
  // donor is what lets the three run in any order, and lets the whole script
  // run repeatedly without a reset.
  const donorFixture = await ownDonor({ label: 'lab-flow', organizationId: SEED_ORG.id });
  const donor = donorFixture.token;

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

  const labNote = await notificationFor(donor, resultId);
  step('the donor is notified that this result is ready', labNote !== null,
    labNote?.title ?? 'no notification for the result just published');

  const one = (await call('GET', `/me/laboratory-results/${resultId}`, donor)).body;
  const flagged = (one?.items ?? []).filter((i) => i.flag && i.flag !== 'NOT_AVAILABLE');
  step(
    'values carry a reference flag, not "no reference"',
    flagged.length === items.length,
    `${flagged.length}/${items.length} flagged`,
  );

  // A second booking, so the flow has an upcoming appointment of its own for
  // health trends to surface.
  //
  // This used to lean on the seeded donor's history: `totalTests >= 2` counted
  // one result from the seed plus this one, and `nextUpcomingAppointment` was
  // an appointment the seed had left lying around. Both assertions were really
  // about the seed rather than about this flow, and neither survived the move
  // to a donor with no history. Booking one here makes them about what this run
  // actually did.
  let nextSlot = null;
  for (let offset = 1; offset < 7 && !nextSlot; offset += 1) {
    const res = await call(
      'GET',
      `/laboratories/${lab.id}/slots?testTypeId=${testType.id}&date=${dayAfter(offset)}`,
      donor,
    );
    const slots = list(res.body).filter((candidate) => candidate.id !== slot.id);
    if (res.status === 200 && slots.length) nextSlot = slots[0];
  }
  const nextBooking = nextSlot
    ? await call('POST', '/laboratory-appointments', donor, {
        laboratoryId: lab.id,
        testTypeId: testType.id,
        slotId: nextSlot.id,
      })
    : { status: 0 };
  step('donor books a follow-up test', nextBooking.status === 201, nextBooking.body?.referenceNumber);

  const trends = (await call('GET', '/me/health-trends', donor)).body;
  step('health trends include the new test', (trends?.totalTests ?? 0) >= 1, `${trends?.totalTests} tests`);
  step('a next test date is shown', Boolean(trends?.nextUpcomingAppointment));
}

// ---------------------------------------------------------------- flow B
async function sosFlow() {
  flow('Flow B — emergency SOS: match, accept, travel, arrive, complete');

  // Its own donor, with location consent, because this flow shares a journey
  // location. Completing an emergency donation opens a recovery window on
  // whoever made it -- which is exactly why this flow used to need a reset
  // after it, and why it no longer does.
  const donorFixture = await ownDonor({
    label: 'sos-flow',
    organizationId: SEED_ORG.id,
    bloodType: 'O',
    rhFactor: 'NEGATIVE',
    consentLocation: true,
    latitude: 40.115,
    longitude: 67.842,
  });
  const donor = donorFixture.token;
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
  ownedEmergencyIds.push(emergencyId);

  const activated = await call('POST', `/organizations/${hospital.id}/emergencies/${emergencyId}/activate`, staff, {});
  if (!step('hospital activates it', activated.status === 201)) return;

  const read = (await call('GET', `/organizations/${hospital.id}/emergencies/${emergencyId}`, staff)).body;
  step('the backend matched donors', (read?.matches?.length ?? 0) > 0, `${read?.matches?.length ?? 0} matches`);

  const active = (await call('GET', '/donor/emergencies', donor)).body?.active ?? [];
  const match = active.find((m) => m.emergencyReference === created.body.emergencyReference);
  if (!step('the request reaches the donor', Boolean(match))) return;

  const sosNote = await notificationFor(donor, emergencyId);
  step('and reaches their notifications, not just the SOS screen', sosNote !== null,
    sosNote?.title ?? 'no notification for the emergency just raised');
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

  // Its own donor, with no donation history, so the recovery window this flow
  // is about to open belongs to nobody else.
  const donorFixture = await ownDonor({ label: 'donation-flow', organizationId: SEED_ORG.id });
  const donor = donorFixture.token;

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

  const bookingNote = await notificationFor(donor, booked.body.id);
  step('the booking is confirmed in the donor\'s notifications', bookingNote !== null,
    bookingNote?.title ?? 'no notification for the appointment just booked');
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

/**
 * The organisation this run's donors belong to.
 *
 * Donors need an ACTIVE DONOR membership somewhere for emergency matching to
 * consider them, and it does not matter where -- the flows pick their own
 * hospital and laboratory by name. Resolved from a seeded staff account's own
 * membership rather than by asking for "the first blood centre", because the
 * Uzbekistan demo directory added seventeen organisations and `findFirst`
 * stopped meaning what it used to.
 */
const seedMembership = await db().organizationMembership.findFirst({
  where: { user: { email: 'blood.center.staff@donor.local' }, status: 'ACTIVE' },
  include: { organization: true },
});
if (!seedMembership) {
  fail('blood.center.staff@donor.local has no organisation. Run `pnpm demo:reset` once to seed the database.');
}
const SEED_ORG = seedMembership.organization;

// No resets between the flows, and none after.
//
// Each flow owns its donor, so the recovery window one flow opens cannot reach
// another, and nothing here touches the demo's own accounts. The three run in
// sequence because they share the API, not because they share state.
let runError = null;
try {
  await labFlow();
  await sosFlow();
  await donationFlow();
} catch (error) {
  runError = error;
} finally {
  // Everything else cascades off the donors: their appointments, donations,
  // blood units, laboratory bookings, notifications and emergency responses.
  // The emergency requests belong to a hospital, so they go explicitly.
  try {
    const prisma = db();
    if (ownedEmergencyIds.length > 0) {
      await prisma.emergencyMatch.deleteMany({ where: { emergencyRequestId: { in: ownedEmergencyIds } } });
      await prisma.emergencyResponse.deleteMany({ where: { emergencyRequestId: { in: ownedEmergencyIds } } });
      await prisma.emergencyRequest.deleteMany({ where: { id: { in: ownedEmergencyIds } } });
    }
  } finally {
    await cleanupAll(ownedDonors);
    await disconnect();
  }
}

if (runError) {
  fail(`${runError.stack ?? runError.message ?? runError}`);
}

console.log('');
if (failures) {
  console.log(`  ✗ ${failures} step(s) failed.\n`);
  process.exit(1);
}
console.log('  ✓ All three flows work end to end.');
console.log('    This run owned its own donors and deleted them; the demo data is untouched.\n');
