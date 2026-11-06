import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import test from 'node:test';

// Exercise the dependency Expo Router actually resolves, not a test-only copy.
const mobileRequire = createRequire(new URL('../apps/mobile/package.json', import.meta.url));
const routerRequire = createRequire(mobileRequire.resolve('expo-router/package.json'));
const queryStringPath = routerRequire.resolve('query-string');
const queryRequire = createRequire(queryStringPath);
const decodePath = queryRequire.resolve('decode-uri-component');
const decode = queryRequire('decode-uri-component');

test('patched decoder preserves CommonJS, plus decoding and malformed UTF-8 behavior', () => {
  assert.equal(typeof decode, 'function');
  assert.equal(decode('Blood%20Chain+A'), 'Blood Chain A');
  assert.equal(decode('%D0%94%D0%BE%D0%BD%D0%BE%D1%80'), 'Донор');
  assert.equal(decode('%C2%41'), '\uFFFDA');
  assert.equal(decode('%FE%FF'), '\uFFFD\uFFFD');
  assert.equal(decode('bad%ZZvalue'), 'bad%ZZvalue');
  assert.throws(() => decode(null), TypeError);
  assert.deepEqual({ ...queryRequire(queryStringPath).parse('label=Blood%20Chain&alias=A+B') }, {
    alias: 'A B', label: 'Blood Chain',
  });
});

test('large malformed percent-encoded runs finish within a bounded child process', () => {
  const program = `
    const decode = require(process.argv[1]);
    const result = decode('%C2%41'.repeat(30000));
    if (result !== '\\uFFFDA'.repeat(30000)) process.exit(1);
  `;
  // Kill the child if a future dependency refresh reintroduces quadratic work
  // or unbounded recursion; a hung decoder must not hang the entire CI job.
  execFileSync(process.execPath, ['-e', program, decodePath], { timeout: 3000, stdio: 'pipe' });
});
