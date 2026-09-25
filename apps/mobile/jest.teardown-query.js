/**
 * Dispose every React Query cache a test file created, once that file is done.
 *
 * Without this the mobile suite does not exit. `useGeography` caches the region
 * and district lists with `gcTime: 24 * 60 * 60 * 1000` -- correct for the app,
 * because that data changes about never -- and per-query options win over the
 * client's defaults (`Removable.updateGcTime` takes a `Math.max`), so a spec
 * that sets `gcTime: 0` on its QueryClient does not affect these queries at
 * all. When the tree unmounts, the last observer goes away and
 * `Query.scheduleGc()` arms a **ref'd 24-hour `setTimeout`**. Node keeps a
 * process alive for a pending ref'd timer, so jest -- which does not pass
 * `--forceExit` here -- waits for an event loop that will not drain until
 * tomorrow.
 *
 * It hid for so long because of how jest schedules work. With workers, the
 * timers are armed inside a worker process, and jest force-kills workers after
 * the run; the only trace is the familiar "A worker process has failed to exit
 * gracefully" warning. A two-core CI runner gives `maxWorkers=1`, where jest
 * runs in band, so the timers land in the main process and nothing kills it.
 * The job then sat until GitHub's six-hour ceiling cancelled it, having already
 * run every test successfully.
 *
 * Nothing here suppresses or ignores a handle. `QueryClient.clear()` empties
 * both caches, and emptying a cache calls `Query.destroy()`, which clears that
 * query's gc timeout -- the ordinary disposal the tests were simply never
 * doing. `--forceExit` would have hidden this instead of fixing it, and would
 * have hidden the next leak too.
 */
const reactQuery = require('@tanstack/react-query');

/**
 * Every client this test file actually mounted.
 *
 * Tracked by wrapping `QueryClient.prototype.mount` rather than the exported
 * constructor: the package's exports are non-configurable getters, so they
 * cannot be replaced, but prototype methods are writable. `QueryClientProvider`
 * calls `mount()` on the client it is given, and every spec here renders
 * through that provider, so this sees each one -- without asking future specs
 * to remember to register anything. A client that is never mounted has no
 * observers and therefore no gc timers, so missing it costs nothing.
 */
const liveClients = new Set();

const realMount = reactQuery.QueryClient.prototype.mount;
reactQuery.QueryClient.prototype.mount = function mount(...args) {
  liveClients.add(this);
  return realMount.apply(this, args);
};

afterAll(() => {
  for (const client of liveClients) {
    // `unmount()` detaches the focus and online subscriptions.
    if (typeof client.unmount === 'function') client.unmount();

    // Mutations have to be destroyed by hand, and this is not symmetry for its
    // own sake.
    //
    // `QueryCache.clear()` removes each query, and removing a query calls
    // `Query.destroy()`, which clears its gc timeout. `MutationCache.clear()`
    // does not do the same thing: it emits a "removed" notification for each
    // mutation and drops its references, and never calls `destroy()`. So a
    // mutation that lost its last observer -- which is what unmounting a form
    // screen does -- keeps the ref'd gc timer that `Mutation.removeObserver`
    // armed, and `client.clear()` does not touch it.
    //
    // The default mutation gcTime is five minutes, which is why this surfaced
    // as a CI job that passed all 263 tests in 121 seconds and then sat for
    // another four and three quarter minutes before jest gave up. Measured
    // rather than reasoned about: instrumenting the sandbox's own setTimeout
    // named `Mutation.scheduleGc` via `Removable.scheduleGc` as the owner of
    // the surviving handle.
    const mutationCache = typeof client.getMutationCache === 'function' ? client.getMutationCache() : null;
    if (mutationCache) {
      for (const mutation of mutationCache.getAll()) {
        if (typeof mutation.destroy === 'function') mutation.destroy();
      }
    }

    // `clear()` then empties both caches.
    client.clear();
  }
  liveClients.clear();
});

module.exports = { liveClients };
