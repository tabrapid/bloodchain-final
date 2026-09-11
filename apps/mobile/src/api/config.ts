import Constants from 'expo-constants';
import { Platform } from 'react-native';

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
 */
function metroHost(): string | undefined {
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
 *
 * The alternative is `adb reverse tcp:3001 tcp:3001` before every session.
 * This needs nothing typed.
 */
function resolveHost(host: string): string {
  const isLoopback = host === 'localhost' || host === '127.0.0.1';
  return isLoopback && Platform.OS === 'android' ? '10.0.2.2' : host;
}

function defaultBaseUrl(): string {
  const host = metroHost();
  return `http://${resolveHost(host ?? 'localhost')}:${API_PORT}`;
}

/**
 * Where the app sends its requests. An explicit setting always wins -- set
 * `EXPO_PUBLIC_API_URL`, or `extra.apiUrl` in app.json, when the API is not on
 * the machine running Metro (a staging server, a tunnel, a phone on a
 * different network). Otherwise it follows Metro.
 *
 * `EXPO_PUBLIC_*` names are substituted into the bundle when it is built, not
 * read at runtime: changing one means restarting `expo start`, and a value set
 * only in the shell that launched the app will not reach it.
 */
export const apiBaseUrl =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  process.env.EXPO_PUBLIC_API_URL ??
  defaultBaseUrl();

export const apiBasePath = '/api/v1';

// One line, once, so the address in use is visible instead of guessed at when
// a request fails.
if (__DEV__) {
  console.log(`[api] ${apiBaseUrl}${apiBasePath}`);
}
