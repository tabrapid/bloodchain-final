#!/usr/bin/env node
/**
 * Return the local demo database to its scripted starting state.
 *
 * Runs migrations then the seed, which truncates every table it owns before
 * writing, so this is repeatable: run it between rehearsals, or right before
 * presenting, and the demo starts from the same place every time.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { assertLocalDatabase, fail } from './demo-guard.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const api = path.join(root, 'apps', 'api');

let target;
try {
  target = assertLocalDatabase();
} catch (error) {
  fail(error.message);
}

console.log(`\n  Resetting demo data in "${target.database}" on ${target.host}\n`);

const run = (cmd, args, cwd) => {
  console.log(`  → ${cmd} ${args.join(' ')}`);
  execFileSync(cmd, args, { cwd, stdio: 'inherit', env: process.env });
};

try {
  run('npx', ['prisma', 'migrate', 'deploy'], api);
  run('npx', ['prisma', 'db', 'seed'], api);
} catch {
  fail('Reset failed. Check that PostgreSQL is running and DATABASE_URL is correct.');
}

console.log('\n  ✓ Demo data reset. Sign in again -- a reset issues new user ids, so');
console.log('    any token from before this point is no longer valid.\n');
