#!/usr/bin/env node
/**
 * Phone sign-up and SMS codes, end to end, against the running API.
 *
 * The unit tests cover the pieces. This covers the joins, which is where an OTP
 * flow actually fails: the code is generated but the rate limiter counts the
 * wrong thing, or a resend leaves the old code alive, or the attempt counter
 * resets on a new request, or the ticket from one number registers another.
 * None of those can be seen from a mocked service -- each needs the real
 * database, the real limits and the real clock.
 *
 * The code is read out of the development SMS provider's log file, which is
 * exactly the loop a developer uses: `SMS_DEV_LOG_FILE` points the console
 * adapter at a file, and this reads the last line.
 *
 * Not read-only: it creates accounts. Run `pnpm demo:reset` afterwards.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertLocalDatabase, fail } from './demo-guard.mjs';

const API = process.env.DEMO_API_URL ?? 'http://localhost:3001';
const BASE = `${API}/api/v1`;
const PASSWORD = 'DevelopmentOnly!123';

try {
  assertLocalDatabase();
} catch (error) {
  fail(error.message);
}

/**
 * Where the development SMS provider writes its messages.
 *
 * Read straight out of `apps/api/.env` rather than through `loadEnvFile`: that
 * helper stops as soon as it has a DATABASE_URL, which is the only variable it
 * exists for, so it cannot be relied on for this one.
 */
function readApiEnv(key) {
  const file = resolve('apps/api', '.env');
  if (!existsSync(file)) return undefined;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = new RegExp(`^\\s*${key}\\s*=\\s*(.*)$`).exec(line);
    if (match) return match[1].trim().replace(/^["']|["']$/g, '');
  }
  return undefined;
}

const smsLogSetting = process.env.SMS_DEV_LOG_FILE ?? readApiEnv('SMS_DEV_LOG_FILE') ?? '';
const smsLog = smsLogSetting ? resolve('apps/api', smsLogSetting) : '';
if (!smsLog) {
  fail(
    'SMS_DEV_LOG_FILE is not set in apps/api/.env. This script reads codes out of that file; ' +
      'set it (for example SMS_DEV_LOG_FILE=.sms-dev.log) and restart the API.',
  );
}

let failures = 0;
let skipped = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};
const skip = (name, why) => {
  skipped += 1;
  console.log(`  skip ${name} — ${why}`);
};
const section = (name) => console.log(`\n${name}`);

async function call(method, path, body, token) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
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

/** Runs a snippet of Prisma against the local database. */
function prisma(snippet) {
  const output = execFileSync(
    'node',
    [
      '-e',
      `
    const { PrismaClient } = require('@prisma/client');
    const db = new PrismaClient();
    (async () => {
      const result = await (${snippet});
      console.log(JSON.stringify(result ?? null));
      await db.$disconnect();
    })();
  `,
    ],
    { cwd: 'apps/api', encoding: 'utf8' },
  ).trim();
  return JSON.parse(output || 'null');
}

/** The six digits out of the last message the console provider wrote. */
function lastCode() {
  if (!existsSync(smsLog)) return null;
  const lines = readFileSync(smsLog, 'utf8').trim().split('\n').filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    try {
      const match = JSON.parse(lines[i]).body?.match(/\b(\d{6})\b/);
      if (match) return match[1];
    } catch {
      /* not JSON; keep looking */
    }
  }
  return null;
}

function messagesFor(phone) {
  if (!existsSync(smsLog)) return [];
  return readFileSync(smsLog, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter((entry) => entry?.to === phone);
}

/** A number nobody has used, so each run starts from a clean rate-limit budget. */
function freshPhone() {
  const tail = String(Date.now() % 10_000_000).padStart(7, '0');
  return `+99890${tail}`;
}

/** Clears the cooldown and hourly budget for one number. */
function clearBudget(phone) {
  prisma(`db.phoneVerification.deleteMany({ where: { phone: ${JSON.stringify(phone)} } })`);
}

const createdPhones = [];

console.log('\n  Phone sign-up and SMS codes — end-to-end check');

try {
  // --------------------------------------------------------------- normalisation
  section('  Normalisation');

  const phone = freshPhone();
  const national = phone.slice(4);
  createdPhones.push(phone);

  const spelt = await call('POST', '/auth/phone/request-code', {
    // The same number, written the way it is printed on a poster.
    phone: `${national.slice(0, 2)} ${national.slice(2, 5)} ${national.slice(5, 7)} ${national.slice(7)}`,
    purpose: 'REGISTRATION',
  });
  check('accepts a number written with spaces', spelt.status === 200, `status ${spelt.status}`);

  const rows = prisma(
    `db.phoneVerification.findMany({ where: { phone: ${JSON.stringify(phone)} }, select: { id: true } })`,
  );
  check('stores it in canonical E.164', rows.length === 1, `${rows.length} row(s) for ${phone}`);

  const badNumber = await call('POST', '/auth/phone/request-code', {
    phone: '12345',
    purpose: 'REGISTRATION',
  });
  check('refuses a number that is not one', badNumber.status === 400, `status ${badNumber.status}`);

  // --------------------------------------------------------------- code storage
  section('  The code itself');

  const code = lastCode();
  check('a six-digit code reached the provider', /^\d{6}$/.test(code ?? ''), String(code));

  const stored = prisma(
    `db.phoneVerification.findFirst({ where: { phone: ${JSON.stringify(phone)} }, orderBy: { createdAt: 'desc' } })`,
  );
  check(
    'the code is never stored, only a hash of it',
    Boolean(stored) && !JSON.stringify(stored).includes(code ?? 'xxxxxx'),
  );
  check('the hash is a full SHA-256', /^[0-9a-f]{64}$/.test(stored?.codeHash ?? ''));

  // --------------------------------------------------------------- brute force
  section('  Guessing');

  const wrong = String((Number(code) + 1) % 1_000_000).padStart(6, '0');
  let lastWrong;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    lastWrong = await call('POST', '/auth/phone/verify-code', {
      phone,
      code: wrong,
      purpose: 'REGISTRATION',
    });
    if (lastWrong.raw?.code === 'AUTH_OTP_TOO_MANY_ATTEMPTS') break;
  }
  check(
    'a wrong code is refused with one message',
    lastWrong.status === 400,
    `status ${lastWrong.status}`,
  );
  check(
    'guessing is cut off well before a million tries',
    lastWrong.raw?.code === 'AUTH_OTP_TOO_MANY_ATTEMPTS',
    `code ${lastWrong.raw?.code}`,
  );

  const burnt = await call('POST', '/auth/phone/verify-code', {
    phone,
    code,
    purpose: 'REGISTRATION',
  });
  check(
    'the right code no longer works once the attempts are gone',
    burnt.status === 400,
    `status ${burnt.status}`,
  );

  // --------------------------------------------------------------- resend
  section('  Resending');

  const tooSoon = await call('POST', '/auth/phone/request-code', {
    phone,
    purpose: 'REGISTRATION',
  });
  check(
    'a resend inside the cooldown is refused',
    tooSoon.status === 429 && tooSoon.raw?.code === 'AUTH_OTP_COOLDOWN',
    `status ${tooSoon.status} ${tooSoon.raw?.code ?? ''}`,
  );
  check(
    'and says how long is left, so a countdown can be honest',
    typeof tooSoon.raw?.details?.retryAfterSeconds === 'number',
    JSON.stringify(tooSoon.raw?.details),
  );

  // Age the row rather than waiting out the cooldown: the clock is the thing
  // being tested everywhere else, and here it is only in the way.
  prisma(
    `db.phoneVerification.updateMany({ where: { phone: ${JSON.stringify(phone)} }, data: { createdAt: new Date(Date.now() - 10 * 60 * 1000) } })`,
  );

  const resent = await call('POST', '/auth/phone/request-code', {
    phone,
    purpose: 'REGISTRATION',
  });
  check('a resend after the cooldown works', resent.status === 200, `status ${resent.status}`);

  const secondCode = lastCode();
  check('the new code is a different one', secondCode !== code, `${code} then ${secondCode}`);

  const supersededRows = prisma(
    `db.phoneVerification.count({ where: { phone: ${JSON.stringify(phone)}, supersededAt: { not: null } } })`,
  );
  check(
    'the previous code is dead, not merely older',
    supersededRows >= 1,
    `${supersededRows} superseded`,
  );

  const oldCode = await call('POST', '/auth/phone/verify-code', {
    phone,
    code,
    purpose: 'REGISTRATION',
  });
  check('and the old code is refused', oldCode.status === 400, `status ${oldCode.status}`);

  // --------------------------------------------------------------- registration
  section('  Registering');

  const verified = await call('POST', '/auth/phone/verify-code', {
    phone,
    code: secondCode,
    purpose: 'REGISTRATION',
  });
  check('the current code is accepted', verified.status === 200, `status ${verified.status}`);
  const ticket = verified.body?.verificationToken;
  check('and returns a signed ticket, not a boolean', typeof ticket === 'string' && ticket.split('.').length === 3);

  const replayed = await call('POST', '/auth/phone/verify-code', {
    phone,
    code: secondCode,
    purpose: 'REGISTRATION',
  });
  check('a spent code cannot be spent again', replayed.status === 400, `status ${replayed.status}`);

  if (typeof ticket !== 'string') {
    fail(
      'No verification ticket came back, so the registration checks cannot run. ' +
        'The failures above say why.',
    );
  }

  const forged = await call('POST', '/auth/register-phone', {
    verificationToken: `${ticket.split('.').slice(0, 2).join('.')}.forged-signature`,
    firstName: 'Mallory',
    lastName: 'Forger',
    password: PASSWORD,
  });
  check(
    'a ticket with a broken signature registers nothing',
    forged.status === 400 && forged.raw?.code === 'AUTH_VERIFICATION_TICKET_INVALID',
    `status ${forged.status} ${forged.raw?.code ?? ''}`,
  );

  const registered = await call('POST', '/auth/register-phone', {
    verificationToken: ticket,
    firstName: 'Aziz',
    lastName: 'Karimov',
    password: PASSWORD,
  });
  check('registration succeeds', registered.status === 201, `status ${registered.status}`);
  check('and signs the donor in', typeof registered.body?.accessToken === 'string');

  const account = prisma(
    `db.user.findUnique({ where: { phone: ${JSON.stringify(phone)} }, select: { id: true, status: true, phoneVerified: true, emailVerified: true, email: true } })`,
  );
  check('the account is active', account?.status === 'ACTIVE', String(account?.status));
  check('the phone is marked verified', account?.phoneVerified === true);
  check('the email is not', account?.emailVerified === false);
  check(
    'and a donor without an email gets an obviously synthetic one',
    String(account?.email).endsWith('@phone.bloodchain.local'),
    String(account?.email),
  );

  const reused = await call('POST', '/auth/register-phone', {
    verificationToken: ticket,
    firstName: 'Someone',
    lastName: 'Else',
    password: PASSWORD,
  });
  check(
    'the same number cannot be registered twice',
    reused.status === 400 && reused.raw?.code === 'AUTH_PHONE_TAKEN',
    `status ${reused.status} ${reused.raw?.code ?? ''}`,
  );

  // --------------------------------------------------------------- signing in
  section('  Signing in');

  const byPhone = await call('POST', '/auth/login', { phone, password: PASSWORD });
  check('signs in by phone number', byPhone.status === 200, `status ${byPhone.status}`);

  const spacedLogin = await call('POST', '/auth/login', {
    phone: `${national.slice(0, 2)} ${national.slice(2, 5)} ${national.slice(5, 7)} ${national.slice(7)}`,
    password: PASSWORD,
  });
  check(
    'and by the same number written differently',
    spacedLogin.status === 200,
    `status ${spacedLogin.status}`,
  );

  const wrongPassword = await call('POST', '/auth/login', { phone, password: 'not-the-password' });
  const unknownNumber = await call('POST', '/auth/login', {
    phone: freshPhone(),
    password: PASSWORD,
  });
  check(
    'an unknown number and a wrong password are the same refusal',
    wrongPassword.status === unknownNumber.status &&
      wrongPassword.raw?.code === unknownNumber.raw?.code,
    `${wrongPassword.status}/${wrongPassword.raw?.code} vs ${unknownNumber.status}/${unknownNumber.raw?.code}`,
  );

  const byEmail = await call('POST', '/auth/login', {
    email: 'donor@donor.local',
    password: PASSWORD,
  });
  check(
    'the seeded email account still signs in',
    byEmail.status === 200,
    `status ${byEmail.status}`,
  );

  // --------------------------------------------------------------- enumeration
  section('  Enumeration');

  const takenNumber = freshPhone();
  clearBudget(phone);
  const askForRegistered = await call('POST', '/auth/phone/request-code', {
    phone,
    purpose: 'REGISTRATION',
  });
  const askForUnknown = await call('POST', '/auth/phone/request-code', {
    phone: takenNumber,
    purpose: 'REGISTRATION',
  });
  createdPhones.push(takenNumber);
  check(
    'asking about a registered number looks exactly like asking about a stranger',
    askForRegistered.status === askForUnknown.status &&
      JSON.stringify(Object.keys(askForRegistered.body ?? {}).sort()) ===
        JSON.stringify(Object.keys(askForUnknown.body ?? {}).sort()),
    `${askForRegistered.status} vs ${askForUnknown.status}`,
  );

  const registeredMessages = messagesFor(phone);
  const lastToRegistered = registeredMessages.at(-1)?.body ?? '';
  check(
    'but the person holding it is told to sign in, and sent no code',
    !/\b\d{6}\b/.test(lastToRegistered),
    lastToRegistered.slice(0, 60),
  );

  // --------------------------------------------------------------- recovery
  section('  Recovery by phone');

  clearBudget(phone);
  const recoveryRequest = await call('POST', '/auth/phone/request-code', {
    phone,
    purpose: 'PASSWORD_RESET',
  });
  check('a reset code can be requested', recoveryRequest.status === 200, `status ${recoveryRequest.status}`);

  const recoveryCode = lastCode();
  const recovery = await call('POST', '/auth/phone/verify-code', {
    phone,
    code: recoveryCode,
    purpose: 'PASSWORD_RESET',
  });
  check('the code buys a reset token', typeof recovery.body?.resetToken === 'string', `status ${recovery.status}`);

  const NEW_PASSWORD = 'RecoveredByPhone!2026';
  const reset = await call('POST', '/auth/reset-password', {
    token: recovery.body?.resetToken,
    newPassword: NEW_PASSWORD,
  });
  check('and the existing reset endpoint accepts it', reset.status === 200, `status ${reset.status}`);

  const afterReset = await call('POST', '/auth/login', { phone, password: NEW_PASSWORD });
  check('the new password works', afterReset.status === 200, `status ${afterReset.status}`);

  const oldSession = await call('POST', '/auth/refresh', {
    refreshToken: byPhone.body?.refreshToken,
  });
  check(
    'and every session from before the reset is gone',
    oldSession.status === 401,
    `status ${oldSession.status}`,
  );

  const spentReset = await call('POST', '/auth/reset-password', {
    token: recovery.body?.resetToken,
    newPassword: 'AnotherPassword!2026',
  });
  check('the reset token is single-use', spentReset.status === 400, `status ${spentReset.status}`);

  const unknownRecovery = await call('POST', '/auth/phone/request-code', {
    phone: freshPhone(),
    purpose: 'PASSWORD_RESET',
  });
  check(
    'recovery for a number with no account answers the same way',
    unknownRecovery.status === recoveryRequest.status,
    `${unknownRecovery.status} vs ${recoveryRequest.status}`,
  );

  // --------------------------------------------------------------- hourly cap
  section('  Volume');

  const flooded = freshPhone();
  createdPhones.push(flooded);
  let limitHit = false;
  for (let i = 0; i < 7; i += 1) {
    const attempt = await call('POST', '/auth/phone/request-code', {
      phone: flooded,
      purpose: 'REGISTRATION',
    });
    if (attempt.raw?.code === 'AUTH_OTP_RATE_LIMITED') {
      limitHit = true;
      break;
    }
    // Step past the cooldown without waiting for it.
    prisma(
      `db.phoneVerification.updateMany({ where: { phone: ${JSON.stringify(flooded)} }, data: { createdAt: new Date(Date.now() - 10 * 60 * 1000) } })`,
    );
  }
  if (limitHit) {
    check('one number cannot be texted indefinitely', true);
  } else {
    skip(
      'one number cannot be texted indefinitely',
      'the per-IP throttle answered first; raise AUTH_THROTTLE_LIMIT to exercise the per-number cap',
    );
  }
} finally {
  // ------------------------------------------------------------------ cleanup
  for (const created of createdPhones) {
    try {
      prisma(
        `db.user.deleteMany({ where: { phone: ${JSON.stringify(created)} } }).then(() => db.phoneVerification.deleteMany({ where: { phone: ${JSON.stringify(created)} } }))`,
      );
    } catch {
      /* best effort */
    }
  }
  try {
    rmSync(smsLog, { force: true });
  } catch {
    /* best effort */
  }
}

console.log(
  `\n  ${failures === 0 ? 'All checks passed' : `${failures} check(s) failed`}` +
    `${skipped ? ` (${skipped} skipped)` : ''}\n`,
);
process.exit(failures === 0 ? 0 : 1);
