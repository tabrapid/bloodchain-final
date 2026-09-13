#!/usr/bin/env node
/**
 * Pre-presentation health check: PASS/FAIL for everything the demo depends on.
 *
 * The point is to find a broken dependency five minutes before presenting
 * rather than in front of an audience, so every check here is something that
 * has actually blocked a run-through: the database being down, the API not
 * listening, a portal not started, a seeded account that no longer exists, an
 * organisation with no bookable slot left.
 */
import net from 'node:net';
import { networkInterfaces } from 'node:os';
import { assertLocalDatabase, fail } from './demo-guard.mjs';
import { macFirewall } from './demo-firewall.mjs';
import { checkPrismaClient } from './demo-prisma.mjs';

const API = process.env.DEMO_API_URL ?? 'http://localhost:3001';
const BASE = `${API}/api/v1`;
const PW = 'DevelopmentOnly!123';
const PORTALS = [
  ['Hospital portal', process.env.DEMO_HOSPITAL_URL ?? 'http://localhost:3000'],
  ['Blood center portal', process.env.DEMO_BLOOD_CENTER_URL ?? 'http://localhost:3002'],
  ['Admin portal', process.env.DEMO_ADMIN_URL ?? 'http://localhost:3003'],
];

const results = [];
const record = (name, ok, detail = '', soft = false) => {
  results.push({ name, ok, detail, soft });
  const mark = ok ? 'PASS' : soft ? 'WARN' : 'FAIL';
  console.log(`  ${mark.padEnd(4)}  ${name}${detail ? ` — ${detail}` : ''}`);
};

async function get(path, token) {
  const res = await fetch(BASE + path, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body: body?.data ?? body };
}

/**
 * Returns the token, or a reason it could not be had.
 *
 * A 429 is not a bad password, and reporting it as "login refused" is how a
 * throttled run gets misread as broken seed data -- sign-in allows five
 * attempts per minute per IP and this script makes nine, so running it twice in
 * a minute reports every account as failing. The two have to be told apart.
 */
async function login(email) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PW }),
  });
  if (res.status === 429) return { token: null, throttled: true };
  if (!res.ok) return { token: null, throttled: false };
  const body = await res.json();
  return { token: body?.data?.accessToken ?? null, throttled: false };
}

async function reachable(url) {
  try {
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(4000) });
    return res.status < 500;
  } catch {
    return false;
  }
}

console.log('\n  Bloodchain demo health check\n');

let target;
try {
  target = assertLocalDatabase();
  record('Database target is local', true, `${target.database} @ ${target.host}`);
} catch (error) {
  record('Database target is local', false, error.message);
}

const prisma = checkPrismaClient();
if (prisma) {
  record(
    'Prisma client matches the schema',
    prisma.missing.length === 0,
    prisma.missing.length
      ? `generated from an older schema — missing ${prisma.missing.join(', ')}. ` +
        'Run `pnpm db:generate` (or `pnpm demo:reset`, which now does it first). ' +
        'Until then the API will not compile and the seed cannot run, so every ' +
        'other failure below is downstream of this one.'
      : 'up to date',
  );
}

let apiUp = false;
try {
  const res = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(4000) });
  apiUp = res.ok;
  record('API is listening', apiUp, `${API} → ${res.status}`);
} catch (error) {
  record('API is listening', false, `${API} unreachable (${error.message})`);
}

if (apiUp) {
  const accounts = [
    'donor@donor.local',
    'recent.donor@donor.local',
    'hospital.staff@donor.local',
    'jizzakh.staff@donor.local',
    'arnasoy.staff@donor.local',
    'blood.center.staff@donor.local',
    'rbc.staff@donor.local',
    'lab.reviewer@donor.local',
    'admin@donor.local',
  ];
  const tokens = {};
  let throttled = false;
  for (const email of accounts) {
    const result = await login(email);
    tokens[email] = result.token;
    if (result.throttled) {
      throttled = true;
    } else if (!result.token) {
      record(`Sign in: ${email}`, false, 'login refused — wrong password, or the account is not seeded');
    }
  }
  const signedIn = accounts.filter((e) => tokens[e]).length;
  if (throttled) {
    record(
      'Seeded accounts can sign in',
      false,
      `${signedIn}/${accounts.length} — rate limited before finishing. Sign-in allows 5 attempts per minute ` +
        'per IP and this check makes nine. Restart the API with AUTH_THROTTLE_LIMIT=100 (pnpm demo:start does ' +
        'this), or wait a minute and re-run.',
    );
  } else {
    record('Seeded accounts can sign in', signedIn === accounts.length, `${signedIn}/${accounts.length}`);
  }

  const donor = tokens['donor@donor.local'];
  if (donor) {
    const orgs = await get('/organizations/discover', donor);
    const list = Array.isArray(orgs.body) ? orgs.body : (orgs.body?.items ?? []);
    const hospitals = list.filter((o) => o.type === 'HOSPITAL').length;
    const centers = list.filter((o) => o.type === 'BLOOD_CENTER').length;
    record('Organizations seeded', hospitals >= 3 && centers >= 2,
      `${hospitals} hospitals, ${centers} blood centers`);

    const labs = await get('/laboratories', donor);
    const labList = Array.isArray(labs.body) ? labs.body : (labs.body?.items ?? []);
    record('Laboratories available', labList.length >= 2, `${labList.length} laboratories`);

    // Look across the next few days, not just today. Slots run 09:00-11:00 and
    // 14:00-16:00, so a check run at 17:00 would report every organisation as
    // unbookable and send someone reseeding an hour before presenting -- when
    // booking tomorrow is a perfectly good demo.
    const day = (offset) => {
      const d = new Date();
      d.setDate(d.getDate() + offset);
      return d.toISOString().slice(0, 10);
    };
    let bookable = 0;
    let soonest = null;
    for (const org of list) {
      for (let offset = 0; offset < 5; offset += 1) {
        const av = await get(
          `/appointments/availability?organizationId=${org.id}&appointmentType=BLOOD_DONATION&date=${day(offset)}`,
          donor,
        );
        const slots = Array.isArray(av.body) ? av.body : (av.body?.items ?? av.body?.slots ?? []);
        if (slots.length) {
          bookable += 1;
          if (soonest === null || offset < soonest) soonest = offset;
          break;
        }
      }
    }
    const when = soonest === 0 ? 'today' : soonest === 1 ? 'from tomorrow' : `in ${soonest} days`;
    record('Donation slots are bookable', bookable >= 3,
      `${bookable}/${list.length} organizations${soonest === null ? '' : `, soonest ${when}`}`);

    const stats = await get('/donations/me/statistics', donor);
    const next = stats.body?.nextDonationDate;
    const eligible = !next || new Date(next) <= new Date();
    record('Demo donor is eligible to donate', eligible,
      next ? `next eligible ${String(next).slice(0, 10)}` : 'no cooldown on record');

    for (const [label, path, min] of [
      ['Community feed', '/community/feed', 1],
      ['Campaigns', '/campaigns', 1],
      ['Challenges', '/challenges', 1],
      ['Education modules', '/education', 1],
      ['Leaderboard', '/leaderboard', 2],
      ['Notifications', '/notifications', 1],
    ]) {
      const r = await get(path, donor);
      const b = r.body;
      const count = Array.isArray(b) ? b.length : (b?.items?.length ?? b?.entries?.length ?? 0);
      record(`Content: ${label}`, count >= min, `${count} item(s)`);
    }
  }

  const hospitalStaff = tokens['hospital.staff@donor.local'];
  if (hospitalStaff) {
    const em = await get('/donor/emergencies', tokens['donor@donor.local']);
    record('Emergency endpoints reachable', em.status === 200, `status ${em.status}`);
  }
}

for (const [name, url] of PORTALS) {
  const ok = await reachable(url);
  // A portal that is not started yet is a warning: the demo may only need one.
  record(name, ok, url, true);
}

/**
 * A mail catcher is optional -- without one the API logs the message instead
 * of sending it, which still works, just less legibly. So this is a warning
 * with the remedy in it, not a failure.
 */
const mailPort = Number(process.env.DEV_MAIL_PORT ?? 1025);
const mailUp = await new Promise((resolve) => {
  const socket = net.connect({ host: '127.0.0.1', port: mailPort, timeout: 800 });
  const done = (answer) => {
    socket.destroy();
    resolve(answer);
  };
  socket.on('connect', () => done(true));
  socket.on('error', () => done(false));
  socket.on('timeout', () => done(false));
});
record(
  'Local mail catcher',
  mailUp,
  mailUp
    ? `listening on 127.0.0.1:${mailPort} — password reset links will be readable`
    : 'not running — reset emails go to the API log instead. Start one with `pnpm mail:dev`',
  true,
);

const firewall = macFirewall();
if (firewall) {
  if (firewall.stealth) {
    record(
      'macOS firewall stealth mode is off',
      false,
      'Stealth mode is ON — it silently drops incoming connections, which is why a phone hangs instead of failing fast. ' +
        'System Settings → Network → Firewall → Options → turn off "Enable stealth mode".',
      true,
    );
  } else if (firewall.enabled) {
    record(
      'macOS firewall',
      true,
      'enabled, stealth off — allow incoming connections for node if a phone still cannot reach the API',
    );
  } else {
    record('macOS firewall', true, 'disabled');
  }
}

/**
 * The addresses a phone can try.
 *
 * When a device cannot reach the API, the useful next step is to open one of
 * these in the phone's own browser: a page means the network is fine and the
 * app is misconfigured, a hang means something between them is dropping the
 * connection (on macOS, usually the firewall).
 */
const lanUrls = [];
for (const addresses of Object.values(networkInterfaces())) {
  for (const address of addresses ?? []) {
    if (address.family === 'IPv4' && !address.internal) {
      lanUrls.push(`http://${address.address}:3001/api/v1/health`);
    }
  }
}
if (lanUrls.length) {
  console.log('\n  From a phone on this network, this should return JSON:');
  for (const url of lanUrls) console.log(`    ${url}`);
  console.log('    A hang here means the connection is being dropped — check the firewall.');
}

console.log('');
const hard = results.filter((r) => !r.ok && !r.soft);
const soft = results.filter((r) => !r.ok && r.soft);
if (soft.length) {
  console.log(`  ${soft.length} warning(s): ${soft.map((r) => r.name).join(', ')}`);
}
if (hard.length) {
  console.log(`\n  ✗ ${hard.length} check(s) failed. Fix these before presenting.\n`);
  process.exit(1);
}
console.log('  ✓ All required checks passed.\n');
