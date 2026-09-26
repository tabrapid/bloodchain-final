import appJson from '../../app.json';
import {
  buildAppConfig,
  checkApiUrl,
  describeAppConfig,
  resolveAppEnvironment,
  type AppConfigBase,
} from './app-config';

const BASE = appJson.expo as unknown as AppConfigBase;

describe('resolveAppEnvironment', () => {
  it('takes APP_ENV when it names an environment', () => {
    expect(resolveAppEnvironment({ APP_ENV: 'production' })).toEqual({
      environment: 'production',
      source: 'APP_ENV',
    });
  });

  it('falls back to the EAS build profile when APP_ENV is unset', () => {
    expect(resolveAppEnvironment({ EAS_BUILD_PROFILE: 'preview' })).toEqual({
      environment: 'preview',
      source: 'EAS_BUILD_PROFILE',
    });
  });

  it('prefers APP_ENV over the build profile, so eas.json stays the statement of record', () => {
    expect(
      resolveAppEnvironment({ APP_ENV: 'development', EAS_BUILD_PROFILE: 'production' }).environment,
    ).toBe('development');
  });

  it('is development when nothing says otherwise', () => {
    expect(resolveAppEnvironment({})).toEqual({ environment: 'development', source: 'default' });
  });

  // The branch that matters: a typo must never be able to turn the strict
  // rules off by quietly resolving to something permissive, and must never
  // resolve to production either, which would fail a local build for a reason
  // nobody could see.
  it('refuses to guess from an unrecognised APP_ENV, and fails the build', () => {
    const resolved = resolveAppEnvironment({ APP_ENV: 'prod' });
    expect(resolved.invalid).toContain('"prod"');
  });

  it('names the profile when an unmapped EAS profile is the only signal', () => {
    const resolved = resolveAppEnvironment({ EAS_BUILD_PROFILE: 'simulator' });
    expect(resolved.invalid).toContain('simulator');
    expect(resolved.invalid).toContain('eas.json');
  });

  /**
   * The case that motivates treating this as an error rather than a warning:
   * someone adds a fourth EAS profile for the Play track and calls it `store`.
   * Defaulting a declared-but-unknown value to development would produce a
   * store binary with every strict rule switched off, and a check that merely
   * compared APP_ENV to the profile name would have blessed it.
   */
  it('will not build a profile whose environment it has never heard of', () => {
    const described = describeAppConfig(BASE, {
      APP_ENV: 'store',
      EXPO_PUBLIC_API_URL: 'https://api.example.org',
    });
    expect(described.errors.join(' ')).toContain('"store"');
  });

  it('still treats a bare local build, which declares nothing, as development', () => {
    const described = describeAppConfig(BASE, {});
    expect(described.errors).toHaveLength(0);
    expect(described.environment).toBe('development');
  });
});

describe('checkApiUrl', () => {
  it('accepts an https address for production', () => {
    expect(checkApiUrl('https://api.example.org', 'production')).toEqual({
      ok: true,
      url: 'https://api.example.org',
    });
  });

  it('strips a trailing slash so the base path does not double up', () => {
    const verdict = checkApiUrl('https://api.example.org/', 'production');
    expect(verdict).toEqual({ ok: true, url: 'https://api.example.org' });
  });

  it.each([
    ['http://api.example.org', 'cleartext'],
    ['https://localhost:3001', 'localhost'],
    ['https://127.0.0.1:3001', 'loopback IPv4'],
    ['https://127.1.2.3:3001', 'the rest of 127.0.0.0/8'],
    ['https://0.0.0.0:3001', 'the unspecified address'],
    ['https://[::1]:3001', 'loopback IPv6'],
    ['https://10.0.2.2:3001', "the emulator's alias for its host"],
    ['api.example.org', 'a bare host with no scheme'],
    ['ftp://api.example.org', 'a scheme that is not http'],
    ['https://api.example.org?token=x', 'a query string'],
    ['', 'an empty value'],
  ])('rejects %s in production (%s)', (value) => {
    expect(checkApiUrl(value, 'production').ok).toBe(false);
  });

  it('rejects a missing address in production and says what to set', () => {
    const verdict = checkApiUrl(undefined, 'production');
    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.reason).toContain('EXPO_PUBLIC_API_URL');
  });

  // Preview is allowed to be cleartext -- a staging box on a private network
  // often is -- but it still has to be reachable from somewhere other than the
  // machine that built it, and it still has to be stated.
  it('allows cleartext for preview but not loopback', () => {
    expect(checkApiUrl('http://staging.internal:3001', 'preview').ok).toBe(true);
    expect(checkApiUrl('http://localhost:3001', 'preview').ok).toBe(false);
  });

  it('requires preview to be explicit', () => {
    expect(checkApiUrl(undefined, 'preview').ok).toBe(false);
  });

  it('lets development point wherever it likes, including localhost', () => {
    expect(checkApiUrl('http://localhost:3001', 'development')).toEqual({
      ok: true,
      url: 'http://localhost:3001',
    });
    expect(checkApiUrl('http://10.0.2.2:3001', 'development').ok).toBe(true);
    expect(checkApiUrl('http://192.168.1.14:3001', 'development').ok).toBe(true);
  });

  it('still rejects a malformed address in development', () => {
    expect(checkApiUrl('not a url', 'development').ok).toBe(false);
  });
});

describe('describeAppConfig', () => {
  it('is an error for production to have no API address, and the build must not be produced', () => {
    const described = describeAppConfig(BASE, { APP_ENV: 'production' });
    expect(described.errors).not.toHaveLength(0);
    expect(described.errors.join(' ')).toContain('EXPO_PUBLIC_API_URL');
  });

  it('is an error for production to be given a cleartext or loopback address', () => {
    for (const url of ['http://api.example.org', 'https://localhost:3001']) {
      expect(
        describeAppConfig(BASE, { APP_ENV: 'production', EXPO_PUBLIC_API_URL: url }).errors,
      ).not.toHaveLength(0);
    }
  });

  it('is not an error for development to have no API address', () => {
    const described = describeAppConfig(BASE, { APP_ENV: 'development' });
    expect(described.errors).toHaveLength(0);
    expect(described.config.extra?.apiUrl).toBeUndefined();
  });

  it('bakes the environment and the address into extra for the app to read back', () => {
    const described = describeAppConfig(BASE, {
      APP_ENV: 'production',
      EXPO_PUBLIC_API_URL: 'https://api.example.org',
    });
    expect(described.errors).toHaveLength(0);
    expect(described.config.extra).toMatchObject({
      appEnv: 'production',
      apiUrl: 'https://api.example.org',
    });
  });

  it('carries the EAS project id only when one was supplied, and never invents one', () => {
    const without = describeAppConfig(BASE, { APP_ENV: 'development' });
    expect(without.config.extra?.eas).toBeUndefined();

    const with_ = describeAppConfig(BASE, {
      APP_ENV: 'development',
      EXPO_PUBLIC_EAS_PROJECT_ID: 'abc-123',
    });
    expect(with_.config.extra?.eas).toEqual({ projectId: 'abc-123' });
  });

  it('warns a production build that push and maps are unconfigured, naming the blockers', () => {
    const described = describeAppConfig(BASE, {
      APP_ENV: 'production',
      EXPO_PUBLIC_API_URL: 'https://api.example.org',
    });
    const warnings = described.warnings.join(' ');
    expect(warnings).toContain('EXTERNAL_BLOCKER_EAS_PROJECT_ID');
    expect(warnings).toContain('EXTERNAL_BLOCKER_ANDROID_MAPS_KEY');
  });

  it('does not nag a development build about credentials it does not need', () => {
    expect(describeAppConfig(BASE, { APP_ENV: 'development' }).warnings).toHaveLength(0);
  });

  it('puts the Maps key where Android reads it, and flags it for the app', () => {
    const described = describeAppConfig(BASE, {
      APP_ENV: 'development',
      GOOGLE_MAPS_ANDROID_API_KEY: 'key-from-the-environment',
    });
    expect(described.config.android?.config).toEqual({
      googleMaps: { apiKey: 'key-from-the-environment' },
    });
    expect(described.config.extra?.androidMapsConfigured).toBe(true);
  });

  it('says maps are unconfigured rather than leaving the app to guess', () => {
    const described = describeAppConfig(BASE, { APP_ENV: 'development' });
    expect(described.config.extra?.androidMapsConfigured).toBe(false);
    expect(described.config.android).not.toHaveProperty('config.googleMaps');
  });

  // The static half of the config is the half a release depends on and the
  // half nothing here is allowed to touch. `verify:android-release` reads
  // these; if this layer moved or dropped one, that check would keep passing
  // while checking a file the build no longer uses.
  it.each(['development', 'preview', 'production'] as const)(
    'leaves every value app.json owns untouched in a %s build',
    (environment) => {
      const { config } = describeAppConfig(BASE, {
        APP_ENV: environment,
        EXPO_PUBLIC_API_URL: 'https://api.example.org',
      });

      expect(config.name).toBe(BASE.name);
      expect(config.slug).toBe(BASE.slug);
      expect(config.scheme).toBe(BASE.scheme);
      expect(config.version).toBe(BASE.version);
      expect(config.android).toMatchObject({
        package: (BASE.android as Record<string, unknown>).package,
        versionCode: (BASE.android as Record<string, unknown>).versionCode,
        blockedPermissions: (BASE.android as Record<string, unknown>).blockedPermissions,
      });
      expect(config.ios).toEqual(BASE.ios);
      expect(config.plugins).toEqual(BASE.plugins);
    },
  );

  it('keeps the deep-link scheme, which the backend sends donors to', () => {
    // donor:// is in the password-reset and verification links the API mints.
    // Renaming it breaks those in flight, so it is asserted here as well as in
    // verify:android-release.
    expect(describeAppConfig(BASE, { APP_ENV: 'production', EXPO_PUBLIC_API_URL: 'https://a.example' }).config.scheme).toBe('donor');
  });
});

describe('buildAppConfig', () => {
  it('returns the config and reports warnings when the build is sound', () => {
    const warned: string[] = [];
    const config = buildAppConfig(
      BASE,
      { APP_ENV: 'production', EXPO_PUBLIC_API_URL: 'https://api.example.org' },
      (message) => warned.push(message),
    );
    expect(config.extra).toMatchObject({ appEnv: 'production' });
    expect(warned.join(' ')).toContain('EXTERNAL_BLOCKER_EAS_PROJECT_ID');
  });

  it('refuses to produce a production build with no API address', () => {
    expect(() => buildAppConfig(BASE, { APP_ENV: 'production' }, () => {})).toThrow(
      /not configured and was not produced/,
    );
  });

  it('tells whoever hit that how to build locally instead', () => {
    expect(() => buildAppConfig(BASE, { APP_ENV: 'production' }, () => {})).toThrow(
      /APP_ENV=development/,
    );
  });
});

/**
 * Every one of these was accepted by the first version of `checkApiUrl`, which
 * compared the hostname against a list of spellings of "localhost". They are
 * kept as a block because the lesson is not any single case: it is that judging
 * an address by how it is written judges spelling, and `fetch` does not care
 * how it is written. The second column is what a URL parser actually dials.
 */
describe('addresses that are the device itself, however they are spelled', () => {
  it.each([
    ['https://127.1', '127.0.0.1 via the two-part shorthand'],
    ['https://127.0.1', '127.0.0.1 via the three-part shorthand'],
    ['https://2130706433', '127.0.0.1 in decimal'],
    ['https://0x7f000001', '127.0.0.1 in hex'],
    ['https://0177.0.0.1', '127.0.0.1 with an octal first octet'],
    ['https://127.0.0.1.', 'a trailing dot'],
    ['https://LOCALHOST', 'uppercase'],
    ['https://localhost.', 'localhost with a trailing dot'],
    ['https://api.localhost', 'a localhost subdomain'],
    ['https://[::1]', 'IPv6 loopback'],
    ['https://[0:0:0:0:0:0:0:1]', 'IPv6 loopback written out'],
    ['https://[0000:0000:0000:0000:0000:0000:0000:0001]', 'IPv6 loopback zero-padded'],
    ['https://[::ffff:127.0.0.1]', 'IPv4 loopback mapped into IPv6'],
    ['https://0.0.0.0', 'the unspecified address'],
    ['https://[::]', 'the unspecified address in IPv6'],
    ['https://0', 'zero, which is 0.0.0.0'],
  ])('refuses %s (%s)', (url) => {
    expect(checkApiUrl(url, 'production').ok).toBe(false);
    expect(checkApiUrl(url, 'preview').ok).toBe(false);
  });
});

describe('addresses that exist but not for anyone else', () => {
  it.each([
    ['https://192.168.1.14:3001', 'a home network'],
    ['https://10.0.2.2', "the emulator's alias for its host"],
    ['https://172.20.0.5', 'a docker network'],
    ['https://100.100.0.1', 'carrier-grade NAT'],
    ['https://[fc00::1]', 'a unique-local IPv6 address'],
    ['https://[fe80::1]', 'a link-local IPv6 address'],
    ['https://staging', 'a single-label host'],
    ['https://239.1.2.3', 'a multicast address'],
  ])('refuses %s (%s)', (url) => {
    expect(checkApiUrl(url, 'production').ok).toBe(false);
  });

  /**
   * 169.254.169.254 is the cloud metadata endpoint. It is never an API host,
   * and a build pointed at it is either a mistake or something worse.
   */
  it('refuses the link-local metadata address by name', () => {
    const verdict = checkApiUrl('https://169.254.169.254', 'production');
    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.reason).toContain('link-local');
  });
});

describe('addresses that are not addresses', () => {
  it.each([
    ['https://:3001', 'an empty host -- a shell variable that did not expand'],
    ['https://api.example.com:999999', 'a port that is not a port'],
    ['https://api.example.org:0', 'port zero'],
    ['https://api.example.org:00080', 'a zero-padded port'],
    ['https://a b', 'a space in the host'],
    ['https://.', 'a bare dot'],
    ['https://-', 'a bare hyphen'],
    ['https://%6c%6fcalhost', 'a percent-encoded host'],
    ['https://-leading.example.org', 'a label starting with a hyphen'],
    ['https://api..example.org', 'an empty label'],
    ['https://api.example.org?x=1', 'a query string'],
    ['https://user@api.example.org', 'credentials'],
    ['ftp://api.example.org', 'a scheme that is not http'],
    ['api.example.org', 'no scheme at all'],
  ])('refuses %s (%s)', (url) => {
    expect(checkApiUrl(url, 'production').ok).toBe(false);
  });
});

describe('addresses a production build may use', () => {
  it.each([
    'https://api.bloodchain.uz',
    'https://api.bloodchain.uz:8443',
    'https://api.bloodchain.uz/v2',
    'https://a.b.c.example.org',
    // A public IP is unusual but not wrong -- a pilot on a fixed address with
    // its own certificate is a real deployment.
    'https://93.184.216.34',
  ])('accepts %s', (url) => {
    expect(checkApiUrl(url, 'production').ok).toBe(true);
  });

  it('still refuses all of them over cleartext', () => {
    expect(checkApiUrl('http://api.bloodchain.uz', 'production').ok).toBe(false);
    // ...but preview may use a private staging host over http.
    expect(checkApiUrl('http://staging.bloodchain.internal', 'preview').ok).toBe(true);
  });
});

describe('development is left alone', () => {
  it.each([
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    'http://10.0.2.2:3001',
    'http://192.168.1.14:3001',
    'https://xy-anon-8081.exp.direct',
  ])('accepts %s, because that is where a developer’s API actually is', (url) => {
    expect(checkApiUrl(url, 'development').ok).toBe(true);
  });

  it('still refuses something that is not an address at all', () => {
    expect(checkApiUrl('https://a b', 'development').ok).toBe(false);
    expect(checkApiUrl('not a url', 'development').ok).toBe(false);
  });
});
