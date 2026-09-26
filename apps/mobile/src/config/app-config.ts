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
  /**
   * Set when something declared an environment this file does not know.
   *
   * That is a build failure, not a warning. Defaulting a declared-but-unknown
   * value to `development` would mean a profile named `store` -- a plausible
   * thing for someone to add to eas.json -- produced a store binary with every
   * strict rule switched off and CI green.
   */
  readonly invalid?: string;
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
      invalid:
        `APP_ENV is "${declared}", which is not one of ${APP_ENVIRONMENTS.join(', ')}. ` +
        'Name the environment this build is for; it is not guessed.',
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
      invalid:
        `EAS_BUILD_PROFILE is "${profile}", which no environment maps to, and APP_ENV is unset. ` +
        "Set APP_ENV in that profile's env block in eas.json; it is not guessed.",
    };
  }

  return { environment: 'development', source: 'default' };
}

// =============================================================== 2. the address

export type ApiUrlVerdict =
  | { readonly ok: true; readonly url: string }
  | { readonly ok: false; readonly reason: string };

/**
 * `scheme://authority[/path]`. The authority is checked separately, below,
 * because a negated character class is not a host grammar -- the first version
 * of this used one and accepted `https://:3001`, `https://a b` and
 * `https://api.example.com:999999`.
 */
const ABSOLUTE_HTTP_URL = /^(https?):\/\/([^/?#]+)(\/[^?#]*)?$/i;

/** A bracketed IPv6 literal, or anything else, plus an optional port. */
const AUTHORITY = /^(\[[0-9A-Fa-f:.]+\]|[^:[\]/?#@\\]+)(?::(\d+))?$/;

/** One DNS label: letters, digits and inner hyphens. */
const DNS_LABEL = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

/**
 * One part of an IPv4 address, in any of the three bases a URL parser accepts.
 *
 * This is not pedantry. `https://127.1`, `https://2130706433` and
 * `https://0x7f000001` are all the loopback address as far as `fetch` is
 * concerned, and all three sailed through the string comparison this replaced.
 * Anything judging "is this address the device itself?" has to canonicalise
 * first or it is judging spelling.
 */
function parseIpv4Part(part: string): number | null {
  if (part === '') return null;

  let radix = 10;
  let digits = part;
  if (/^0[xX]/.test(part)) {
    radix = 16;
    digits = part.slice(2);
    if (digits === '') return 0;
  } else if (/^0[0-7]+$/.test(part)) {
    radix = 8;
    digits = part.slice(1);
  }

  const shape = radix === 16 ? /^[0-9a-fA-F]+$/ : radix === 8 ? /^[0-7]+$/ : /^[0-9]+$/;
  if (!shape.test(digits)) return null;

  const value = parseInt(digits, radix);
  return Number.isSafeInteger(value) ? value : null;
}

/** The address as a 32-bit number, or null when the host is not IPv4 in any spelling. */
function asIpv4(host: string): number | null {
  const parts = host.split('.');
  // A trailing dot is legal and means the same address.
  if (parts.length > 1 && parts[parts.length - 1] === '') parts.pop();
  if (parts.length === 0 || parts.length > 4) return null;

  const numbers = parts.map(parseIpv4Part);
  if (numbers.some((value) => value === null)) return null;

  // The last part carries whatever octets were left out: 127.1 is 127.0.0.1.
  const last = numbers[numbers.length - 1]!;
  if (last >= 256 ** (4 - (parts.length - 1))) return null;

  let value = last;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const octet = numbers[index]!;
    if (octet > 255) return null;
    value += octet * 256 ** (3 - index);
  }
  return value >>> 0;
}

function ipv4Octets(value: number): [number, number, number, number] {
  return [(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255];
}

/**
 * Addresses a build that has left this machine cannot usefully reach.
 *
 * Loopback is the device itself. Link-local includes 169.254.169.254, the cloud
 * metadata endpoint, which is never an API host and is worth refusing loudly.
 * The private ranges are someone's laptop or office LAN -- fine in development,
 * and a build that cannot work for anyone else if it ships.
 */
function ipv4Problem(value: number): string | undefined {
  const [a, b] = ipv4Octets(value);
  if (a === 0) return 'the unspecified address';
  if (a === 127) return 'the loopback address -- the device the app is running on';
  if (a === 10) return 'a private network address';
  if (a === 172 && b! >= 16 && b! <= 31) return 'a private network address';
  if (a === 192 && b === 168) return 'a private network address';
  if (a === 169 && b === 254) return 'a link-local address';
  if (a === 100 && b! >= 64 && b! <= 127) return 'a carrier-grade NAT address';
  if (a! >= 224) return 'a multicast or reserved address';
  return undefined;
}

/** Expands `::`, so `::1`, `0:0:0:0:0:0:0:1` and `[0000:...:0001]` are one address. */
function expandIpv6(literal: string): string[] | null {
  const body = literal.replace(/^\[|\]$/g, '');
  if (body.includes('%')) return null; // a zone id is device-local by definition
  if ((body.match(/::/g) ?? []).length > 1) return null;

  const [head = '', tail = ''] = body.includes('::') ? body.split('::') : [body, undefined as never];
  const headParts = head === '' ? [] : head.split(':');
  const tailParts = body.includes('::') ? (tail === '' ? [] : tail.split(':')) : [];

  // A trailing IPv4 form: ::ffff:127.0.0.1
  const embedded = [...headParts, ...tailParts].find((part) => part.includes('.'));
  let ipv4Groups: string[] = [];
  if (embedded) {
    const value = asIpv4(embedded);
    if (value === null) return null;
    const [a, b, c, d] = ipv4Octets(value);
    ipv4Groups = [
      ((a << 8) | b).toString(16),
      ((c << 8) | d).toString(16),
    ];
  }

  const strip = (parts: string[]) => parts.filter((part) => !part.includes('.'));
  const left = strip(headParts);
  const right = [...strip(tailParts), ...ipv4Groups];
  const missing = 8 - left.length - right.length;
  if (!body.includes('::')) {
    const all = [...left, ...right];
    return all.length === 8 ? all.map((part) => part.padStart(4, '0')) : null;
  }
  if (missing < 0) return null;
  return [...left, ...Array(missing).fill('0'), ...right].map((part) => part.padStart(4, '0'));
}

function ipv6Problem(literal: string): string | undefined {
  const groups = expandIpv6(literal);
  if (!groups) return 'not a usable IPv6 address';

  const joined = groups.join(':');
  if (joined === '0000:0000:0000:0000:0000:0000:0000:0001') {
    return 'the loopback address -- the device the app is running on';
  }
  if (joined === '0000:0000:0000:0000:0000:0000:0000:0000') return 'the unspecified address';

  // ::ffff:a.b.c.d -- an IPv4 address wearing an IPv6 hat.
  if (/^0000:0000:0000:0000:0000:ffff:/.test(joined)) {
    const high = parseInt(groups[6]!, 16);
    const low = parseInt(groups[7]!, 16);
    return ipv4Problem(((high << 16) | low) >>> 0);
  }

  const first = parseInt(groups[0]!, 16);
  if ((first & 0xffc0) === 0xfe80) return 'a link-local address';
  if ((first & 0xfe00) === 0xfc00) return 'a unique-local address';
  return undefined;
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
 * here instead, where both engines agree -- and matched against what a URL
 * parser would actually dial, rather than against how the value is spelled.
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

  const malformed = (detail: string): ApiUrlVerdict => ({
    ok: false,
    reason: `"${value}" is not a usable API address: ${detail}.`,
  });

  const match = ABSOLUTE_HTTP_URL.exec(value);
  if (!match) {
    return malformed(
      'expected scheme://host[:port][/path] with no query string, fragment or credentials',
    );
  }

  const [, scheme = '', authority = ''] = match;
  const parts = AUTHORITY.exec(authority);
  if (!parts) return malformed('the host and port are not a valid authority');

  const [, host = '', port] = parts;

  if (port !== undefined) {
    if (!/^[1-9][0-9]{0,4}$/.test(port) || Number(port) > 65535) {
      return malformed(`${port} is not a port`);
    }
  }

  const isIpv6Literal = host.startsWith('[');
  const ipv4 = isIpv6Literal ? null : asIpv4(host);

  if (!isIpv6Literal && ipv4 === null) {
    // A DNS name. Anything that is not a name and not an address is neither.
    const labels = host.toLowerCase().replace(/\.$/, '').split('.');
    if (labels.some((label) => !DNS_LABEL.test(label)) || host.length > 253) {
      return malformed('the host is neither a valid hostname nor an IP address');
    }
  }

  // Development takes whatever it is given. Someone pointing a dev build at a
  // laptop, a tunnel or an emulator alias knows where their API is.
  if (environment === 'development') {
    return { ok: true, url: normalise(value) };
  }

  const unreachable = isIpv6Literal
    ? ipv6Problem(host)
    : ipv4 !== null
      ? ipv4Problem(ipv4)
      : /^(localhost|.*\.localhost)$/.test(host.toLowerCase().replace(/\.$/, ''))
        ? 'the loopback address -- the device the app is running on'
        : host.replace(/\.$/, '').includes('.')
          ? undefined
          : 'a single-label host, which only resolves on one network';

  if (unreachable) {
    return {
      ok: false,
      reason:
        `"${value}" points at ${unreachable}. A ${environment} build needs an address that ` +
        'exists on the network it will run on.',
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
  if (resolved.invalid) errors.push(resolved.invalid);

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

  /*
    "Does this build have one?", not "was this variable set?".

    The env var is one way the value arrives and the static config is the
    other: `eas init` writes `extra.eas.projectId` into app.json, and that is
    the documented route by which EXTERNAL_BLOCKER_EAS_PROJECT_ID closes. Asking
    only about the variable meant the build log would insist push could never
    work, on a build where it did -- while the runtime reader and the release
    check, which both read the merged value, disagreed. Three readers of one
    fact, and the loudest one wrong, teaches people to ignore build warnings.
  */
  const staticProjectId = (base.extra?.eas as { projectId?: string } | undefined)?.projectId;
  const projectId = env[EAS_PROJECT_ID]?.trim() || staticProjectId?.trim() || undefined;
  if (!projectId && environment !== 'development') {
    warnings.push(
      `${EAS_PROJECT_ID} is not set, so this ${environment} build cannot register for push ` +
        'notifications. No Expo project exists for this product yet ' +
        '(EXTERNAL_BLOCKER_EAS_PROJECT_ID); the app will say so rather than appear to work.',
    );
  }

  // --------------------------------------------------------------------- maps

  /*
    The same question, and here getting it wrong reaches a donor rather than a
    log. `android.config.googleMaps.apiKey` in app.json is Expo's own documented
    way to set the key; it reaches the manifest and the map works. Deriving the
    flag from the environment alone wrote `androidMapsConfigured: false` over
    that, and `LocationMap` would then tell someone mid-emergency that the map
    was unavailable while it was busy working.
  */
  const staticMapsKey = (
    (base.android?.config as { googleMaps?: { apiKey?: string } } | undefined)?.googleMaps?.apiKey
  );
  const mapsKey = env[MAPS_KEY]?.trim() || staticMapsKey?.trim() || undefined;
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
