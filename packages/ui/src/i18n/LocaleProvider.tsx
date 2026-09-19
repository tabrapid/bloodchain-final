'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  createLocalization,
  DEFAULT_LOCALE,
  detectPlatformLocales,
  isLocale,
  pickSupportedLocale,
  type Locale,
  type Localization,
} from '@bloodchain/i18n';

const LOCALE_KEY = 'bloodchain_locale';

/**
 * The language of a web console, shared by all three of them.
 *
 * Lives in packages/ui rather than being copied into each app because the
 * behaviour is identical everywhere and the bug it avoids is not: three copies
 * of a preference-reading effect drift, and the one that drifts is the one
 * nobody opens.
 *
 * Storage is `localStorage`, which the server cannot read, so the first paint
 * is necessarily the default language and the stored choice arrives on the
 * client. `isReady` exists so a consumer can avoid a visible flip if it wants
 * to; nothing is blocked on it.
 */
interface LocaleContextValue extends Localization {
  setLocale: (locale: Locale) => void;
  isReady: boolean;
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

export function LocaleProvider({ children }: { children: ReactNode }) {
  // Server and first client render must agree, so detection cannot happen here
  // -- `navigator` does not exist on the server, and guessing differently on
  // the two sides is a hydration mismatch.
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(LOCALE_KEY);
      // A stored choice always wins over the browser: someone who picked
      // Russian in an Uzbek browser meant it.
      if (isLocale(stored)) setLocaleState(stored);
      else {
        const detected = pickSupportedLocale(detectPlatformLocales());
        if (detected) setLocaleState(detected);
      }
    } catch {
      // Private mode, or storage disabled: the default language is still fine.
    }
    setIsReady(true);
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(LOCALE_KEY, next);
    } catch {
      // A preference that cannot be saved should still apply for this session.
    }
  }, []);

  // Keeps the document's language in step, which is what a screen reader and
  // the browser's own hyphenation read.
  useEffect(() => {
    if (typeof document !== 'undefined') document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<LocaleContextValue>(
    () => ({ ...createLocalization(locale), setLocale, isReady }),
    [locale, setLocale, isReady],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within a LocaleProvider');
  return ctx;
}

/** The everyday hook: `const { t } = useTranslation();` */
export function useTranslation(): LocaleContextValue {
  return useLocale();
}

/**
 * Translation for a shared component that may render without a provider.
 *
 * The design-system components in `packages/ui/src/components` are rendered by
 * the three consoles -- which do wrap everything in `LocaleProvider` -- and
 * also, one at a time, by their own unit tests. Making them call `useLocale()`
 * would have localised the consoles and thrown in every one of those tests, so
 * the fallback is the default language rather than a crash. It is deliberately
 * not exported for screens: a *page* that renders outside the provider is a
 * bug, and `useTranslation` should keep saying so.
 */
export function useOptionalTranslation(): Localization {
  const ctx = useContext(LocaleContext);
  const fallbackLocale = ctx ? ctx.locale : DEFAULT_LOCALE;
  const fallback = useMemo(() => createLocalization(fallbackLocale), [fallbackLocale]);
  return ctx ?? fallback;
}

export { LOCALE_KEY };
