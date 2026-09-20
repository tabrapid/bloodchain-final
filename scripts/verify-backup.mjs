#!/usr/bin/env node
/**
 * Takes a backup, restores it, and checks that what came back is what went in.
 *
 * DG-03 and MO-04 in the readiness register are one problem written twice:
 * there is no backup procedure, and no restore has ever been rehearsed. The
 * second half is the one that bites. A backup nobody has restored is not a
 * backup — it is a file, and the first time anyone finds out whether it is a
 * *good* file is the morning they need it.
 *
 * So this does not document a procedure. It performs one:
 *
 *   1. `pg_dump` the source database (read-only; the source is never touched).
 *   2. Create a scratch database and restore the dump into it.
 *   3. Compare the restored copy against the source: every table present, row
 *      counts equal, and the clinical safety rows that matter most present in
 *      the same numbers.
 *   4. Drop the scratch database.
 *
 * Run it against a developer's database to rehearse the procedure, and against
 * a production dump to prove a specific backup file before trusting it.
 *
 * Two safety properties, both deliberate:
 *
 * - **The source is only ever read.** `pg_dump` and `SELECT`. Nothing here can
 *   write to, truncate or drop the database being backed up, whatever its name.
 * - **The scratch database is guarded like every other destructive operation in
 *   this repository.** It is created and dropped, so it goes through the same
 *   `checkLocalDatabase` rules as the demo seed: local host, development-ish
 *   environment, and a name that identifies it as disposable.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { checkLocalDatabase, fail, loadEnvFile } from './demo-guard.mjs';

loadEnvFile();

const SOURCE_URL = process.env.BACKUP_SOURCE_URL ?? process.env.DATABASE_URL;
if (!SOURCE_URL) {
  fail('Neither BACKUP_SOURCE_URL nor DATABASE_URL is set. There is nothing to back up.');
}

const source = new URL(SOURCE_URL);
const scratchName = `${source.pathname.replace(/^\//, '')}_restore_test`;

/**
 * The scratch database is created and dropped, so it is a destructive target
 * and goes through the same guard as the demo seed.
 *
 * The name always ends in `_restore_test`, which satisfies the guard's
 * development-name rule by construction rather than by luck.
 */
try {
  checkLocalDatabase({
    url: new URL(`/${scratchName}`, source).toString(),
    nodeEnv: process.env.NODE_ENV,
    allowDatabase: process.env.DEMO_ALLOW_DATABASE,
  });
} catch (error) {
  fail(
    `The scratch database this would create and drop ("${scratchName}") is not one it may touch.\n` +
      `  ${error.message}`,
  );
}

const results = [];
const record = (ok, label, detail = '') => {
  results.push({ ok, label, detail });
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
};

/** psql/pg_dump take the password from the environment, never the command line. */
function pgEnv(url) {
  return {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || '5432',
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
  };
}

function psql(url, database, sql) {
  return execFileSync('psql', ['-d', database, '-tAc', sql], {
    env: pgEnv(url),
    encoding: 'utf8',
  }).trim();
}

/**
 * Row counts for every table in the public schema, as one query.
 *
 * Counted rather than trusted from `pg_dump`'s own output: the question is
 * whether the RESTORED database holds the rows, which only the restored
 * database can answer.
 */
function tableCounts(url, database) {
  const sql = `
    SELECT string_agg(format('%s=%s', tablename, cnt), ',' ORDER BY tablename)
    FROM (
      SELECT c.relname AS tablename,
             (xpath('/row/c/text()',
                    query_to_xml(format('SELECT count(*) AS c FROM %I.%I', n.nspname, c.relname),
                                 false, true, '')))[1]::text::bigint AS cnt
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
    ) t
  `;
  const raw = psql(url, database, sql.replace(/\s+/g, ' '));
  const counts = new Map();
  for (const pair of raw.split(',')) {
    if (!pair) continue;
    const [table, count] = pair.split('=');
    counts.set(table, Number(count));
  }
  return counts;
}

const sourceDatabase = source.pathname.replace(/^\//, '');
const workDir = mkdtempSync(path.join(tmpdir(), 'bloodchain-backup-'));
const dumpFile = path.join(workDir, `${sourceDatabase}.dump`);
let scratchCreated = false;

console.log('\n  Backup and restore verification\n');
console.log(`  source:  ${sourceDatabase} on ${source.hostname}`);
console.log(`  scratch: ${scratchName} (created and dropped by this script)\n`);

try {
  // ---------------------------------------------------------------- 1. back up
  //
  // Custom format (-Fc): compressed, and restorable selectively with pg_restore,
  // which is what a real recovery wants. Plain SQL is easier to read and worse
  // to restore from.
  execFileSync('pg_dump', ['-Fc', '-f', dumpFile, '-d', sourceDatabase], {
    env: pgEnv(source),
    stdio: 'pipe',
  });
  const dumpBytes = statSync(dumpFile).size;
  record(dumpBytes > 0, 'pg_dump produced a non-empty backup', `${(dumpBytes / 1024).toFixed(0)} KiB`);

  const before = tableCounts(source, sourceDatabase);
  record(before.size > 0, 'source database has tables to compare', `${before.size} tables`);

  // ---------------------------------------------------------------- 2. restore
  execFileSync('dropdb', ['--if-exists', scratchName], { env: pgEnv(source), stdio: 'pipe' });
  execFileSync('createdb', [scratchName], { env: pgEnv(source), stdio: 'pipe' });
  scratchCreated = true;

  // pg_restore exits non-zero on warnings that are not failures (ownership,
  // extension comments), so its exit code alone is not the test. The test is
  // whether the data came back, which is checked below.
  try {
    execFileSync('pg_restore', ['--no-owner', '--no-acl', '-d', scratchName, dumpFile], {
      env: pgEnv(source),
      stdio: 'pipe',
    });
  } catch (error) {
    const output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
    console.log(`    (pg_restore reported warnings: ${output.trim().split('\n').slice(0, 3).join(' | ')})`);
  }
  record(true, 'restored the backup into a scratch database');

  // ---------------------------------------------------------------- 3. compare
  const after = tableCounts(source, scratchName);

  const missingTables = [...before.keys()].filter((table) => !after.has(table));
  record(
    missingTables.length === 0,
    'every table came back',
    missingTables.length === 0 ? `${after.size} tables` : `missing: ${missingTables.join(', ')}`,
  );

  const mismatched = [...before.entries()]
    .filter(([table, count]) => after.get(table) !== count)
    .map(([table, count]) => `${table}: ${count} -> ${after.get(table) ?? 'absent'}`);
  record(
    mismatched.length === 0,
    'every table came back with the same number of rows',
    mismatched.length === 0
      ? `${[...before.values()].reduce((sum, n) => sum + n, 0)} rows total`
      : mismatched.slice(0, 5).join('; '),
  );

  // The rows a blood service cannot lose. Checked by name rather than left to
  // the totals above, because "some table is short" and "the donation record is
  // short" deserve different reactions, and a generic diff buries the second.
  const CRITICAL = [
    'User',
    'Donation',
    'BloodUnit',
    'ReleaseDecision',
    'DonorDeferral',
    'BloodUnitDisposition',
    'AuditLog',
  ];
  const criticalProblems = CRITICAL.filter(
    (table) => before.has(table) && after.get(table) !== before.get(table),
  );
  record(
    criticalProblems.length === 0,
    'donation, blood-unit, release-decision, deferral and audit rows all match',
    criticalProblems.length === 0
      ? CRITICAL.filter((t) => before.has(t))
          .map((t) => `${t}=${before.get(t)}`)
          .join(' ')
      : criticalProblems.join(', '),
  );

  // A restored database that cannot be migrated forward is not a usable
  // recovery target.
  const unfinished = psql(
    source,
    scratchName,
    `SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL`,
  );
  record(
    unfinished === '0',
    'the restored schema has no unfinished or rolled-back migrations',
    `${unfinished} unfinished`,
  );
} catch (error) {
  record(false, 'backup and restore completed without error', `${error.message}`.split('\n')[0]);
} finally {
  if (scratchCreated) {
    try {
      execFileSync('dropdb', ['--if-exists', scratchName], { env: pgEnv(source), stdio: 'pipe' });
      console.log(`\n  scratch database ${scratchName} dropped`);
    } catch {
      console.log(`\n  ! could not drop the scratch database ${scratchName} — drop it by hand`);
    }
  }
  rmSync(workDir, { recursive: true, force: true });
}

const failed = results.filter((result) => !result.ok);
console.log('');
if (failed.length > 0) {
  console.log(`  ✗ ${failed.length} of ${results.length} checks failed.`);
  console.log('    This backup would not restore. Fix it before it is the only copy.\n');
  process.exit(1);
}
console.log(`  ✓ All ${results.length} checks passed. The backup restores, and the data survives it.\n`);
