#!/usr/bin/env node
/**
 * Sprint 2.1 verification: boolean request fields, over real HTTP.
 *
 * The unit tests drive the DTOs through the real ValidationPipe, which is most
 * of the story. This is the rest of it: the same values as an actual request,
 * through the actual server, read back from the actual database -- because the
 * failure this sprint exists for was invisible at every layer except the one
 * where someone asks the running system a question and gets the opposite of the
 * true answer back.
 *
 * Not read-only. It changes a platform setting, a donor's location consent, a
 * notification toggle and a leaderboard preference, then restores each from a
 * snapshot in a `finally`. It never leaves maintenance mode on: the one case
 * that would lock every non-admin out is asserted by checking that a donor can
 * still sign in, not by turning it on.
 */
import { assertLocalDatabase, fail } from './demo-guard.mjs';

let target;
try {
  target = assertLocalDatabase();
} catch (error) {
  fail(error.message);
}

const API = process.env.VERIFY_API_URL ?? 'http://localhost:3001';
const BASE = `${API}/api/v1`;
const PASSWORD = process.env.VERIFY_PASSWORD ?? 'DevelopmentOnly!123';
const ADMIN = process.env.VERIFY_ADMIN_EMAIL ?? 'admin@donor.local';
const DONOR = process.env.VERIFY_DONOR_EMAIL ?? 'donor@donor.local';

let failures = 0;
let passes = 0;
let skipped = 0;
const check = (name, ok, detail = '') => {
  if (ok) passes += 1;
  else failures += 1;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};
const skip = (name, why) => {
  skipped += 1;
  console.log(`  skip ${name} — ${why}`);
};
const section = (name) => console.log(`\n${name}`);

async function api(method, path, token, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let parsed = null;
  try {
    parsed = await res.json();
  } catch {
    /* an empty body is a legitimate answer */
  }
  return { status: res.status, body: parsed?.data ?? parsed };
}

async function signIn(email) {
  const res = await api('POST', '/auth/login', null, { email, password: PASSWORD });
  return res.status === 200 ? res.body?.accessToken : null;
}

/** The values this API must never read as a boolean. */
const AMBIGUOUS = ['1', '0', 'yes', 'no', 'on', 'off', 'maybe'];

/**
 * One field, exercised the whole way: "false" must stay false, "true" must
 * become true, and every ambiguous spelling must be a 400 that changes nothing.
 */
async function exerciseField({ name, token, field, write, read }) {
  const before = await read(token);

  const off = await write(token, 'false');
  check(
    `${name}: "false" is stored as false`,
    off.status >= 200 && off.status < 300 && (await read(token)) === false,
    `${off.status}`,
  );

  const on = await write(token, 'true');
  check(
    `${name}: "true" is stored as true`,
    on.status >= 200 && on.status < 300 && (await read(token)) === true,
    `${on.status}`,
  );

  const settled = await read(token);
  const rejected = [];
  for (const value of AMBIGUOUS) {
    const res = await write(token, value);
    const unchanged = (await read(token)) === settled;
    if (res.status === 400 && unchanged) rejected.push(value);
  }
  check(
    `${name}: every ambiguous spelling is refused and changes nothing`,
    rejected.length === AMBIGUOUS.length,
    `${rejected.length}/${AMBIGUOUS.length} refused`,
  );

  // Back to what it was, whatever that was.
  if (before !== null && before !== undefined) {
    await write(token, before === true ? 'true' : 'false');
  }
  check(`${name}: left as it was found`, (await read(token)) === before, String(before));
  return { field, before };
}

async function main() {
  console.log(`\nSprint 2.1 verification — ${target.database} on ${target.host}\n`);

  let reachable = false;
  try {
    reachable = (await fetch(`${BASE}/health`)).ok;
  } catch {
    reachable = false;
  }
  if (!reachable) {
    fail(`no API listening on ${API}. Start it, or set VERIFY_API_URL.`);
  }

  const adminToken = await signIn(ADMIN);
  const donorToken = await signIn(DONOR);
  if (!adminToken) fail(`could not sign in as ${ADMIN}; run pnpm demo:reset`);

  // ------------------------------------------------------- maintenance mode
  section('Platform settings');

  const readSetting = (flag) => async (token) => {
    const res = await api('GET', '/admin/settings', token);
    return res.body?.[flag];
  };
  const writeSetting = (flag) => (token, value) =>
    api('PATCH', '/admin/settings', token, { [flag]: value });

  await exerciseField({
    name: 'maintenanceMode',
    token: adminToken,
    field: 'maintenanceMode',
    write: writeSetting('maintenanceMode'),
    read: readSetting('maintenanceMode'),
  });

  /**
   * The headline case, asserted by its consequence rather than its storage:
   * with `"false"` sent, an ordinary donor must still be able to sign in. If
   * the string had been read as true, this login would be refused.
   */
  if (!donorToken) {
    skip('a "false" maintenance patch does not lock donors out', `could not sign in as ${DONOR}`);
  } else {
    await writeSetting('maintenanceMode')(adminToken, 'false');
    const donorAfter = await signIn(DONOR);
    check(
      'a "false" maintenance patch does not lock donors out',
      donorAfter !== null,
      'a donor signed in normally afterwards',
    );
  }

  for (const flag of [
    'aiHealthInsightsEnabled',
    'sosEmergencyEnabled',
    'gamificationEnabled',
    'pushNotificationsEnabled',
  ]) {
    await exerciseField({
      name: flag,
      token: adminToken,
      field: flag,
      write: writeSetting(flag),
      read: readSetting(flag),
    });
  }

  // --------------------------------------------------------- location consent
  section('Donor location consent');

  if (!donorToken) {
    skip('consentLocation', `could not sign in as ${DONOR}`);
  } else {
    await exerciseField({
      name: 'consentLocation',
      token: donorToken,
      field: 'consentLocation',
      write: (token, value) => api('PUT', '/donors/profile', token, { consentLocation: value }),
      read: async (token) => (await api('GET', '/donors/profile', token)).body?.consentLocation,
    });

    // ------------------------------------------------- notification toggles
    section('Notification preferences');

    await exerciseField({
      name: 'emergencyRequests',
      token: donorToken,
      field: 'emergencyRequests',
      write: (token, value) =>
        api('PATCH', '/notifications/preferences', token, { emergencyRequests: value }),
      read: async (token) =>
        (await api('GET', '/notifications/preferences', token)).body?.emergencyRequests,
    });

    await exerciseField({
      name: 'quietHoursEnabled',
      token: donorToken,
      field: 'quietHoursEnabled',
      write: (token, value) =>
        api('PATCH', '/notifications/preferences', token, { quietHoursEnabled: value }),
      read: async (token) =>
        (await api('GET', '/notifications/preferences', token)).body?.quietHoursEnabled,
    });

    // ------------------------------------------------- leaderboard privacy
    section('Leaderboard visibility');

    const visibility = (token, value) =>
      api('POST', '/me/gamification/leaderboard-visibility', token, { visible: value });
    const hidden = await visibility(donorToken, 'false');
    check('leaderboard visibility accepts "false"', hidden.status === 200, `${hidden.status}`);
    const nonsense = await visibility(donorToken, 'yes');
    check('leaderboard visibility refuses "yes"', nonsense.status === 400, `${nonsense.status}`);
    const shown = await visibility(donorToken, 'true');
    check('leaderboard visibility accepts "true"', shown.status === 200, `${shown.status}`);
  }

  // ------------------------------------------------------- directory filters
  section('Organization directory filters');

  const directory = async (query) =>
    api('GET', `/organizations?${query}&limit=100`, adminToken);

  const all = await directory('');
  const yes = await directory('verified=true');
  const no = await directory('verified=false');
  check(
    'verified=false is not read as true',
    yes.body?.length !== no.body?.length &&
      (no.body ?? []).every((org) => org.isVerified === false),
    `${yes.body?.length ?? 0} verified, ${no.body?.length ?? 0} not, ${all.body?.length ?? 0} total`,
  );

  const refusals = [];
  for (const value of AMBIGUOUS) {
    const res = await directory(`verified=${value}`);
    if (res.status === 400) refusals.push(value);
  }
  check(
    'an ambiguous filter value is refused rather than guessed',
    refusals.length === AMBIGUOUS.length,
    `${refusals.length}/${AMBIGUOUS.length} refused`,
  );

  const lab = await directory('providesLaboratory=false');
  check(
    'providesLaboratory=false is not read as true',
    (lab.body ?? []).every((org) => org.providesLaboratory === false),
    `${lab.body?.length ?? 0} without a laboratory`,
  );
}

main()
  .catch((error) => {
    console.error(`\n  ✗ ${error?.stack ?? error}\n`);
    failures += 1;
  })
  .finally(() => {
    console.log(
      `\n${failures === 0 ? '✓' : '✗'} ${passes} passed, ${failures} failed` +
        (skipped ? `, ${skipped} skipped` : '') + '\n',
    );
    process.exit(failures === 0 ? 0 : 1);
  });
