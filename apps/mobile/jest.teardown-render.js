/* eslint-env jest */
/**
 * Unmount every tree a test mounts, whether or not the test remembered to.
 *
 * React 19 changed what a tree left mounted costs. `act()` flushes pending work
 * for **every mounted root in its scope**, not just the one the current test
 * made -- so a screen mounted by the first test in a file keeps re-rendering
 * during the fourth, driven by that test's `act()`. Two things follow, and both
 * were observed in this suite rather than reasoned about:
 *
 *   - The stale tree renders against mocks a later `beforeEach` has reset. A
 *     Calendar mounted by test 1 re-rendered in test 4 with its hook mock
 *     returning undefined, and the failure was reported against a test that had
 *     never mounted a Calendar.
 *
 *   - Once the file ends, that work runs against a torn-down jest environment
 *     and reports as "You are trying to `import` a file after the Jest
 *     environment has been torn down" and "Cannot log after tests are done".
 *     Every test still passes, and jest still exits 1.
 *
 * Doing it here rather than in each spec is the same choice already made for
 * React Query caches in `jest.teardown-query.js`: a rule that depends on every
 * future spec remembering something is a rule that will be broken. Nine specs
 * were missing it when this was written.
 *
 * `create` is wrapped rather than the module replaced, so specs keep importing
 * `react-test-renderer` normally and keep whatever they do with the tree they
 * get back -- including unmounting it themselves, which stays harmless because
 * unmounting twice is a no-op here.
 */
const renderer = require('react-test-renderer');
const { act } = require('react');

/** Trees created during the current test. */
const live = new Set();

const realCreate = renderer.create;
renderer.create = function create(...args) {
  const tree = realCreate.apply(this, args);
  live.add(tree);
  return tree;
};

afterEach(() => {
  if (live.size === 0) return;
  const trees = [...live];
  live.clear();
  // Inside act() because unmounting runs effects' cleanup, which is work React
  // expects to be flushed under act like any other.
  act(() => {
    for (const tree of trees) {
      try {
        tree.unmount();
      } catch {
        // A tree a spec already unmounted throws on the second call. Nothing to
        // do about it, and nothing worth failing a green test over.
      }
    }
  });
});

module.exports = { live };
