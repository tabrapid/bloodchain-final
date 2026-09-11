import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertLocalDatabase } from './demo-guard.mjs';

/**
 * These commands drop and rewrite a whole database. The only thing between a
 * laptop and someone's production data is this check, so it gets tests.
 */
test('accepts a loopback database', () => {
  const target = assertLocalDatabase('postgresql://u:p@localhost:5432/donor_dev');
  assert.equal(target.host, 'localhost');
  assert.equal(target.database, 'donor_dev');
});

test('accepts 127.0.0.1', () => {
  assert.equal(assertLocalDatabase('postgresql://u:p@127.0.0.1:5432/donor_dev').host, '127.0.0.1');
});

test('refuses a remote host', () => {
  assert.throws(
    () => assertLocalDatabase('postgresql://u:p@db.prod.example.com:5432/live'),
    /not a local host/,
  );
});

test('refuses a URL it cannot parse, rather than assuming it is safe', () => {
  assert.throws(() => assertLocalDatabase('not a url'), /could not be parsed/);
});

test('refuses when NODE_ENV is production, even on localhost', () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    assert.throws(
      () => assertLocalDatabase('postgresql://u:p@localhost:5432/donor_dev'),
      /never run against production/,
    );
  } finally {
    process.env.NODE_ENV = previous;
  }
});
