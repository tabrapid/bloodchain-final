import { FALLBACK_LOCALE, INTL_LOCALES, type Locale } from './locale';

/**
 * A translated string, or a set of them selected by count.
 *
 * The plural form is a partial record because languages disagree about which
 * categories exist: Uzbek uses one form after a numeral, English two, Russian
 * three. `other` is required because it is the only category every language
 * has, which makes it the safe landing place when a rule selects a form a
 * catalogue has not written.
 */
export type PluralForms = {
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
};

export type Message = string | PluralForms;

/** A catalogue is a tree of namespaces ending in messages. */
export interface Catalog {
  [key: string]: Message | Catalog;
}

export type Values = Record<string, string | number>;

/**
 * Interpolation values, plus the one option that is not a value.
 *
 * An intersection rather than `extends`, because `count` is optional and an
 * index signature of `string | number` cannot admit `undefined` -- the declared
 * shape has to allow leaving it out.
 */
export type TranslateOptions = Values & {
  /** Selects a plural form, and is available to the template as {{count}}. */
  count?: number;
};

function lookup(catalog: Catalog | undefined, path: string): Message | undefined {
  if (!catalog) return undefined;
  let node: Message | Catalog | undefined = catalog;
  for (const segment of path.split('.')) {
    if (typeof node !== 'object' || node === null || isPluralForms(node)) return undefined;
    node = (node as Catalog)[segment];
    if (node === undefined) return undefined;
  }
  return typeof node === 'string' || isPluralForms(node) ? node : undefined;
}

const PLURAL_CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other'] as const;

/**
 * Distinguishes a plural message from a namespace.
 *
 * Every key must be a plural category, not merely `other` among them: the
 * medical namespace has a `donationTypes` group whose members include one
 * called `other` ("Other"), and treating the presence of that key as proof of a
 * plural message swallowed the whole group -- `medical.donationTypes` resolved
 * to the string "Other" and its four real keys vanished from the catalogue.
 */
function isPluralForms(value: unknown): value is PluralForms {
  if (typeof value !== 'object' || value === null) return false;
  const keys = Object.keys(value);
  if (keys.length === 0 || !keys.includes('other')) return false;
  return keys.every((key) => (PLURAL_CATEGORIES as readonly string[]).includes(key));
}

/**
 * Plural rules for the three languages, without depending on ICU being present.
 *
 * `Intl.PluralRules` is used when the runtime has it -- it is the correct
 * answer and stays correct as languages are added. Hermes can ship without the
 * data, though, and "3 донора" instead of "3 донорa" is the kind of wrong that
 * a native speaker reads as machine output, so the three rules this product
 * actually needs are written out as a fallback.
 */
function pluralCategory(locale: Locale, count: number): keyof PluralForms {
  try {
    return new Intl.PluralRules(INTL_LOCALES[locale]).select(count) as keyof PluralForms;
  } catch {
    return manualPluralCategory(locale, count);
  }
}

function manualPluralCategory(locale: Locale, count: number): keyof PluralForms {
  // Uzbek does not inflect the noun after a numeral at all: "1 kun", "5 kun".
  if (locale === 'uz') return 'other';
  if (locale === 'en') return count === 1 ? 'one' : 'other';

  // Russian: 1, 21, 31 take `one`; 2-4, 22-24 take `few`; the rest `many`.
  const mod10 = Math.abs(count) % 10;
  const mod100 = Math.abs(count) % 100;
  if (mod10 === 1 && mod100 !== 11) return 'one';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'few';
  return 'many';
}

function selectForm(message: Message, locale: Locale, count: number | undefined): string {
  if (typeof message === 'string') return message;
  if (count === undefined) return message.other;
  const category = pluralCategory(locale, count);
  return message[category] ?? message.other;
}

/** Replaces {{name}} with the supplied value; an unknown name is left alone. */
function interpolate(template: string, values: Values | undefined): string {
  if (!values) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (whole, name: string) =>
    name in values ? String(values[name]) : whole,
  );
}

export interface TranslateResult {
  text: string;
  /** Which catalogue answered: useful to tests, and to a missing-key report. */
  resolvedFrom: Locale | 'missing';
}

/**
 * Resolves one key, with an explicit account of where the answer came from.
 *
 * Falls back per key, not per catalogue: a locale that has translated most of a
 * screen shows its own words for those and English for the rest, rather than
 * being disqualified wholesale by one gap. A key no catalogue has is returned
 * as itself -- visible in the interface and greppable, which is what makes the
 * "no raw keys" test possible.
 */
export function translate(
  catalogs: Partial<Record<Locale, Catalog>>,
  locale: Locale,
  key: string,
  options?: TranslateOptions,
): TranslateResult {
  const { count, ...rest } = options ?? {};
  const values: Values = count === undefined ? rest : { ...rest, count };

  const primary = lookup(catalogs[locale], key);
  if (primary !== undefined) {
    return { text: interpolate(selectForm(primary, locale, count), values), resolvedFrom: locale };
  }

  if (locale !== FALLBACK_LOCALE) {
    const fallback = lookup(catalogs[FALLBACK_LOCALE], key);
    if (fallback !== undefined) {
      return {
        text: interpolate(selectForm(fallback, FALLBACK_LOCALE, count), values),
        resolvedFrom: FALLBACK_LOCALE,
      };
    }
  }

  return { text: key, resolvedFrom: 'missing' };
}

export type TranslateFn = (key: string, options?: TranslateOptions) => string;

/** The everyday form: give me the string, I do not care where it came from. */
export function createTranslator(
  catalogs: Partial<Record<Locale, Catalog>>,
  locale: Locale,
): TranslateFn {
  return (key, options) => translate(catalogs, locale, key, options).text;
}

/**
 * Every message path in a catalogue, flattened.
 *
 * Used by the coverage tests to compare one language against another without
 * either of them having to list its own keys.
 */
export function collectKeys(catalog: Catalog, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(catalog)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string' || isPluralForms(value)) keys.push(path);
    else keys.push(...collectKeys(value as Catalog, path));
  }
  return keys;
}
