import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The guard every destructive demo operation runs before touching anything.
 *
 * These operations TRUNCATE every table the seed owns. That is routine against
 * a laptop and unrecoverable anywhere else, and the only thing separating the
 * two is which DATABASE_URL happens to be exported. So the rule is fail closed:
 * refuse unless every check affirmatively passes, rather than refusing only on
 * recognised danger.
 *
 * Three independent conditions, because any one alone is defeatable:
 *
 * 1. **Environment.** An allowlist of development-ish values, not
 *    `!== 'production'`. A typo (`NODE_ENV=prod`, `NODE_ENV=staging`) passes
 *    the negative test and fails this one.
 * 2. **Host.** The database must be reachable only on a loopback address.
 * 3. **Identity.** The database *name* must look like a development database,
 *    or be named explicitly in DEMO_ALLOW_DATABASE. A local Postgres is a
 *    perfectly good place to have port-forwarded something that matters, so
 *    "it is on localhost" is not by itself evidence that wiping it is safe.
 */
const LOCAL_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '0.0.0.0',
  // Present so the guard works from inside a dev container talking to the
  // host's Postgres. Still a developer machine, not a shared environment.
  'host.docker.internal',
]);

/** NODE_ENV values under which a demo reset is permissible. Unset counts. */
const ALLOWED_ENVIRONMENTS = new Set(['', 'development', 'dev', 'test']);

/** Names that identify a database as disposable without further confirmation. */
const DEV_DATABASE_PATTERN = /(^|[^a-z])(dev|development|test|demo|local|sandbox|scratch)([^a-z]|$)/i;

/**
 * Fill in anything the environment has not already set, from `.env`.
 *
 * It used to return early when `DATABASE_URL` was set, on the reasonable
 * assumption that a caller who had exported that had exported everything. That
 * stopped being true when `verify-fixtures.mjs` started minting access tokens:
 * it needs `JWT_ACCESS_SECRET`, and a CI job that exports only `DATABASE_URL`
 * -- which is the normal thing to do -- got a hard "JWT_ACCESS_SECRET is not
 * set" from a function whose whole job is to have set it.
 *
 * Reading the file always, and never overwriting a variable the environment
 * already carries, is what the per-key loop below already did. The early return
 * was an optimisation that became a bug when the function grew a second reader.
 */
export function loadEnvFile() {
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
  }
}

/**
 * The pure decision, separated from reading the environment so it can be
 * tested exhaustively without mutating process.env. Returns the target on
 * success; throws with an actionable message on refusal.
 */
export function checkLocalDatabase({ url, nodeEnv, allowDatabase }) {
  if (!url) {
    throw new Error('DATABASE_URL is not set. Demo commands only run against a local database.');
  }

  const environment = (nodeEnv ?? '').trim().toLowerCase();
  if (!ALLOWED_ENVIRONMENTS.has(environment)) {
    throw new Error(
      `NODE_ENV is "${nodeEnv}". Demo commands run only with NODE_ENV unset, development or test. ` +
        'Refusing, because an unrecognised environment is not a safe one.',
    );
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

  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  if (!database) {
    throw new Error('DATABASE_URL names no database, so its identity cannot be confirmed. Refusing.');
  }

  const explicitlyAllowed = (allowDatabase ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
    .includes(database);

  if (!explicitlyAllowed && !DEV_DATABASE_PATTERN.test(database)) {
    throw new Error(
      `Database "${database}" is on a local host but its name does not identify it as a ` +
        'development database, so this command will not wipe it.\n\n' +
        '  If it is disposable, confirm it explicitly:\n' +
        `    DEMO_ALLOW_DATABASE=${database} pnpm demo:reset\n` +
        `  or add DEMO_ALLOW_DATABASE=${database} to your .env file.\n\n` +
        '  A local Postgres is a perfectly good place to have port-forwarded a database\n' +
        '  that matters, so "it is on localhost" is not on its own enough to destroy it.',
    );
  }

  return { host, database, environment: environment || 'unset', explicitlyAllowed };
}

export function assertLocalDatabase(url) {
  loadEnvFile();
  return checkLocalDatabase({
    url: url ?? process.env.DATABASE_URL,
    nodeEnv: process.env.NODE_ENV,
    allowDatabase: process.env.DEMO_ALLOW_DATABASE,
  });
}

export function fail(message) {
  console.error(`\n  ✗ ${message}\n`);
  process.exit(1);
}
