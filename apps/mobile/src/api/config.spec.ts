/**
 * Where requests go, per environment.
 *
 * The default used to be a flat `http://localhost:3001`. On a phone or an
 * emulator `localhost` is *that device*, so nothing answered, the request hung
 * until it timed out, and the login screen said the server took too long --
 * with no hint that the address was the problem.
 *
 * The module reads its inputs once at import, so each case re-imports it with
 * `jest.isolateModules` after setting them.
 */
function load(opts: {
  platform?: 'ios' | 'android';
  hostUri?: string;
  extraApiUrl?: string;
  envApiUrl?: string;
}) {
  let mod: typeof import('./config');
  // Reset immediately before re-mocking, not only in `afterEach`.
  //
  // Under jest-expo 56 the `react-native` instance that a previous `load()`
  // put in the registry survives into the next `jest.isolateModules` sandbox,
  // so the second call in a file kept the first call's `Platform.OS` and the
  // Android cases were silently checked against iOS. `afterEach`'s reset is
  // too late: it runs between tests, and this helper is called more than once
  // inside one. Resetting here makes every case evaluate its own mocks.
  jest.resetModules();
  jest.isolateModules(() => {
    jest.doMock('expo-constants', () => ({
      __esModule: true,
      default: {
        expoConfig: {
          hostUri: opts.hostUri,
          extra: opts.extraApiUrl ? { apiUrl: opts.extraApiUrl } : undefined,
        },
      },
    }));
    jest.doMock('react-native', () => ({ Platform: { OS: opts.platform ?? 'ios' } }));
    if (opts.envApiUrl) {
      process.env.EXPO_PUBLIC_API_URL = opts.envApiUrl;
    } else {
      delete process.env.EXPO_PUBLIC_API_URL;
    }
    mod = require('./config');
  });
  return mod!;
}

afterEach(() => {
  delete process.env.EXPO_PUBLIC_API_URL;
  jest.resetModules();
});

describe('apiBaseUrl', () => {
  it('follows the machine that served the bundle', () => {
    // A laptop on Wi-Fi today, tethered to a phone tomorrow: the address
    // changes, and nothing should need editing when it does.
    expect(load({ hostUri: '192.168.1.14:8081' }).apiBaseUrl).toBe('http://192.168.1.14:3001');
    expect(load({ hostUri: '10.42.0.7:8081' }).apiBaseUrl).toBe('http://10.42.0.7:3001');
  });

  /**
   * The Android emulator is its own machine. Expo forwards Metro's port over
   * adb, so the bundle arrives from `localhost` -- correct for Metro, and the
   * one address on the emulator that can never reach the API.
   */
  it('rewrites loopback to 10.0.2.2 on Android, where localhost is the emulator', () => {
    expect(load({ platform: 'android', hostUri: 'localhost:8081' }).apiBaseUrl)
      .toBe('http://10.0.2.2:3001');
    expect(load({ platform: 'android', hostUri: '127.0.0.1:8081' }).apiBaseUrl)
      .toBe('http://10.0.2.2:3001');
  });

  it('leaves loopback alone on iOS, where the simulator shares the host', () => {
    expect(load({ platform: 'ios', hostUri: 'localhost:8081' }).apiBaseUrl)
      .toBe('http://localhost:3001');
  });

  it('does not rewrite a real LAN address on Android', () => {
    expect(load({ platform: 'android', hostUri: '192.168.1.14:8081' }).apiBaseUrl)
      .toBe('http://192.168.1.14:3001');
  });

  it('lets an explicit setting win over everything', () => {
    expect(load({ hostUri: '192.168.1.14:8081', extraApiUrl: 'https://api.bloodchain.uz' }).apiBaseUrl)
      .toBe('https://api.bloodchain.uz');
  });

  // `EXPO_PUBLIC_API_URL` is not covered here: babel-preset-expo substitutes
  // those names at transform time, so by the time this file runs the read is
  // already a literal and setting the variable has no effect. That is also
  // true of the real app -- see the note on it in config.ts.

  it('falls back to localhost when there is no Metro host at all', () => {
    expect(load({ platform: 'ios' }).apiBaseUrl).toBe('http://localhost:3001');
  });
});

describe('apiHostWarning', () => {
  it('warns that a tunnelled Metro host relays only the bundle', () => {
    const { apiHostWarning } = load({ hostUri: 'xy-anon-8081.exp.direct' });
    expect(apiHostWarning).toMatch(/tunnel/i);
    expect(apiHostWarning).toContain('xy-anon-8081.exp.direct');
  });

  it('warns for an ngrok tunnel too', () => {
    const { apiHostWarning } = load({ hostUri: 'abc123.ngrok-free.app:8081' });
    expect(apiHostWarning).toMatch(/tunnel/i);
  });

  it('stays silent for an ordinary LAN host', () => {
    const { apiHostWarning } = load({ hostUri: '192.168.1.14:8081' });
    expect(apiHostWarning).toBeUndefined();
  });

  it('stays silent on an emulator reaching the host machine', () => {
    const { apiHostWarning } = load({ hostUri: 'localhost:8081', platform: 'android' });
    expect(apiHostWarning).toBeUndefined();
  });

  /**
   * An explicit address is the escape hatch for exactly the tunnel case, so it
   * must not carry the warning that tells people to set it.
   */
  it('stays silent when an explicit address is configured, tunnel or not', () => {
    const { apiHostWarning } = load({
      hostUri: 'xy-anon-8081.exp.direct',
      extraApiUrl: 'https://api.example.test',
    });
    expect(apiHostWarning).toBeUndefined();
  });

  it('explains a missing Metro host rather than silently using localhost', () => {
    const { apiHostWarning } = load({ hostUri: undefined });
    expect(apiHostWarning).toMatch(/could not tell which machine/i);
  });
});
