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
  it('refuses to guess from an unrecognised APP_ENV, and says so', () => {
    const resolved = resolveAppEnvironment({ APP_ENV: 'prod' });
    expect(resolved.environment).toBe('development');
    expect(resolved.source).toBe('default');
    expect(resolved.warning).toContain('"prod"');
  });

  it('names the profile when an unmapped EAS profile is the only signal', () => {
    const resolved = resolveAppEnvironment({ EAS_BUILD_PROFILE: 'simulator' });
    expect(resolved.environment).toBe('development');
    expect(resolved.warning).toContain('simulator');
    expect(resolved.warning).toContain('eas.json');
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
