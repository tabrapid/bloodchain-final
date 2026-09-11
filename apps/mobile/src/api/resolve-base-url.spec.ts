jest.mock('../auth/storage', () => ({
  getAccessToken: jest.fn().mockResolvedValue(null),
  getRefreshToken: jest.fn().mockResolvedValue(null),
  setAccessToken: jest.fn().mockResolvedValue(undefined),
  deleteAccessToken: jest.fn().mockResolvedValue(undefined),
  deleteRefreshToken: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() } }));

// Without a top-level import or export TypeScript treats a spec as a global
// script, and this file's `load` helper then collides with the one in
// config.spec.ts -- tests pass, typecheck fails.
export {};

/**
 * Which address the app talks to.
 *
 * `Platform.OS` is "android" for both an emulator and a phone, and the two need
 * different addresses -- the emulator reaches the host machine on 10.0.2.2, a
 * phone needs the laptop's LAN address. That cannot be derived, only
 * discovered, so the client probes every candidate and keeps the first that
 * answers. These cover the cases that previously ended in "the server took too
 * long to respond".
 */
function load(candidates: string[]) {
  let mod: typeof import('./client');
  jest.isolateModules(() => {
    jest.doMock('./config', () => ({
      apiCandidates: candidates,
      apiBaseUrl: candidates[0],
      apiBasePath: '/api/v1',
      apiHostWarning: undefined,
    }));
    mod = require('./client');
  });
  return mod!;
}

/** Answers /health on `reachable` only; every other host never resolves. */
function mockNetwork(reachable: string | null) {
  const calls: string[] = [];
  global.fetch = jest.fn((url: string, init?: RequestInit) => {
    calls.push(url);
    if (url.endsWith('/health')) {
      if (reachable && url.startsWith(reachable)) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
      }
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    }
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ data: { ok: true } }) });
  }) as unknown as typeof fetch;
  return calls;
}

const LAN = 'http://192.168.1.14:3001';
const EMULATOR = 'http://10.0.2.2:3001';
const LOCAL = 'http://localhost:3001';

describe('API address resolution', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('uses the emulator address when only that one answers', async () => {
    const calls = mockNetwork(EMULATOR);
    const { apiRequest } = load([LAN, EMULATOR, LOCAL]);
    await apiRequest('/api/v1/me');
    expect(calls.some((u) => u === `${EMULATOR}/api/v1/me`)).toBe(true);
    expect(calls.some((u) => u === `${LAN}/api/v1/me`)).toBe(false);
  });

  it('uses the LAN address when only that one answers', async () => {
    const calls = mockNetwork(LAN);
    const { apiRequest } = load([LAN, EMULATOR, LOCAL]);
    await apiRequest('/api/v1/me');
    expect(calls.some((u) => u === `${LAN}/api/v1/me`)).toBe(true);
  });

  it('probes every candidate rather than stopping at the first', async () => {
    const calls = mockNetwork(LOCAL);
    const { apiRequest } = load([LAN, EMULATOR, LOCAL]);
    await apiRequest('/api/v1/me');
    for (const candidate of [LAN, EMULATOR, LOCAL]) {
      expect(calls).toContain(`${candidate}/api/v1/health`);
    }
  });

  /**
   * An explicitly configured address is a statement of fact, not a guess, and
   * probing it would waste the timeout on a server that is merely slow to start.
   */
  it('never probes when a single explicit address is configured', async () => {
    const calls = mockNetwork(null);
    const { apiRequest } = load(['https://api.example.test']);
    await apiRequest('/api/v1/me');
    expect(calls).toEqual(['https://api.example.test/api/v1/me']);
  });

  it('resolves once and reuses the address for later requests', async () => {
    const calls = mockNetwork(EMULATOR);
    const { apiRequest } = load([LAN, EMULATOR, LOCAL]);
    await apiRequest('/api/v1/me');
    const afterFirst = calls.filter((u) => u.endsWith('/health')).length;
    await apiRequest('/api/v1/donations');
    expect(calls.filter((u) => u.endsWith('/health')).length).toBe(afterFirst);
  });
});

describe('when no candidate answers', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  /**
   * Falling back rather than throwing here matters: the request then fails with
   * a real error naming a real address, instead of being swallowed by the probe
   * and surfacing as something the screens cannot explain.
   */
  it('falls back to the best guess and reports it in the error', async () => {
    const calls: string[] = [];
    global.fetch = jest.fn((url: string, init?: RequestInit) => {
      calls.push(url);
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    }) as unknown as typeof fetch;

    const { apiRequest, ApiRequestError } = load([LAN, EMULATOR, LOCAL]);
    const pending = apiRequest('/api/v1/me').catch((err: unknown) => err);
    await jest.advanceTimersByTimeAsync(3000); // past the probe timeout
    await jest.advanceTimersByTimeAsync(20000); // past the request timeout
    const error = await pending;

    expect(error).toBeInstanceOf(ApiRequestError);
    expect((error as InstanceType<typeof ApiRequestError>).message).toContain(LAN);
    expect(calls).toContain(`${LAN}/api/v1/me`);
  });
});
