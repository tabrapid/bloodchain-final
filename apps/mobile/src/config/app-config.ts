/**
 * What this build is configured to be.
 *
 * Three questions live here, and they live in ONE file on purpose. This module
 * is loaded twice, by two engines that share nothing: by Node, when Expo
 * evaluates `app.config.ts` to decide what to build, and by Hermes, when the
 * app reads back what it was built with. Expo transpiles only the config entry
 * file itself -- a nested `require` of a sibling `.ts` goes to Node's own
 * loader, which strips types but resolves nothing extensionless. A file with no
 * relative imports is the one shape both engines can load, so the seam that
 * decides production configuration has no import graph to go wrong.
 *
 * It follows that nothing here may import from react-native or from node:*.
 * Only the shared language.
 *
 *   1. Which environment is this?   `resolveAppEnvironment`
 *   2. Is that API address allowed?  `checkApiUrl`
 *   3. What config does that make?   `describeAppConfig` / `buildAppConfig`
 */

// ============================================================ 1. the environment

export const APP_ENVIRONMENTS = ['development', 'preview', 'production'] as const;

export type AppEnvironment = (typeof APP_ENVIRONMENTS)[number];

export function isAppEnvironment(value: string | undefined): value is AppEnvironment {
  return value !== undefined && (APP_ENVIRONMENTS as readonly string[]).includes(value);
}

export type EnvironmentResolution = {
  readonly environment: AppEnvironment;
  /** Which input decided it, so a surprising answer can be traced to its cause. */
  readonly source: 'APP_ENV' | 'EAS_BUILD_PROFILE' | 'default';
  /** Set when an input was present but unusable. Never silently ignored. */
  readonly warning?: string;
};

/**
 * Nothing in the app could answer "which environment is this?" before.
 *
 * `__DEV__` separates a dev bundle from a release one, which is a different
 * axis: `expo export` and `expo run:android --variant release` both produce
 * `__DEV__ === false`, and so does the visual-QA harness, which deliberately
 * points a release web export at `http://localhost:3001`. A policy keyed on
 * `__DEV__` would have called that harness a production build and refused to
 * run it.
 *
 * So the environment is stated rather than inferred. Every EAS profile sets
 * `APP_ENV` in `eas.json`; `EAS_BUILD_PROFILE`, which EAS sets itself, is the
 * backstop if someone adds a profile and forgets.
 *
 * An unrecognised value never falls through to `production`. A build that
 * claims to be production has to say so in a word this file knows, because
 * everything strict hangs off that answer and a typo must not be able to switch
 * it off. `development` is the loud direction: a development build refuses
 * nothing, so the mistake surfaces as a build pointing somewhere it should not
 * rather than as a store binary that quietly skipped its checks.
 */
export function resolveAppEnvironment(
  env: Readonly<Record<string, string | undefined>>,
): EnvironmentResolution {
  const declared = env.APP_ENV;
  if (isAppEnvironment(declared)) {
    return { environment: declared, source: 'APP_ENV' };
  }

  if (declared !== undefined && declared !== '') {
    return {
      environment: 'development',
      source: 'default',
      warning:
        `APP_ENV is "${declared}", which is not one of ${APP_ENVIRONMENTS.join(', ')}. ` +
        'Treating this as a development build.',
    };
  }

  const profile = env.EAS_BUILD_PROFILE;
  if (isAppEnvironment(profile)) {
    return { environment: profile, source: 'EAS_BUILD_PROFILE' };
  }

  if (profile !== undefined && profile !== '') {
    return {
      environment: 'development',
      source: 'default',
      warning:
        `EAS_BUILD_PROFILE is "${profile}", which no environment maps to, and APP_ENV is unset. ` +
        "Treating this as a development build. Set APP_ENV in that profile's env block in eas.json.",
    };
  }

  return { environment: 'development', source: 'default' };
}

// =============================================================== 2. the address

export type ApiUrlVerdict =
  | { readonly ok: true; readonly url: string }
  | { readonly ok: false; readonly reason: string };

/** `scheme://host[:port][/path]`, and nothing else -- no query, no fragment, no credentials. */
const ABSOLUTE_HTTP_URL = /^(https?):\/\/([^/?#@]+?)(?::(\d{1,5}))?(\/[^?#]*)?$/i;

/**
 * Addresses that mean "this device".
 *
 * On a phone they resolve to the phone, where nothing is listening. In
 * development that is the point -- the simulator really is the machine running
 * the API. Anywhere else it is a build that can only work on the laptop that
 * made it.
 */
function isLoopback(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host === '[::1]' ||
    host === '[0:0:0:0:0:0:0:1]' ||
    /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) ||
    // The Android emulator's alias for the host machine. Useful in development,
    // meaningless on a real device.
    host === '10.0.2.2'
  );
}

/** Trailing slashes would produce `https://host//api/v1` once the base path is appended. */
function normalise(url: string): string {
  return url.replace(/\/+$/, '');
}

/**
 * Judge an address for an environment.
 *
 * The rule is not the same in every environment, and pretending it was is the
 * bug this fixes. A development build should follow the laptop around and reach
 * `http://localhost:3001`; a store build that does the same thing is an app
 * that cannot work at all, shipped.
 *
 * `raw` being absent is not automatically an error: in development the caller
 * derives one instead. In preview and production it is the error, because those
 * builds leave the machine that made them and have to say where they point.
 *
 * `URL` is a partial polyfill under Hermes whose behaviour differs from Node's
 * on exactly the malformed inputs this has to judge, so the shape is matched
 * here instead, where both engines agree.
 */
export function checkApiUrl(
  raw: string | undefined,
  environment: AppEnvironment,
): ApiUrlVerdict {
  const value = raw?.trim();

  if (!value) {
    if (environment === 'development') {
      return { ok: false, reason: 'No API address was configured.' };
    }
    return {
      ok: false,
      reason:
        `A ${environment} build must be given its API address explicitly. ` +
        'Set EXPO_PUBLIC_API_URL for this build; it is not derived and there is no default.',
    };
  }

  const match = ABSOLUTE_HTTP_URL.exec(value);
  if (!match) {
    return {
      ok: false,
      reason:
        `"${value}" is not an absolute http(s) address. Expected scheme://host[:port][/path] ` +
        'with no query string, fragment or credentials.',
    };
  }

  const [, scheme = '', hostname = '', port] = match;

  if (port !== undefined && Number(port) > 65535) {
    return { ok: false, reason: `"${value}" has port ${port}, which is not a port.` };
  }

  // Development takes whatever it is given. Someone pointing a dev build at a
  // laptop, a tunnel or an emulator alias knows where their API is.
  if (environment === 'development') {
    return { ok: true, url: normalise(value) };
  }

  if (isLoopback(hostname)) {
    return {
      ok: false,
      reason:
        `"${value}" points at the device the app is running on. A ${environment} build cannot ` +
        'reach an API there; it needs an address that exists on the network.',
    };
  }

  if (environment === 'production' && scheme.toLowerCase() !== 'https') {
    return {
      ok: false,
      reason:
        `"${value}" is cleartext HTTP. A production build carries donors' health data and must ` +
        'use https.',
    };
  }

  return { ok: true, url: normalise(value) };
}

// ================================================================ 3. the config

/** The subset of the Expo config this layer reads or writes. Structural, so `expo/config`'s own type satisfies it. */
export type AppConfigBase = {
  name?: string;
  slug?: string;
  android?: { config?: Record<string, unknown>; [key: string]: unknown };
  extra?: Record<string, unknown>;
  [key: string]: unknown;
};

/** What the app can read back at runtime through `Constants.expoConfig.extra`. */
export type AppConfigExtra = {
  readonly appEnv: AppEnvironment;
  /** Absent in a development build that derives its address from Metro. */
  readonly apiUrl?: string;
  readonly eas?: { readonly projectId: string };
  /**
   * Whether an Android Maps key reached this build. The key itself goes in the
   * manifest, where Android needs it; this is the flag the app checks so a map
   * can say it is unconfigured instead of drawing a grey rectangle.
   */
  readonly androidMapsConfigured: boolean;
};

export type AppConfigDescription = {
  readonly environment: AppEnvironment;
  readonly config: AppConfigBase;
  /** Conditions that make the build wrong. Non-empty means it must not be produced. */
  readonly errors: readonly string[];
  /** Conditions someone needs to know about that do not invalidate the build. */
  readonly warnings: readonly string[];
};

const EAS_PROJECT_ID = 'EXPO_PUBLIC_EAS_PROJECT_ID';
const MAPS_KEY = 'GOOGLE_MAPS_ANDROID_API_KEY';

/**
 * The whole decision as a value, so every branch is reachable from a test.
 *
 * `app.json` remains the source of every static value -- the identifiers, the
 * permissions, the plugin options -- and this never edits them. What it adds is
 * the handful that cannot be static because they differ per build and must
 * never be committed.
 */
export function describeAppConfig(
  base: AppConfigBase,
  env: Readonly<Record<string, string | undefined>>,
): AppConfigDescription {
  const errors: string[] = [];
  const warnings: string[] = [];

  const resolved = resolveAppEnvironment(env);
  const environment = resolved.environment;
  if (resolved.warning) warnings.push(resolved.warning);

  // ------------------------------------------------------------------ the API

  const declaredApiUrl = env.EXPO_PUBLIC_API_URL;
  const verdict = checkApiUrl(declaredApiUrl, environment);

  let apiUrl: string | undefined;
  if (verdict.ok) {
    apiUrl = verdict.url;
  } else if (environment === 'development') {
    // Not an error: a development build with no address derives one from
    // whichever machine served the bundle. That is what makes `expo start`
    // work on a phone, an emulator and a simulator with nothing configured.
    if (declaredApiUrl?.trim()) warnings.push(verdict.reason);
  } else {
    errors.push(verdict.reason);
  }

  // --------------------------------------------------------------------- push

  const projectId = env[EAS_PROJECT_ID]?.trim();
  if (!projectId && environment !== 'development') {
    warnings.push(
      `${EAS_PROJECT_ID} is not set, so this ${environment} build cannot register for push ` +
        'notifications. No Expo project exists for this product yet ' +
        '(EXTERNAL_BLOCKER_EAS_PROJECT_ID); the app will say so rather than appear to work.',
    );
  }

  // --------------------------------------------------------------------- maps

  const mapsKey = env[MAPS_KEY]?.trim();
  if (!mapsKey && environment !== 'development') {
    warnings.push(
      `${MAPS_KEY} is not set, so every map in this ${environment} build will be blank on ` +
        'Android (EXTERNAL_BLOCKER_ANDROID_MAPS_KEY). iOS is unaffected.',
    );
  }

  const extra: AppConfigExtra = {
    appEnv: environment,
    ...(apiUrl ? { apiUrl } : {}),
    ...(projectId ? { eas: { projectId } } : {}),
    androidMapsConfigured: Boolean(mapsKey),
  };

  const config: AppConfigBase = {
    ...base,
    extra: { ...base.extra, ...extra },
    ...(mapsKey
      ? {
          android: {
            ...base.android,
            config: { ...base.android?.config, googleMaps: { apiKey: mapsKey } },
          },
        }
      : {}),
  };

  return { environment, config, errors, warnings };
}

/**
 * What `app.config.ts` calls.
 *
 * Throws rather than returning a config that describes a build nobody should
 * install. A store binary with no API address is not a degraded build, it is a
 * broken one, and the cheapest moment to say so is before it exists rather than
 * after a donor has installed it.
 */
export function buildAppConfig(
  base: AppConfigBase,
  env: Readonly<Record<string, string | undefined>>,
  onWarn: (message: string) => void = (message) => console.warn(`[app.config] ${message}`),
): AppConfigBase {
  const described = describeAppConfig(base, env);

  for (const warning of described.warnings) onWarn(warning);

  if (described.errors.length > 0) {
    throw new Error(
      `This ${described.environment} build is not configured and was not produced:\n` +
        described.errors.map((error) => `  - ${error}`).join('\n') +
        '\n\nNo address is guessed for a build that leaves this machine. If you are building ' +
        'locally for engineering validation, set APP_ENV=development.',
    );
  }

  return described.config;
}
