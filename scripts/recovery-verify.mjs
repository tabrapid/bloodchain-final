#!/usr/bin/env node
/**
 * Account recovery, end to end, against the running API and a real SMTP server.
 *
 * The unit tests cover the pieces; this covers the join between them, which is
 * where recovery actually fails: the mail is sent but the link points somewhere
 * the app cannot open, or the token works twice, or the old session survives a
 * reset. None of those can be caught by mocking the mail service, so this
 * starts a real SMTP sink, makes the API deliver to it, and reads the link out
 * of the message the way a donor would read it out of their inbox.
 *
 * Not read-only: it changes a seeded account's password. Run `pnpm demo:reset`
 * afterwards.
 */
import { execFileSync } from 'node:child_process';
import { createMailSink, MAIL_HOST, defaultMailPort } from './dev-mail.mjs';
import { assertLocalDatabase, fail } from './demo-guard.mjs';

const API = process.env.DEMO_API_URL ?? 'http://localhost:3001';
const BASE = `${API}/api/v1`;
const SEED_PASSWORD = 'DevelopmentOnly!123';
const NEW_PASSWORD = 'RecoveredPass!2026';
// Deliberately not the primary demo donor: this account ends the run with a
// different password, and donor@donor.local is the one every demo script opens.
const ACCOUNT = 'recent.donor@donor.local';

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
/** For an assertion this run could not make -- never one that failed. */
const skip = (name, why) => {
  skipped += 1;
  console.log(`  skip ${name} — ${why}`);
};
const section = (name) => console.log(`\n${name}`);

async function call(method, path, body, token) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let parsed = {};
  try {
    parsed = await res.json();
  } catch {
    /* empty body */
  }
  return { status: res.status, body: parsed?.data ?? parsed, raw: parsed };
}

const signIn = (email, password) => call('POST', '/auth/login', { email, password });

/**
 * Runs a snippet of Prisma against the local database.
 *
 * Used only to age a token. The TTL is an hour by definition, so the honest
 * alternatives are waiting an hour or trusting a unit test with a mocked clock;
 * moving the expiry backwards exercises the real query, the real comparison and
 * the real error path, which is the part worth proving.
 */
function prisma(snippet) {
  const output = execFileSync('node', ['-e', `
    const { PrismaClient } = require('@prisma/client');
    const db = new PrismaClient();
    (async () => {
      const result = await (${snippet});
      console.log(JSON.stringify(result ?? null));
      await db.$disconnect();
    })();
  `], { cwd: 'apps/api', encoding: 'utf8' }).trim();
  return JSON.parse(output || 'null');
}

console.log('\n  Account recovery — end-to-end check');

const port = defaultMailPort();
const sink = createMailSink({ port });
try {
  await sink.listen();
} catch (error) {
  if (error.code === 'EADDRINUSE') {
    fail(
      `Port ${port} is busy. This script runs its own mail sink so it can read the link — ` +
        'stop `pnpm mail:dev` (or Mailpit) and run it again.',
    );
  }
  throw error;
}

try {
  // ------------------------------------------------------------- fixtures
  section('  Before the reset');

  const before = await signIn(ACCOUNT, SEED_PASSWORD);
  if (before.status === 429) {
    fail('Rate limited signing in. Restart the API with AUTH_THROTTLE_LIMIT=100 and re-run.');
  }
  if (before.status !== 200) {
    fail(
      `${ACCOUNT} cannot sign in with the seed password (${before.status}). ` +
        'This suite needs freshly seeded data -- run pnpm demo:reset.',
    );
  }
  const oldRefreshToken = before.body.refreshToken;
  check('the account signs in with its seeded password', true, ACCOUNT);
  check('and holds a refresh token, which the reset must invalidate', Boolean(oldRefreshToken));

  // --------------------------------------------------------------- step 1
  section('  Requesting a link');

  const requested = await call('POST', '/auth/forgot-password', { email: ACCOUNT });
  if (requested.status === 429) {
    fail(
      'Rate limited on /auth/forgot-password (3 per 15 minutes per IP, by design). ' +
        'The throttler keeps its counters in memory -- restart the API and re-run.',
    );
  }
  check('the API accepts the request', requested.status === 200, `${requested.status}`);

  // Two of the three requests this IP is allowed every 15 minutes. A second run
  // inside that window trips the limit on this one, which would otherwise read
  // as "the two addresses are answered differently" -- the exact opposite of
  // what it means.
  const unknown = await call('POST', '/auth/forgot-password', { email: 'nobody@example.test' });
  if (unknown.status === 429) {
    skip(
      'an unregistered address is answered identically',
      'rate limited mid-comparison — restart the API to clear the counter',
    );
  } else {
    check(
      'and answers an unregistered address identically',
      JSON.stringify(unknown.raw) === JSON.stringify(requested.raw),
      `${requested.status} vs ${unknown.status}`,
    );
  }

  // --------------------------------------------------------------- step 2
  section('  The email that arrives');

  let message;
  try {
    message = await sink.next(8000);
  } catch {
    fail(
      `No message reached ${MAIL_HOST}:${port}. The API is not configured to deliver there — ` +
        `restart it with SMTP_HOST=${MAIL_HOST} SMTP_PORT=${port} (pnpm demo:start does this ` +
        'when a catcher is already listening).',
    );
  }

  check('a message is delivered', Boolean(message), message?.subject);
  check('addressed to the account that asked', message.to.includes(ACCOUNT), message.to.join(', '));

  const deepLink = message.links.find((link) => link.startsWith('donor://'));
  const webLink = message.links.find((link) => link.startsWith('http'));
  check('it carries a deep link for the app', Boolean(deepLink), deepLink?.slice(0, 34) + '…');
  check('and a web link for a desktop browser', Boolean(webLink));

  // The half of the contract the mobile app owns: Expo Router resolves
  // `donor://reset-password` to app/(auth)/reset-password.tsx.
  check(
    'the deep link opens the mobile reset screen',
    /^donor:\/\/reset-password\?token=[a-f0-9]{64}$/.test(deepLink ?? ''),
    deepLink ? deepLink.split('?')[0] : 'missing',
  );

  const token = new URL(webLink ?? 'http://x/').searchParams.get('token');
  check(
    'both links carry the same token',
    Boolean(token) && deepLink?.endsWith(token ?? '__'),
    token ? `${token.slice(0, 8)}… (${token.length} chars)` : 'missing',
  );

  // --------------------------------------------------------------- step 3
  section('  Spending the link');

  const reset = await call('POST', '/auth/reset-password', { token, newPassword: NEW_PASSWORD });
  check('the reset succeeds', reset.status === 200, reset.raw?.message?.slice(0, 48));

  const replay = await call('POST', '/auth/reset-password', { token, newPassword: 'SecondTry!2026x' });
  check('the same link cannot be used twice', replay.status === 400, `${replay.status}`);

  const bogus = await call('POST', '/auth/reset-password', {
    token: 'f'.repeat(64),
    newPassword: 'SecondTry!2026x',
  });
  check(
    'a used link and an unknown one are indistinguishable',
    bogus.status === replay.status && bogus.raw?.message === replay.raw?.message,
    replay.raw?.message,
  );

  // --------------------------------------------------------------- step 4
  section('  After the reset');

  const refreshed = await call('POST', '/auth/refresh', { refreshToken: oldRefreshToken });
  check(
    'the session held before the reset is dead',
    refreshed.status === 401 || refreshed.status === 403,
    `${refreshed.status}`,
  );

  const oldPassword = await signIn(ACCOUNT, SEED_PASSWORD);
  check('the old password no longer works', oldPassword.status === 401, `${oldPassword.status}`);

  const newPassword = await signIn(ACCOUNT, NEW_PASSWORD);
  check('the new password does', newPassword.status === 200, `${newPassword.status}`);
  check(
    'and issues a fresh session',
    Boolean(newPassword.body?.refreshToken) && newPassword.body.refreshToken !== oldRefreshToken,
  );

  // --------------------------------------------------------------- step 5
  section('  An expired link');

  // A second link for the same account, then aged past its expiry in the
  // database. Nothing else about it changes -- it is a live, unused token whose
  // only fault is the clock.
  const second = await call('POST', '/auth/forgot-password', { email: ACCOUNT });
  if (second.status === 429) {
    skip('an expired link is refused', 'out of reset requests for this 15-minute window');
  } else {
    let expiredToken;
    try {
      expiredToken = (await sink.next(8000)).links.find((l) => l.startsWith('donor://'))?.split('token=')[1];
    } catch {
      expiredToken = undefined;
    }
    check('a second link is issued', Boolean(expiredToken));

    if (expiredToken) {
      const aged = prisma(
        "db.passwordResetToken.updateMany({ where: { usedAt: null }, data: { expiresAt: new Date(Date.now() - 60000) } })",
      );
      check('the token is aged past its expiry in the database', aged?.count >= 1, `${aged?.count} row(s)`);

      const expired = await call('POST', '/auth/reset-password', {
        token: expiredToken,
        newPassword: 'ExpiredAttempt!2026',
      });
      check('an expired link is refused', expired.status === 400, `${expired.status}`);
      check(
        'and is indistinguishable from an unknown one',
        expired.raw?.message === 'This password reset link is invalid or has expired.',
        expired.raw?.message,
      );

      const stillNew = await signIn(ACCOUNT, NEW_PASSWORD);
      check('the password is unchanged by the failed attempt', stillNew.status === 200, `${stillNew.status}`);
    }
  }

  // --------------------------------------------------------------- step 6
  section('  The rest of auth still works');

  // Recovery touches the auth module; these are the three flows next to it.
  const fresh = `recovery.regression.${Date.now()}@donor.local`;
  const registered = await call('POST', '/auth/register', {
    email: fresh,
    password: SEED_PASSWORD,
    firstName: 'Recovery',
    lastName: 'Regression',
  });
  check('Register still creates an account', registered.status === 201, `${registered.status}`);

  const resent = await call('POST', '/auth/resend-verification', { email: fresh });
  check('Check Email can still resend a verification', resent.status === 200, `${resent.status}`);

  const unverified = await signIn(fresh, SEED_PASSWORD);
  check(
    'an account with no confirmed contact is still refused at sign-in',
    // Matched on the code rather than the prose. Sprint 1B widened this gate
    // from "verified email" to "verified email or phone" and gave every auth
    // refusal a machine-readable code -- which is exactly so that a check like
    // this one stops depending on a sentence that can be reworded or
    // translated.
    unverified.status === 403 && unverified.raw?.code === 'AUTH_CONTACT_NOT_VERIFIED',
    `${unverified.status} ${unverified.raw?.code ?? ''}`,
  );

  const seeded = await signIn('donor@donor.local', SEED_PASSWORD);
  check('Login still works for a seeded account', seeded.status === 200, `${seeded.status}`);

  const wrong = await signIn('donor@donor.local', 'DefinitelyNotIt!99');
  check('and still refuses a wrong password', wrong.status === 401, `${wrong.status}`);
} finally {
  await sink.close();
}

console.log('');
if (failures) {
  console.log(`  ✗ ${failures} check(s) failed.\n`);
  process.exit(1);
}
if (skipped) {
  console.log(`  ! ${skipped} check(s) skipped — restart the API to clear the reset throttle and re-run.`);
}
console.log('  ✓ Account recovery works end to end.');
console.log(`    Run \`pnpm demo:reset\`: ${ACCOUNT} now has a different password.\n`);
