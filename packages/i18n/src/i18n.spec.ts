import { describe, expect, it } from 'vitest';
import {
  CATALOGS,
  CLINICAL_REVIEW_KEYS,
  DEFAULT_LOCALE,
  FALLBACK_LOCALE,
  SUPPORTED_LOCALES,
  collectKeys,
  createLocalization,
  createTranslator,
  formatAddress,
  formatDate,
  formatDateTime,
  formatNumber,
  formatTime,
  normalizeLocale,
  pickSupportedLocale,
  translate,
  type Catalog,
  type Locale,
} from './index';
import { en } from './locales/en';

describe('locale selection', () => {
  it('defaults to Uzbek, because the product is for Uzbekistan', () => {
    expect(DEFAULT_LOCALE).toBe('uz');
  });

  it('falls back to English for strings, which is a different job', () => {
    expect(FALLBACK_LOCALE).toBe('en');
  });

  it.each([
    ['uz', 'uz'],
    ['uz-Latn-UZ', 'uz'],
    ['uz-Cyrl-UZ', 'uz'],
    ['ru', 'ru'],
    ['ru_RU', 'ru'],
    ['RU-ru', 'ru'],
    ['en-US', 'en'],
  ])('normalises %s to %s', (input, expected) => {
    expect(normalizeLocale(input)).toBe(expected);
  });

  it.each([['de-DE'], ['tr'], [''], [null], [undefined]])(
    'returns undefined for %s rather than guessing',
    (input) => {
      expect(normalizeLocale(input as string)).toBeUndefined();
    },
  );

  it('picks the first supported language from a browser preference list', () => {
    expect(pickSupportedLocale(['de-DE', 'ru-RU', 'en-US'])).toBe('ru');
  });

  it('returns undefined when a device speaks nothing this product does', () => {
    // The caller then decides between a stored choice and the default, which is
    // not a decision this function should be making for it.
    expect(pickSupportedLocale(['de-DE', 'fr'])).toBeUndefined();
  });
});

describe('translation', () => {
  const t = (locale: Locale) => createTranslator(CATALOGS, locale);

  it('returns the locale’s own string when it has one', () => {
    expect(t('uz')('auth.login.submit')).toBe('Kirish');
    expect(t('ru')('auth.login.submit')).toBe('Войти');
    expect(t('en')('auth.login.submit')).toBe('Sign In');
  });

  it('interpolates values into a template', () => {
    expect(t('en')('auth.login.subtitle', { brand: 'DONOR' })).toBe('Sign in to your DONOR account');
  });

  it('leaves an unknown placeholder alone rather than printing undefined', () => {
    const catalogs = { en: { greet: 'Hello {{name}} from {{city}}' } as Catalog };
    expect(translate(catalogs, 'en', 'greet', { name: 'Aziz' }).text).toBe(
      'Hello Aziz from {{city}}',
    );
  });

  describe('falls back per key, not per catalogue', () => {
    const catalogs = {
      uz: { a: 'Uzbek A' } as Catalog,
      en: { a: 'English A', b: 'English B' } as Catalog,
    };

    it('uses the locale’s own string where it exists', () => {
      expect(translate(catalogs, 'uz', 'a')).toEqual({ text: 'Uzbek A', resolvedFrom: 'uz' });
    });

    it('falls back to English for one missing key without losing the rest', () => {
      expect(translate(catalogs, 'uz', 'b')).toEqual({ text: 'English B', resolvedFrom: 'en' });
    });

    it('returns the key itself when no catalogue has it', () => {
      // Deliberately visible and greppable: this is what makes the
      // "no raw keys in a covered flow" test possible.
      expect(translate(catalogs, 'uz', 'c')).toEqual({ text: 'c', resolvedFrom: 'missing' });
    });
  });

  it('does not return a namespace when a key stops short of a message', () => {
    expect(translate(CATALOGS, 'en', 'auth.login').text).toBe('auth.login');
  });
});

describe('pluralization', () => {
  it('uses one form in Uzbek, which does not inflect after a numeral', () => {
    const t = createTranslator(CATALOGS, 'uz');
    expect(t('units.days', { count: 1 })).toBe('1 kun');
    expect(t('units.days', { count: 5 })).toBe('5 kun');
    expect(t('units.days', { count: 21 })).toBe('21 kun');
  });

  it('selects one / few / many in Russian', () => {
    const t = createTranslator(CATALOGS, 'ru');
    expect(t('units.donations', { count: 1 })).toBe('1 донация');
    expect(t('units.donations', { count: 2 })).toBe('2 донации');
    expect(t('units.donations', { count: 5 })).toBe('5 донаций');
    expect(t('units.donations', { count: 11 })).toBe('11 донаций');
    expect(t('units.donations', { count: 21 })).toBe('21 донация');
    expect(t('units.donations', { count: 22 })).toBe('22 донации');
  });

  it('selects singular and plural in English', () => {
    const t = createTranslator(CATALOGS, 'en');
    expect(t('units.days', { count: 1 })).toBe('1 day');
    expect(t('units.days', { count: 2 })).toBe('2 days');
  });

  it('uses `other` when a form is missing for the selected category', () => {
    const catalogs = { en: { things: { other: '{{count}} things' } } as Catalog };
    expect(translate(catalogs, 'en', 'things', { count: 1 }).text).toBe('1 things');
  });
});

describe('formatting', () => {
  const when = new Date('2026-09-13T14:30:00Z');

  it('writes dates the way each language does', () => {
    expect(formatDate('ru', when)).toContain('2026');
    expect(formatDate('en', when)).toContain('September');
    // Uzbek month names are lowercase and follow the day.
    expect(formatDate('uz', when)).toMatch(/13/);
  });

  it('uses the 24-hour clock in every language, as Uzbekistan does', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const formatted = formatTime(locale, when);
      expect(formatted).toMatch(/^\d{2}:\d{2}$/);
      expect(formatted.toLowerCase()).not.toContain('pm');
    }
  });

  it('groups numbers the way each language does', () => {
    // uz and ru use a space as the group separator and a comma as the decimal
    // mark; en does the opposite. Intl emits a non-breaking space (U+00A0) or a
    // narrow one (U+202F) as that separator, so normalise before comparing.
    expect(formatNumber('ru', 1234567.5).replace(/[\u00a0\u202f]/g, ' ')).toBe('1 234 567,5');
    expect(formatNumber('uz', 1234567.5).replace(/[\u00a0\u202f]/g, ' ')).toBe('1 234 567,5');
    expect(formatNumber('en', 1234567.5)).toBe('1,234,567.5');
  });

  it('combines date and time without an am/pm marker', () => {
    expect(formatDateTime('en', when)).toMatch(/\d{2}:\d{2}/);
  });

  it('returns an empty string for an unparseable date rather than "Invalid Date"', () => {
    expect(formatDate('uz', 'not-a-date')).toBe('');
    expect(formatTime('ru', 'not-a-date')).toBe('');
  });

  it('writes an address largest unit first, as a courier here reads it', () => {
    expect(
      formatAddress({
        country: "O'zbekiston",
        region: 'Jizzax viloyati',
        district: 'Arnasoy tumani',
        city: 'Jizzax',
        street: 'Amir Temur',
        building: '12',
        apartment: '4',
        postalCode: '130100',
      }),
    ).toBe("Jizzax viloyati, Arnasoy tumani, Jizzax, Amir Temur 12 4, 130100, O'zbekiston");
  });

  it('skips address parts that are absent', () => {
    expect(formatAddress({ city: 'Tashkent', country: "O'zbekiston" })).toBe(
      "Tashkent, O'zbekiston",
    );
  });
});

describe('catalogue coverage', () => {
  const reference = collectKeys(en);

  it('has a meaningful number of keys, guarding against an empty scan', () => {
    expect(reference.length).toBeGreaterThan(200);
  });

  it.each(SUPPORTED_LOCALES.filter((locale) => locale !== 'en'))(
    '%s translates every key English has',
    (locale) => {
      const translated = new Set(collectKeys(CATALOGS[locale]));
      const missing = reference.filter((key) => !translated.has(key));
      expect(missing).toEqual([]);
    },
  );

  it.each(SUPPORTED_LOCALES.filter((locale) => locale !== 'en'))(
    '%s has no key English does not, which would be a typo nobody sees',
    (locale) => {
      const referenceKeys = new Set(reference);
      const extra = collectKeys(CATALOGS[locale]).filter((key) => !referenceKeys.has(key));
      expect(extra).toEqual([]);
    },
  );

  it.each(SUPPORTED_LOCALES)('%s leaves no string identical to its own key', (locale) => {
    const t = createTranslator(CATALOGS, locale);
    const unresolved = collectKeys(CATALOGS[locale]).filter((key) => t(key) === key);
    expect(unresolved).toEqual([]);
  });

  it('keeps every {{placeholder}} that English uses', () => {
    const placeholders = (text: string) => (text.match(/\{\{\w+\}\}/g) ?? []).sort();
    const problems: string[] = [];

    for (const key of reference) {
      const expected = placeholders(translate(CATALOGS, 'en', key).text);
      if (expected.length === 0) continue;
      for (const locale of SUPPORTED_LOCALES) {
        const actual = placeholders(translate(CATALOGS, locale, key).text);
        if (actual.join() !== expected.join()) problems.push(`${locale}:${key}`);
      }
    }

    // A dropped placeholder is a sentence with a hole in it -- "a reset link for
    // is on its way" -- and nothing else would catch it.
    expect(problems).toEqual([]);
  });
});

describe('clinical review manifest', () => {
  it('lists every medical key, derived rather than typed out', () => {
    expect(CLINICAL_REVIEW_KEYS.length).toBeGreaterThan(25);
    expect(CLINICAL_REVIEW_KEYS.every((key) => key.startsWith('medical.'))).toBe(true);
  });

  it('covers the terms a donor could act on', () => {
    for (const key of [
      'medical.donationTypes.wholeBlood',
      'medical.eligibility.notYetEligible',
      'medical.markers.hemoglobin',
      'medical.resultFlags.outsideRange',
    ]) {
      expect(CLINICAL_REVIEW_KEYS).toContain(key);
    }
  });

  it('keeps clinical wording out of the everyday namespaces', () => {
    // If this fails, a medical term has been added somewhere a reviewer will
    // not look for it.
    const outsideMedical = collectKeys(en).filter(
      (key) => !key.startsWith('medical.') && /hemoglobin|ferritin|platelet|hematocrit/i.test(key),
    );
    expect(outsideMedical).toEqual([]);
  });
});

describe('createLocalization', () => {
  it('binds translation and formatting to one locale', () => {
    const l10n = createLocalization('ru');
    expect(l10n.locale).toBe('ru');
    expect(l10n.t('nav.home')).toBe('Главная');
    expect(l10n.formatNumber(1000)).toMatch(/1.000/);
  });

  it('defaults to Uzbek when given nothing', () => {
    expect(createLocalization().locale).toBe('uz');
  });
});
