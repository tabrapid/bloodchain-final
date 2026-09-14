import {
  createLocalization,
  DEFAULT_LOCALE,
  isLocale,
  type Locale,
  type TranslateOptions,
} from '@bloodchain/i18n';
import { LOCALE_KEY } from './LocaleProvider';

/**
 * Translation for code that runs outside React.
 *
 * The API clients throw before any component sees the response, so they cannot
 * read the locale from context. They can read the same `localStorage` key the
 * provider writes, which is the whole of the preference -- so the language a
 * thrown message comes back in matches the language on screen.
 *
 * Everything here degrades rather than throws: on the server, in a private
 * window, or with site data blocked, `localStorage` is absent or throws on
 * access, and the default language is the right answer in all three.
 *
 * Prefer `useTranslation()` in anything that renders. This exists for the
 * handful of places that have no component to hang a hook on, and it reads the
 * preference on every call so a language switch is picked up without a reload.
 */
export function currentLocale(): Locale {
  try {
    const stored = globalThis.localStorage?.getItem(LOCALE_KEY);
    return isLocale(stored) ? stored : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

export function translate(key: string, options?: TranslateOptions): string {
  return createLocalization(currentLocale()).t(key, options);
}
