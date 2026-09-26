import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { checkApiUrl, isAppEnvironment, type AppEnvironment } from '../config/app-config';

/** The port the API listens on (see the API's `PORT`, default 3001). */
const API_PORT = 3001;

/**
 * The host the app is *already* talking to: whatever machine served this
 * bundle. Expo reports it as `host:port`, e.g. `192.168.1.14:8081`.
 *
 * Deriving the API host from it is what makes the app follow the dev machine
 * around without anyone editing a file. The previous default was a flat
 * `http://localhost:3001`, and on a phone or an emulator `localhost` is *that
 * device* -- nothing answers, the request hangs until it times out, and the
 * login screen says the server took too long. Which network the laptop happens
 * to be on (tethered to a phone one day, Wi-Fi the next) changes its address,
 * so any address written down by hand goes stale.
 *
 * All of which is true of a developer's machine and of nowhere else. A build
 * that leaves this laptop has no Metro to follow, which is why this is now
 * reached only in development.
 */
function metroHostUri(): string | undefined {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants.expoGoConfig as { debuggerHost?: string } | undefined)?.debuggerHost ??
    (Constants.manifest2 as { extra?: { expoGo?: { debuggerHost?: string } } } | undefined)?.extra
      ?.expoGo?.debuggerHost;

  return hostUri?.split('/')[0]?.split(':')[0] || undefined;
}

/**
 * The Android emulator is its own machine: `localhost` there is the emulator,
 * and the computer running it answers on 10.0.2.2 instead. Expo's CLI forwards
 * the Metro port over adb, so the bundle *does* arrive from `localhost` --
 * which means the host we just derived is right for Metro and wrong for
 * everything else, this API included.
 */
function resolveHost(host: string, platform: string): string {
  const isLoopback = host === 'localhost' || host === '127.0.0.1';
  return isLoopback && platform === 'android' ? '10.0.2.2' : host;
}

/**
 * Hosts that only carry Metro, never the API.
 *
 * `expo start --tunnel` serves the bundle through a public relay, so the host
 * the app was loaded from is something like `xy-anon-8081.exp.direct`. Only
 * Metro's port is relayed -- nothing answers on 3001 there -- so deriving the
 * API address from it produces a URL that hangs until the request times out
 * and reports "the server took too long to respond". That is the one case this
 * file cannot solve on its own: the phone and the API are on different
 * networks, and no address can be guessed. Say so instead of failing silently.
 */
const TUNNEL_HOST = /\.(exp\.direct|ngrok\.io|ngrok-free\.app|trycloudflare\.com|loca\.lt)$/i;

export type ApiResolution =
  | { readonly ok: true; readonly candidates: readonly string[]; readonly warning?: string }
  | { readonly ok: false; readonly error: string };

/**
 * Where this build is allowed to send requests.
 *
 * A pure function of its inputs, which is the only way the production branch
 * can be tested at all: `EXPO_PUBLIC_*` names are substituted into the bundle
 * by babel when it is built, not read at runtime, so no test can set one.
 *
 * The three environments are genuinely different problems, and treating them
 * as one was the bug. Development has to find an API that moves around.
 * Preview and production have to be told, once, and refuse everything else.
 */
export function resolveApiConfig(input: {
  readonly environment: AppEnvironment;
  readonly explicitUrl?: string;
  readonly metroHost?: string;
  readonly platform: string;
}): ApiResolution {
  const { environment, explicitUrl, metroHost, platform } = input;

  if (environment !== 'development') {
    const verdict = checkApiUrl(explicitUrl, environment);
    if (!verdict.ok) return { ok: false, error: verdict.reason };
    // Exactly one address, so the probe below never runs and there is nothing
    // to fall back to. That is the whole point of fail-closed: a build that
    // leaves this machine talks to the address it was given, or to nothing.
    return { ok: true, candidates: [verdict.url] };
  }

  if (explicitUrl?.trim()) {
    const verdict = checkApiUrl(explicitUrl, environment);
    if (verdict.ok) return { ok: true, candidates: [verdict.url] };
    // Development never fails closed -- it says what is wrong and carries on
    // deriving, because a typo in a developer's shell should not brick the app
    // they are trying to debug.
    return {
      ok: true,
      candidates: derive(metroHost, platform),
      warning: `EXPO_PUBLIC_API_URL was ignored: ${verdict.reason}`,
    };
  }

  return { ok: true, candidates: derive(metroHost, platform), warning: diagnose(metroHost) };
}

/**
 * Every address worth trying, best guess first.
 *
 * One derived address is right often enough to look correct and wrong often
 * enough to lose an afternoon: the emulator needs 10.0.2.2, the simulator needs
 * localhost, a phone needs the laptop's LAN address, and which of those applies
 * cannot be known from inside the bundle -- `Platform.OS` says android for both
 * an emulator and a phone. So offer all of them and let the one that answers
 * win.
 */
function derive(host: string | undefined, platform: string): string[] {
  return Array.from(
    new Set(
      [
        `http://${resolveHost(host ?? 'localhost', platform)}:${API_PORT}`,
        platform === 'android' ? `http://10.0.2.2:${API_PORT}` : undefined,
        `http://localhost:${API_PORT}`,
      ].filter((url): url is string => url !== undefined),
    ),
  );
}

/** Why the derived address is likely to fail, when it is. */
function diagnose(host: string | undefined): string | undefined {
  if (!host) {
    return 'The app could not tell which machine served it, so it fell back to localhost.';
  }
  if (TUNNEL_HOST.test(host)) {
    return (
      `Metro is running through a tunnel (${host}), which relays only the bundle -- ` +
      'nothing answers on port 3001 there. Put this device and the API on the same ' +
      'network and restart Expo without --tunnel, or set EXPO_PUBLIC_API_URL to an ' +
      'address this device can reach and restart Expo.'
    );
  }
  return undefined;
}

/**
 * Which environment this build is.
 *
 * Written into `extra` by `app.config.ts` at build time. A bundle with nothing
 * there was built outside that layer -- which today means a local `expo export`
 * or the visual-QA harness -- and those are development by definition. It is
 * deliberately not inferred from `__DEV__`: a release web export is not a
 * production build, and treating it as one would refuse to render the only
 * screenshots this app has.
 */
const environment: AppEnvironment = (() => {
  const declared = (Constants.expoConfig?.extra as { appEnv?: string } | undefined)?.appEnv;
  return isAppEnvironment(declared) ? declared : 'development';
})();

/**
 * An explicit setting always wins. `extra.apiUrl` is what `app.config.ts`
 * baked in; `EXPO_PUBLIC_API_URL` is the same value inlined by babel, and is
 * what a bare `expo start`/`expo export` uses when no config layer ran.
 */
const explicitBaseUrl =
  ((Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl) ??
  process.env.EXPO_PUBLIC_API_URL;

const resolution = resolveApiConfig({
  environment,
  explicitUrl: explicitBaseUrl,
  metroHost: metroHostUri(),
  platform: Platform.OS,
});

export const apiEnvironment = environment;

/**
 * Set when this build has no address it is allowed to use.
 *
 * Read by the client, which refuses to send anything while it is set and
 * raises API_NOT_CONFIGURED instead -- so the message a donor sees says the
 * build is misconfigured rather than blaming their connection. No screen reads
 * this value directly: a build in this state now fails at config-evaluation
 * time, so reaching it at runtime means an older binary running newer JS, and
 * the error path covers that without speculative UI for a state that should
 * not exist.
 *
 * It is a value rather than a thrown error on purpose: this module is imported
 * at module scope by screens and by four test files, and throwing here would
 * be a white screen before any UI exists.
 */
export const apiConfigError: string | undefined = resolution.ok ? undefined : resolution.error;

export const apiCandidates: string[] = resolution.ok ? [...resolution.candidates] : [];

/** The best guess, used until a probe finds one that actually answers. */
export const apiBaseUrl = apiCandidates[0] ?? '';

export const apiBasePath = '/api/v1';

/** Set when the derived address is unlikely to work, explaining why. */
export const apiHostWarning = resolution.ok ? resolution.warning : undefined;

// One line, once, so the address in use is visible instead of guessed at when
// a request fails.
// Outside the __DEV__ guard on purpose. This fires only in a build that cannot
// reach any API, where the whole app is about to fail; a line in logcat or
// Console.app is the only way a tester or a support engineer finds out which
// variable was missing. Everything else stays development-only.
if (apiConfigError) console.error(`[api] ${apiConfigError}`);

if (__DEV__) {
  if (!apiConfigError) console.log(`[api] ${environment}: trying ${apiCandidates.join(', ')}`);
  if (apiHostWarning) console.warn(`[api] ${apiHostWarning}`);
}
