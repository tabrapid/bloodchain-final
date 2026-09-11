/**
 * The guard every demo command runs before touching anything.
 *
 * These commands drop and rewrite a whole database. That is fine against a
 * laptop and catastrophic anywhere else, and the only thing standing between
 * the two is which DATABASE_URL happens to be exported. So: refuse unless the
 * host is a loopback address and NODE_ENV is not production. A URL that cannot
 * be parsed is refused too -- an unreadable target is not a safe one.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0', 'host.docker.internal']);

/**
 * Read DATABASE_URL out of the repo's .env when the shell has not exported it.
 *
 * The API loads .env through dotenv, so a developer who has never exported the
 * variable still has a working API -- and these scripts would refuse to run,
 * reporting a missing database rather than the local one sitting right there.
 * Anything already in the environment wins.
 */
export function loadEnvFile() {
  if (process.env.DATABASE_URL) return;
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  for (const candidate of [path.join(root, '.env'), path.join(root, 'apps', 'api', '.env')]) {
    if (!fs.existsSync(candidate)) continue;
    for (const line of fs.readFileSync(candidate, 'utf8').split('\n')) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key] !== undefined) continue;
      process.env[key] = rawValue.trim().replace(/^["']|["']$/g, '');
    }
    if (process.env.DATABASE_URL) return;
  }
}

export function assertLocalDatabase(url) {
  loadEnvFile();
  url = url ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set. Demo commands only run against a local database.');
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('NODE_ENV=production. Demo commands never run against production.');
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('DATABASE_URL could not be parsed, so it cannot be confirmed local. Refusing.');
  }

  const host = parsed.hostname;
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(
      `DATABASE_URL points at "${host}", which is not a local host. ` +
        'Demo reset and seed only run against localhost. Refusing.',
    );
  }

  return { host, database: parsed.pathname.replace(/^\//, '') };
}

export function fail(message) {
  console.error(`\n  ✗ ${message}\n`);
  process.exit(1);
}
