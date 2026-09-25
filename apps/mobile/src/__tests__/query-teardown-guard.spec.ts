/**
 * The guard on the thing that made the whole mobile suite unrunnable in CI.
 *
 * `useGeography` caches reference data with `gcTime: 24 * 60 * 60 * 1000`.
 * That is right for the application and wrong for a test process: when the last
 * observer of such a query goes away, React Query arms a **ref'd 24-hour
 * `setTimeout`**, and Node keeps a process alive for a pending ref'd timer. The
 * mobile `test` script does not pass `--forceExit`, so jest waited for an event
 * loop that would not drain until the next day. On a machine with enough cores
 * jest uses workers and force-kills them afterwards, leaving only the "worker
 * process has failed to exit gracefully" warning; on a two-core CI runner
 * `maxWorkers` is 1, jest runs in band, and the job ran until GitHub cancelled
 * it at the six-hour ceiling -- having already passed all 260 tests.
 *
 * `jest.teardown-query.js` fixes that by disposing each mounted client's caches
 * when a test file finishes. It hooks `QueryClient.prototype.mount`, which is
 * an internal detail of a third-party package and therefore exactly the kind of
 * thing that breaks silently on an upgrade -- and the symptom of it breaking is
 * not a failing test, it is a suite that hangs for six hours. So both halves of
 * the mechanism are asserted here, where a break is a red test instead.
 */
import { QueryClient } from '@tanstack/react-query';

const { liveClients } = require('../../jest.teardown-query');

/** The value `useGeography` uses, and the one that actually hung the suite. */
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

describe('the harness disposes React Query caches', () => {
  it('notices a client when it is mounted', () => {
    const client = new QueryClient();

    expect(liveClients.has(client)).toBe(false);

    // What QueryClientProvider does on mount, and what the teardown hooks.
    client.mount();

    expect(liveClients.has(client)).toBe(true);
  });

  it('clearing a client empties a long-lived query out of the cache', () => {
    const client = new QueryClient();
    client.mount();

    client.getQueryCache().build(client, {
      queryKey: ['regions'],
      gcTime: TWENTY_FOUR_HOURS_MS,
    });

    expect(client.getQueryCache().getAll()).toHaveLength(1);

    // Destroys each query, and with it the gc timeout that would otherwise keep
    // the event loop alive for a day.
    client.clear();

    expect(client.getQueryCache().getAll()).toHaveLength(0);
  });

  it('keeps the per-query gcTime that made this necessary', () => {
    // Guards the assumption the teardown exists for: per-query options beat the
    // client default, because `Removable.updateGcTime` takes a Math.max. If a
    // future React Query version made the client default win, `gcTime: 0` in
    // the specs would be enough and this teardown could go.
    const client = new QueryClient({ defaultOptions: { queries: { gcTime: 0 } } });
    client.mount();

    const query = client.getQueryCache().build(client, {
      queryKey: ['districts'],
      gcTime: TWENTY_FOUR_HOURS_MS,
    });

    expect(query.gcTime).toBe(TWENTY_FOUR_HOURS_MS);

    client.clear();
  });
});
