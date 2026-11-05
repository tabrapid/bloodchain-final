/**
 * expo-secure-store, for the visual-QA web harness only.
 *
 * The real module has no web implementation of `deleteValueWithKeyAsync`, so
 * the app throws on boot in a browser. This is not a gap in the app: nothing
 * ships to the web. The harness renders the real screens in a browser to
 * photograph them, and it needs somewhere to put a token so the signed-in
 * screens are reachable.
 *
 * localStorage is that somewhere, which also lets the capture script seed a
 * session before the page loads. Nothing here is reachable from a native
 * build: metro only substitutes this module when BLOODCHAIN_VISUAL_QA=1 and
 * the platform is web.
 */
const store = () => (typeof localStorage === 'undefined' ? null : localStorage);

export async function setItemAsync(key, value) {
  store()?.setItem(key, value);
}

export async function getItemAsync(key) {
  return store()?.getItem(key) ?? null;
}

export async function deleteItemAsync(key) {
  store()?.removeItem(key);
}

export async function isAvailableAsync() {
  return true;
}

export const WHEN_UNLOCKED = 'whenUnlocked';
export const AFTER_FIRST_UNLOCK = 'afterFirstUnlock';
