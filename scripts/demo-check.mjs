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
import { networkInterfaces } from 'node:os';
import { assertLocalDatabase, fail } from './demo-guard.mjs';

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

async function login(email) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PW }),
  });
  if (!res.ok) return null;
  const body = await res.json();
  return body?.data?.accessToken ?? null;
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
  for (const email of accounts) {
    const token = await login(email);
    tokens[email] = token;
    if (!token) record(`Sign in: ${email}`, false, 'login refused');
  }
  const signedIn = accounts.filter((e) => tokens[e]).length;
  record('Seeded accounts can sign in', signedIn === accounts.length, `${signedIn}/${accounts.length}`);

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

    const today = new Date().toISOString().slice(0, 10);
    let bookable = 0;
    for (const org of list) {
      const av = await get(
        `/appointments/availability?organizationId=${org.id}&appointmentType=BLOOD_DONATION&date=${today}`,
        donor,
      );
      const slots = Array.isArray(av.body) ? av.body : (av.body?.items ?? av.body?.slots ?? []);
      if (slots.length) bookable += 1;
    }
    record('Donation slots available today', bookable >= 3,
      `${bookable}/${list.length} organizations bookable today`);

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
