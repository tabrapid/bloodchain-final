/**
 * expo-notifications, for the visual-QA web harness only.
 *
 * `getLastNotificationResponseAsync` and the Android channel calls have no web
 * implementation and throw on boot in a browser. The app's own behaviour is
 * unchanged by this file: it never requests a permission (that rule is
 * asserted in push-registration.spec.ts), and the harness photographs the
 * explainer sheets the app draws itself, not the operating system's dialogs --
 * which cannot be photographed in a browser at all, and are listed as
 * unverified in the report because of it.
 *
 * Substituted only when BLOODCHAIN_VISUAL_QA=1 and the platform is web.
 */
let permission = 'undetermined';

/** The capture script flips this through `window.__qaSetNotificationPermission`. */
if (typeof window !== 'undefined') {
  window.__qaSetNotificationPermission = (status) => {
    permission = status;
  };
}

export async function getPermissionsAsync() {
  return { status: permission, granted: permission === 'granted', canAskAgain: true };
}

export async function requestPermissionsAsync() {
  return { status: permission, granted: permission === 'granted', canAskAgain: true };
}

export async function getExpoPushTokenAsync() {
  return { data: 'ExponentPushToken[visual-qa]' };
}

export async function getLastNotificationResponseAsync() {
  return null;
}

export async function setNotificationChannelAsync() {}

export function setNotificationHandler() {}

export function addNotificationReceivedListener() {
  return { remove() {} };
}

export function addNotificationResponseReceivedListener() {
  return { remove() {} };
}

export const AndroidImportance = { DEFAULT: 3, HIGH: 4, MAX: 5, LOW: 2, MIN: 1, NONE: 0 };
export const AndroidNotificationVisibility = { PUBLIC: 1, PRIVATE: 0, SECRET: -1 };
