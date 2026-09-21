#!/usr/bin/env node
/**
 * Proves the two migration paths that actually happen, by performing them.
 *
 * A migration set is claimed to be safe on two counts and each is a different
 * claim:
 *
 *   1. **Clean install.** Every migration applies in order to an empty
 *      database, and what comes out matches the Prisma schema exactly.
 *   2. **Upgrade.** The newest migration applies to a database that already
 *      holds real rows, without losing any of them.
 *
 * The first is the one people check, because it is the one `prisma migrate
 * dev` exercises every day. The second is the one that breaks a deployment: an
 * `ADD COLUMN ... NOT NULL` with no default, a unique index over a column that
 * already has duplicates, an `ALTER TYPE` inside a transaction that also uses
 * the value. None of those fail on an empty database, and all of them fail at
 * three in the morning on a full one.
 *
 * So this script builds a database at the PREVIOUS migration, loads it with
 * the source database's rows, and then applies the newest migration to it. The
 * row counts before and after have to match, table by table.
 *
 * Two safety properties, both deliberate and both the same as
 * `verify-backup.mjs`:
 *
 * - **The source is only ever read.** `SELECT` and `\copy ... TO`. Nothing here
 *   can write to, truncate or drop the database being copied from, whatever it
 *   is called.
 * - **The scratch databases are guarded like every other destructive operation
 *   in this repository**, through the same `checkLocalDatabase` the demo seed
 *   uses: local host, development-ish environment, and a name that identifies
 *   the database as disposable.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync, writeFileSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { checkLocalDatabase, fail, loadEnvFile } from './demo-guard.mjs';

loadEnvFile();

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = path.join(ROOT, 'apps', 'api');
const MIGRATIONS = path.join(API, 'prisma', 'migrations');

const SOURCE_URL = process.env.DATABASE_URL;
if (!SOURCE_URL) {
  fail('DATABASE_URL is not set. There is no database to copy the upgrade rehearsal from.');
}

const source = new URL(SOURCE_URL);
const sourceDatabase = source.pathname.replace(/^\//, '');
const CLEAN = `${sourceDatabase}_migrate_clean_test`;
const UPGRADE = `${sourceDatabase}_migrate_upgrade_test`;

for (const name of [CLEAN, UPGRADE]) {
  try {
    checkLocalDatabase({
      url: new URL(`/${name}`, source).toString(),
      nodeEnv: process.env.NODE_ENV,
      allowDatabase: process.env.DEMO_ALLOW_DATABASE,
    });
  } catch (error) {
    fail(
      `The scratch database this would create and drop ("${name}") is not one it may touch.\n` +
        `  ${error.message}`,
    );
  }
}

const results = [];
const record = (ok, label, detail = '') => {
  results.push({ ok, label, detail });
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
};

function pgEnv() {
  return {
    ...process.env,
    PGHOST: source.hostname,
    PGPORT: source.port || '5432',
    PGUSER: decodeURIComponent(source.username),
    PGPASSWORD: decodeURIComponent(source.password),
  };
}

const psql = (database, sql) =>
  execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-d', database, '-tAc', sql], {
    env: pgEnv(),
    encoding: 'utf8',
  }).trim();

const psqlFile = (database, file) =>
  execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-q', '-d', database, '-f', file], {
    env: pgEnv(),
    encoding: 'utf8',
  });

const urlFor = (database) => {
  const url = new URL(source.toString());
  url.pathname = `/${database}`;
  return url.toString();
};

const prisma = (args, database) =>
  execFileSync('npx', ['prisma', ...args], {
    cwd: API,
    env: { ...process.env, DATABASE_URL: urlFor(database) },
    encoding: 'utf8',
    stdio: 'pipe',
  });

/**
 * Whether the live schema of `database` matches the Prisma schema.
 *
 * `migrate diff --exit-code` answers 0 for "no difference", 2 for "there is
 * one" and 1 for "the command itself failed", and the three have to stay
 * apart: a mistyped flag exiting 1 must not be reported as drift, which is
 * exactly what an earlier version of this script did.
 */
function matchesSchema(database) {
  try {
    prisma(
      [
        'migrate',
        'diff',
        '--from-url',
        urlFor(database),
        '--to-schema-datamodel',
        path.join(API, 'prisma', 'schema.prisma'),
        '--exit-code',
      ],
      database,
    );
    return { ok: true, detail: 'no drift' };
  } catch (error) {
    if (error.status === 2) return { ok: false, detail: 'DRIFT DETECTED' };
    return {
      ok: false,
      detail: `the drift check itself failed: ${String(error.stderr ?? error.message)
        .split('\n')
        .find((line) => line.trim()) ?? 'unknown error'}`,
    };
  }
}

/** Table names in the public schema of a database, ordinary tables only. */
function tablesOf(database) {
  const raw = psql(
    database,
    `SELECT string_agg(c.relname, ',' ORDER BY c.relname)
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'`,
  );
  return raw ? raw.split(',') : [];
}

function columnsOf(database, table) {
  const raw = psql(
    database,
    `SELECT string_agg(column_name, ',' ORDER BY ordinal_position)
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = '${table}'`,
  );
  return raw ? raw.split(',') : [];
}

/** Row counts for every table, as one query. */
function tableCounts(database) {
  const raw = psql(
    database,
    `SELECT string_agg(format('%s=%s', tablename, cnt), ',' ORDER BY tablename)
       FROM (
         SELECT c.relname AS tablename,
                (xpath('/row/c/text()',
                       query_to_xml(format('SELECT count(*) AS c FROM %I.%I', n.nspname, c.relname),
                                    false, true, '')))[1]::text::bigint AS cnt
           FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relkind = 'r'
       ) t`.replace(/\s+/g, ' '),
  );
  const counts = new Map();
  for (const pair of raw ? raw.split(',') : []) {
    const [table, count] = pair.split('=');
    counts.set(table, Number(count));
  }
  return counts;
}

const quote = (identifier) => `"${identifier.replace(/"/g, '""')}"`;

const workDir = mkdtempSync(path.join(tmpdir(), 'bloodchain-migrate-'));
let created = [];

function createScratch(name) {
  psql('postgres', `DROP DATABASE IF EXISTS ${quote(name)}`);
  psql('postgres', `CREATE DATABASE ${quote(name)}`);
  created.push(name);
}

console.log('\n  Migration safety: clean install and upgrade\n');
console.log(`  source:  ${sourceDatabase} on ${source.hostname} (read only)`);
console.log(`  scratch: ${CLEAN}, ${UPGRADE} (created and dropped by this script)\n`);

try {
  const migrations = readdirSync(MIGRATIONS, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  if (migrations.length < 2) {
    fail('Fewer than two migrations. There is no upgrade to rehearse.');
  }

  const newest = migrations[migrations.length - 1];
  console.log(`  migration under test: ${newest}\n`);

  // ------------------------------------------------------------ 1. clean install
  createScratch(CLEAN);
  prisma(['migrate', 'deploy', '--schema', path.join(API, 'prisma', 'schema.prisma')], CLEAN);
  record(true, 'every migration applies to an empty database', `${migrations.length} migrations`);

  const cleanDrift = matchesSchema(CLEAN);
  record(cleanDrift.ok, 'the clean install matches the Prisma schema exactly', cleanDrift.detail);

  // ------------------------------------------------------------ 2. previous state
  //
  // A copy of the prisma directory with the newest migration removed, so
  // `migrate deploy` builds the schema as it stood before it.
  const previousDir = path.join(workDir, 'prisma-previous');
  cpSync(path.join(API, 'prisma'), previousDir, { recursive: true });
  rmSync(path.join(previousDir, 'migrations', newest), { recursive: true, force: true });

  createScratch(UPGRADE);
  prisma(['migrate', 'deploy', '--schema', path.join(previousDir, 'schema.prisma')], UPGRADE);
  record(true, 'the previous migration set applies on its own', `${migrations.length - 1} migrations`);

  // ------------------------------------------------------------ 3. load real rows
  //
  // Column intersection, not `pg_dump`. The source is one migration AHEAD of
  // this database, so a dump's COPY column lists name columns that do not exist
  // here yet. Copying only the columns both sides have is what makes the
  // rehearsal possible at all, and it is also exactly what the upgrade is about:
  // rows that predate the new columns.
  const target = new Set(tablesOf(UPGRADE));
  const exportLines = [];
  const importLines = ['SET session_replication_role = replica;'];
  let copiedTables = 0;

  for (const table of tablesOf(sourceDatabase)) {
    if (!target.has(table) || table === '_prisma_migrations') continue;

    const shared = columnsOf(UPGRADE, table).filter((column) =>
      columnsOf(sourceDatabase, table).includes(column),
    );
    if (shared.length === 0) continue;

    const columnList = shared.map(quote).join(', ');
    const file = path.join(workDir, `${table}.csv`);
    exportLines.push(`\\copy (SELECT ${columnList} FROM ${quote(table)}) TO '${file}' WITH CSV`);
    importLines.push(`\\copy ${quote(table)} (${columnList}) FROM '${file}' WITH CSV`);
    copiedTables += 1;
  }

  importLines.push('SET session_replication_role = DEFAULT;');

  const exportFile = path.join(workDir, 'export.sql');
  const importFile = path.join(workDir, 'import.sql');
  writeFileSync(exportFile, `${exportLines.join('\n')}\n`);
  writeFileSync(importFile, `${importLines.join('\n')}\n`);

  psqlFile(sourceDatabase, exportFile);
  psqlFile(UPGRADE, importFile);
  record(true, "the source's rows load into the previous schema", `${copiedTables} tables`);

  const before = tableCounts(UPGRADE);
  const populated = [...before.entries()].filter(([, count]) => count > 0);
  if (populated.length === 0) {
    fail(
      'Nothing was loaded, so applying the migration to it would prove nothing. ' +
        'Seed the source database first.',
    );
  }
  record(true, 'the rehearsal database holds rows to migrate', `${populated.length} non-empty tables`);

  // ------------------------------------------------------------ 4. the upgrade
  prisma(['migrate', 'deploy', '--schema', path.join(API, 'prisma', 'schema.prisma')], UPGRADE);
  record(true, 'the newest migration applies to a populated database', newest);

  const after = tableCounts(UPGRADE);
  const lost = [];
  for (const [table, count] of before) {
    const now = after.get(table);
    if (now === undefined) {
      lost.push(`${table} (table gone)`);
    } else if (now < count) {
      lost.push(`${table} ${count} -> ${now}`);
    }
  }

  record(
    lost.length === 0,
    'no row is lost by the upgrade',
    lost.length === 0 ? `${populated.length} tables unchanged or larger` : lost.join(', '),
  );

  const upgradeDrift = matchesSchema(UPGRADE);
  record(upgradeDrift.ok, 'the upgraded database matches the Prisma schema exactly', upgradeDrift.detail);
} catch (error) {
  record(false, 'the rehearsal completed', error.message?.split('\n')[0] ?? String(error));
} finally {
  for (const name of created) {
    try {
      psql('postgres', `DROP DATABASE IF EXISTS ${quote(name)}`);
    } catch {
      console.log(`  ! could not drop scratch database ${name}; drop it by hand`);
    }
  }
  rmSync(workDir, { recursive: true, force: true });
}

const failed = results.filter((result) => !result.ok);
console.log('');
if (failed.length > 0) {
  console.log(`  ${failed.length} of ${results.length} checks failed.\n`);
  process.exit(1);
}
console.log(`  All ${results.length} checks passed.\n`);
