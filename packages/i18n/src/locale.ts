/**
 * Which languages this product speaks, and how a language is chosen.
 *
 * Uzbek is the default rather than English because the product is being built
 * for Uzbekistan: a donor who opens the app with no stored preference and an
 * unrecognised device language should land in the language most of them read,
 * not in the language the code happens to be written in. English stays as the
 * fallback for *strings*, which is a different job -- see `translate`.
 */
export const SUPPORTED_LOCALES = ['uz', 'ru', 'en'] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

/** Chosen when nothing else identifies a language. */
export const DEFAULT_LOCALE: Locale = 'uz';

/** Used for any key a locale has not translated yet. */
export const FALLBACK_LOCALE: Locale = 'en';

/**
 * What each language is called *in that language*.
 *
 * A language picker that lists "Uzbek / Russian / English" only helps someone
 * who already reads English -- which is precisely the person who does not need
 * the picker.
 */
export const LOCALE_NAMES: Record<Locale, string> = {
  uz: "O'zbekcha",
  ru: 'Русский',
  en: 'English',
};

/** Short label for a compact switcher. */
export const LOCALE_SHORT_NAMES: Record<Locale, string> = {
  uz: 'UZ',
  ru: 'RU',
  en: 'EN',
};

/**
 * The BCP 47 tag to hand to `Intl`.
 *
 * Uzbek needs its script spelled out: bare `uz` resolves to the Cyrillic
 * orthography in some ICU builds, and this product is Latin-script Uzbek.
 * Russian is tagged `ru-RU` rather than `ru-UZ` because the latter has no data
 * of its own in most builds and silently falls back anyway. English is `en-GB`
 * so that dates read day-month-year, matching what the other two do -- an
 * English-reading user in Tashkent should not be the only one seeing 9/13/2026.
 */
export const INTL_LOCALES: Record<Locale, string> = {
  uz: 'uz-Latn-UZ',
  ru: 'ru-RU',
  en: 'en-GB',
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/**
 * Reduces anything language-shaped to one of ours, or undefined.
 *
 * Handles what a device or browser actually reports: `uz-Latn-UZ`, `ru_RU`,
 * `en-US`, `UZ`. Uzbek Cyrillic (`uz-Cyrl`) maps to `uz` too -- the reader is
 * an Uzbek speaker, and Latin Uzbek serves them far better than English does,
 * even though this sprint ships only the Latin orthography.
 */
export function normalizeLocale(value: string | null | undefined): Locale | undefined {
  if (!value) return undefined;
  const base = value.replace('_', '-').split('-')[0]!.toLowerCase();
  return isLocale(base) ? base : undefined;
}

/**
 * The first language in a list that this product speaks.
 *
 * Given a browser's `navigator.languages` or a single device locale, in
 * preference order. Returns undefined when none match, so the caller decides
 * between "use the stored choice" and "use the default" rather than having that
 * decision buried here.
 */
export function pickSupportedLocale(candidates: readonly (string | null | undefined)[]): Locale | undefined {
  for (const candidate of candidates) {
    const locale = normalizeLocale(candidate);
    if (locale) return locale;
  }
  return undefined;
}

/**
 * What the platform says the user reads, if it can be asked.
 *
 * `Intl` is the one API present on every target: browsers, and React Native's
 * Hermes with its ICU build. Wrapped because a stripped runtime can throw
 * rather than return, and a missing language is not worth a crash.
 */
export function detectPlatformLocales(): string[] {
  const found: string[] = [];

  const nav = (globalThis as { navigator?: { languages?: readonly string[]; language?: string } }).navigator;
  if (nav?.languages?.length) found.push(...nav.languages);
  else if (nav?.language) found.push(nav.language);

  try {
    const resolved = new Intl.DateTimeFormat().resolvedOptions().locale;
    if (resolved) found.push(resolved);
  } catch {
    // A runtime without Intl data still gets the default locale.
  }

  return found;
}
