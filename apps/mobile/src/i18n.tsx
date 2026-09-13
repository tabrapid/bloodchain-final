import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import {
  createLocalization,
  DEFAULT_LOCALE,
  detectPlatformLocales,
  isLocale,
  pickSupportedLocale,
  type Locale,
  type Localization,
} from '@bloodchain/i18n';

const LOCALE_KEY = 'donor_locale';

/**
 * The app's language, and how it is remembered.
 *
 * Modelled on ThemeProvider, which solves the same shape of problem: a
 * preference that is read everywhere, changed in one place, and has to survive
 * a restart. Language is stored under its own key and touched by nothing else,
 * so switching it cannot disturb the session -- the auth tokens live in
 * different keys and are never read or written here.
 *
 * `expo-secure-store` rather than a new dependency: it is already in the app for
 * tokens, and a language preference does not need encryption so much as it
 * needs to exist without adding a package to a release build.
 */
interface LocaleContextValue extends Localization {
  setLocale: (locale: Locale) => void;
  /** False until the stored preference has been read, to avoid a flash. */
  isReady: boolean;
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

export function LocaleProvider({ children }: PropsWithChildren) {
  // Starts on the device's language when it is one this product speaks, so the
  // very first frame is already right for most users; a stored choice replaces
  // it a tick later.
  const [locale, setLocaleState] = useState<Locale>(
    () => pickSupportedLocale(detectPlatformLocales()) ?? DEFAULT_LOCALE,
  );
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    SecureStore.getItemAsync(LOCALE_KEY)
      .then((stored) => {
        if (cancelled) return;
        // A stored choice always wins over the device: someone who picked
        // Russian on an Uzbek phone meant it.
        if (isLocale(stored)) setLocaleState(stored);
      })
      .catch(() => {
        // A storage that cannot be read is not a reason to fail to render.
      })
      .finally(() => {
        if (!cancelled) setIsReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const setLocale = useCallback((next: Locale) => {
    // Applied immediately and persisted in the background: the switch should
    // feel instant, and a write that fails must not undo what the user saw.
    setLocaleState(next);
    SecureStore.setItemAsync(LOCALE_KEY, next).catch(() => {});
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({ ...createLocalization(locale), setLocale, isReady }),
    [locale, setLocale, isReady],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error('useLocale must be used within a LocaleProvider');
  }
  return ctx;
}

/** The everyday hook: `const { t } = useTranslation();` */
export function useTranslation(): LocaleContextValue {
  return useLocale();
}

export { LOCALE_KEY };
