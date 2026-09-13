#!/usr/bin/env node
/**
 * Start everything the demo needs, in one command.
 *
 * Deliberately not clever: it starts PostgreSQL if Docker Compose is available,
 * waits for the API to answer, and then runs the three Next.js portals as child
 * processes with their output prefixed. Ctrl-C stops all of them. Expo is left
 * out on purpose -- it wants its own terminal and its own QR code.
 */
import { spawn, execFileSync } from 'node:child_process';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { assertLocalDatabase, fail } from './demo-guard.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

try {
  assertLocalDatabase();
} catch (error) {
  fail(error.message);
}

const SERVICES = [
  { name: 'api', filter: '@bloodchain/api', script: 'dev', url: 'http://localhost:3001/api/v1/health' },
  { name: 'hospital', filter: '@bloodchain/hospital-web', script: 'dev', url: 'http://localhost:3000' },
  { name: 'blood-center', filter: '@bloodchain/blood-center-web', script: 'dev', url: 'http://localhost:3002' },
  { name: 'admin', filter: '@bloodchain/admin-web', script: 'dev', url: 'http://localhost:3003' },
];

function dockerComposeUp() {
  try {
    // Mailpit is in the `dev` profile, so it has to be named explicitly --
    // which is the point: nothing else can start it by accident.
    execFileSync('docker', ['compose', '--profile', 'dev', 'up', '-d', 'postgres', 'mailpit'], {
      cwd: root,
      stdio: 'inherit',
    });
    return true;
  } catch {
    return false;
  }
}

/** Is anything listening on the local SMTP port a mail catcher would use? */
function mailCatcherListening(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port, timeout: 800 });
    const done = (answer) => {
      socket.destroy();
      resolve(answer);
    };
    socket.on('connect', () => done(true));
    socket.on('error', () => done(false));
    socket.on('timeout', () => done(false));
  });
}

console.log('\n  Starting Bloodchain demo services\n');
if (!dockerComposeUp()) {
  console.log('  ! Docker Compose not available — assuming PostgreSQL is already running.\n');
}

// Sign-in is throttled to 5 attempts per minute per IP. On one laptop every
// client -- three consoles, a phone, and demo:check's own nine logins -- shares
// a single address, so the default turns an ordinary rehearsal into "login
// refused" and sends you looking for a problem that is not there.
const env = { ...process.env, AUTH_THROTTLE_LIMIT: process.env.AUTH_THROTTLE_LIMIT ?? '100' };

// Point the API at a local mail catcher if one is listening, so the password
// reset link is readable instead of buried in the API log. Only ever
// 127.0.0.1, only ever without credentials, and only if the user actually
// started a catcher -- an unset SMTP_HOST keeps the existing log-only
// behaviour, which is what every other environment gets.
const mailPort = Number(process.env.DEV_MAIL_PORT ?? 1025);
if (!process.env.SMTP_HOST && (await mailCatcherListening(mailPort))) {
  env.SMTP_HOST = '127.0.0.1';
  env.SMTP_PORT = String(mailPort);
  console.log(`  Mail catcher found on 127.0.0.1:${mailPort} — the API will deliver to it.`);
} else if (!process.env.SMTP_HOST) {
  console.log('  ! No mail catcher on 127.0.0.1:' + mailPort + ' — emails will be logged, not delivered.');
  console.log('    Run `pnpm mail:dev` in another terminal to read the password reset link.\n');
}

const children = [];
for (const service of SERVICES) {
  const child = spawn('pnpm', ['--filter', service.filter, service.script], {
    cwd: root,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.push(child);
  const prefix = `[${service.name}]`;
  for (const stream of [child.stdout, child.stderr]) {
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => {
      for (const line of chunk.split('\n')) {
        if (line.trim()) console.log(`${prefix} ${line}`);
      }
    });
  }
  child.on('exit', (code) => console.log(`${prefix} exited with code ${code}`));
}

console.log('\n  API            http://localhost:3001/api/v1   (docs: /docs)');
console.log('  Hospital       http://localhost:3000');
console.log('  Blood center   http://localhost:3002');
console.log('  Admin          http://localhost:3003');
console.log('  Mobile         run `pnpm dev:mobile` in a second terminal');
if (env.SMTP_HOST) {
  console.log('  Mail           pnpm mail:dev terminal, or http://localhost:8025 for Mailpit\n');
} else {
  console.log('');
}
console.log('  Ctrl-C stops everything.\n');

const stop = () => {
  for (const child of children) child.kill('SIGINT');
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
