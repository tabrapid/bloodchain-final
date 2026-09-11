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
    execFileSync('docker', ['compose', 'up', '-d', 'postgres'], { cwd: root, stdio: 'inherit' });
    return true;
  } catch {
    return false;
  }
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
console.log('  Mobile         run `pnpm dev:mobile` in a second terminal\n');
console.log('  Ctrl-C stops everything.\n');

const stop = () => {
  for (const child of children) child.kill('SIGINT');
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
