import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkLocalDatabase } from './demo-guard.mjs';

/**
 * These commands TRUNCATE every table the seed owns. This guard is the only
 * thing between a laptop and someone's real data, so it gets tested for what it
 * REFUSES, not only for what it allows -- a guard that fails open is worse than
 * no guard, because it is trusted.
 */
const LOCAL_DEV = 'postgresql://u:p@localhost:5432/donor_dev';

test('allows a development database on localhost with no NODE_ENV', () => {
  const target = checkLocalDatabase({ url: LOCAL_DEV });
  assert.equal(target.host, 'localhost');
  assert.equal(target.database, 'donor_dev');
  assert.equal(target.environment, 'unset');
});

test('allows development and test environments', () => {
  for (const nodeEnv of ['development', 'dev', 'test', 'TEST', ' development ']) {
    assert.doesNotThrow(() => checkLocalDatabase({ url: LOCAL_DEV, nodeEnv }));
  }
});

test('allows the loopback forms and the docker host alias', () => {
  for (const host of ['localhost', '127.0.0.1', '0.0.0.0', 'host.docker.internal']) {
    assert.doesNotThrow(() =>
      checkLocalDatabase({ url: `postgresql://u:p@${host}:5432/donor_dev` }),
    );
  }
});

test('refuses NODE_ENV=production', () => {
  assert.throws(
    () => checkLocalDatabase({ url: LOCAL_DEV, nodeEnv: 'production' }),
    /NODE_ENV is "production"/,
  );
});

/**
 * The reason the check is an allowlist rather than `!== 'production'`: these
 * all pass a negative test while being exactly the environments that must not
 * be wiped.
 */
test('refuses any environment that is not recognised as development', () => {
  for (const nodeEnv of ['staging', 'prod', 'preprod', 'uat', 'PRODUCTION']) {
    assert.throws(
      () => checkLocalDatabase({ url: LOCAL_DEV, nodeEnv }),
      /Demo commands run only with NODE_ENV unset, development or test/,
      `expected refusal for NODE_ENV=${nodeEnv}`,
    );
  }
});

test('refuses a remote host even in development', () => {
  assert.throws(
    () =>
      checkLocalDatabase({
        url: 'postgresql://u:p@db.prod.example.com:5432/donor_dev',
        nodeEnv: 'development',
      }),
    /not a local host/,
  );
});

test('refuses a private-network host that is not loopback', () => {
  assert.throws(
    () => checkLocalDatabase({ url: 'postgresql://u:p@10.0.1.20:5432/donor_dev' }),
    /not a local host/,
  );
});

/**
 * A local Postgres is a perfectly good place to have port-forwarded something
 * that matters, so being on localhost is not on its own a licence to wipe.
 */
test('refuses a local database whose name does not identify it as disposable', () => {
  assert.throws(
    () => checkLocalDatabase({ url: 'postgresql://u:p@localhost:5432/donor' }),
    /does not identify it as a development database/,
  );
});

test('allows an ambiguous name only when named explicitly', () => {
  const target = checkLocalDatabase({
    url: 'postgresql://u:p@localhost:5432/donor',
    allowDatabase: 'donor',
  });
  assert.equal(target.database, 'donor');
  assert.equal(target.explicitlyAllowed, true);
});

test('accepts a comma-separated allowlist and ignores surrounding space', () => {
  assert.doesNotThrow(() =>
    checkLocalDatabase({
      url: 'postgresql://u:p@localhost:5432/donor',
      allowDatabase: 'other , donor ,third',
    }),
  );
});

test('does not let the allowlist override the host or environment checks', () => {
  assert.throws(
    () =>
      checkLocalDatabase({
        url: 'postgresql://u:p@db.example.com:5432/donor',
        allowDatabase: 'donor',
      }),
    /not a local host/,
  );
  assert.throws(
    () =>
      checkLocalDatabase({
        url: 'postgresql://u:p@localhost:5432/donor',
        nodeEnv: 'production',
        allowDatabase: 'donor',
      }),
    /NODE_ENV is "production"/,
  );
});

test('recognises development names without matching them inside other words', () => {
  for (const name of ['donor_dev', 'dev_donor', 'bloodchain-test', 'demo', 'app_local_db']) {
    assert.doesNotThrow(
      () => checkLocalDatabase({ url: `postgresql://u:p@localhost:5432/${name}` }),
      `expected ${name} to be recognised`,
    );
  }
  // "developer" and "attested" contain dev/test as substrings but are not
  // development markers; requiring a word boundary is what keeps this honest.
  for (const name of ['developers_payroll', 'attestations']) {
    assert.throws(
      () => checkLocalDatabase({ url: `postgresql://u:p@localhost:5432/${name}` }),
      /does not identify it as a development database/,
      `expected ${name} to be refused`,
    );
  }
});

test('refuses an unparseable URL rather than assuming it is safe', () => {
  assert.throws(() => checkLocalDatabase({ url: 'not a url' }), /could not be parsed/);
});

test('refuses a missing URL', () => {
  assert.throws(() => checkLocalDatabase({ url: undefined }), /DATABASE_URL is not set/);
});

test('refuses a URL that names no database', () => {
  assert.throws(
    () => checkLocalDatabase({ url: 'postgresql://u:p@localhost:5432/' }),
    /names no database/,
  );
});
