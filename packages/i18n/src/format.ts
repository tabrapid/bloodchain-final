import { INTL_LOCALES, type Locale } from './locale';

/**
 * Locale-aware formatting, built on `Intl` and safe without it.
 *
 * Every function here degrades to something readable rather than throwing: a
 * runtime with no ICU data is a bad day for typography, not a crash in a blood
 * donation app. The fallbacks deliberately use ISO-ish output, which is
 * unambiguous in every language this product speaks.
 */

function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}

function safe<T>(run: () => T, fallback: () => T): T {
  try {
    return run();
  } catch {
    return fallback();
  }
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Uzbek calendar names, for runtimes whose ICU has no Uzbek.
 *
 * Node and both phone platforms know `uz-Latn-UZ`; a slim ICU (some browser
 * builds, some Hermes builds) does not, and `Intl` then does not throw -- it
 * prints "M09" for September and the English weekday initials. That is a
 * calendar the donor cannot read, so the names are carried here as data and
 * used whenever `Intl` hands back a placeholder. Locale data, not copy: the
 * same names CLDR ships for uz-Latn.
 */
const UZ_MONTHS = {
  long: ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'],
  short: ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'],
} as const;

const UZ_WEEKDAYS = {
  long: ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'],
  short: ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan'],
  narrow: ['Y', 'D', 'S', 'C', 'P', 'J', 'S'],
} as const;

/** True when `Intl` returned ICU's "no data" placeholder for a month. */
const isMonthPlaceholder = (text: string) => /\bM\d{2}\b/.test(text);

/** "13 sentabr, 2026" / "13 сентября 2026 г." / "13 September 2026" */
export function formatDate(
  locale: Locale,
  value: Date | string | number,
  style: 'full' | 'long' | 'medium' | 'short' = 'long',
): string {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return '';
  return safe(
    () => new Intl.DateTimeFormat(INTL_LOCALES[locale], { dateStyle: style }).format(date),
    () => `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`,
  );
}

/**
 * "14:30" everywhere.
 *
 * `hourCycle: 'h23'` rather than the locale default on purpose: Uzbekistan runs
 * on the 24-hour clock in every language, and an English-reading user here
 * reads the same appointment board as everyone else. A 2:30 PM in the middle of
 * a 24-hour schedule is a misreading waiting to happen.
 */
export function formatTime(locale: Locale, value: Date | string | number): string {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return '';
  return safe(
    () =>
      new Intl.DateTimeFormat(INTL_LOCALES[locale], {
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).format(date),
    () => `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  );
}

/** Date and time together, for an appointment or a donation record. */
export function formatDateTime(
  locale: Locale,
  value: Date | string | number,
  style: 'long' | 'medium' | 'short' = 'medium',
): string {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return '';
  return safe(
    () =>
      new Intl.DateTimeFormat(INTL_LOCALES[locale], {
        dateStyle: style,
        timeStyle: 'short',
        hourCycle: 'h23',
      }).format(date),
    () => `${formatDate(locale, date, 'short')} ${formatTime(locale, date)}`,
  );
}

/** A weekday name, for a calendar header. */
export function formatWeekday(
  locale: Locale,
  value: Date | string | number,
  width: 'long' | 'short' | 'narrow' = 'short',
): string {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return '';
  const uzFallback = () => (locale === 'uz' ? (UZ_WEEKDAYS[width][date.getDay()] ?? '') : '');
  return safe(() => {
    if (locale === 'uz' && Intl.DateTimeFormat.supportedLocalesOf([INTL_LOCALES.uz]).length === 0) {
      return uzFallback();
    }
    return new Intl.DateTimeFormat(INTL_LOCALES[locale], { weekday: width }).format(date);
  }, uzFallback);
}

/**
 * "Sunday, 13 Sep" — the compact heading a home screen wears.
 *
 * Its own formatter rather than `formatDate(…, 'full')` because the screen it
 * serves wants the weekday without the year, and `dateStyle` has no setting
 * between "13 Sep 2026" and "Sunday, 13 September 2026".
 */
export function formatDayHeading(locale: Locale, value: Date | string | number): string {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return '';
  return safe(
    () =>
      new Intl.DateTimeFormat(INTL_LOCALES[locale], {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
      }).format(date),
    () => `${pad(date.getDate())}.${pad(date.getMonth() + 1)}`,
  );
}

/** A month name, for a calendar title. */
export function formatMonth(
  locale: Locale,
  value: Date | string | number,
  width: 'long' | 'short' = 'long',
): string {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return '';
  const fallback = () =>
    locale === 'uz'
      ? `${UZ_MONTHS[width][date.getMonth()] ?? pad(date.getMonth() + 1)}, ${date.getFullYear()}`
      : `${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
  return safe(() => {
    const text = new Intl.DateTimeFormat(INTL_LOCALES[locale], { month: width, year: 'numeric' }).format(date);
    return locale === 'uz' && isMonthPlaceholder(text) ? fallback() : text;
  }, fallback);
}

/** "1 234 567,5" in uz and ru; "1,234,567.5" in en. */
export function formatNumber(
  locale: Locale,
  value: number,
  options?: Intl.NumberFormatOptions,
): string {
  if (!Number.isFinite(value)) return '';
  return safe(
    () => new Intl.NumberFormat(INTL_LOCALES[locale], options).format(value),
    () => String(value),
  );
}

/**
 * "in 3 days" / "3 kundan keyin" / "через 3 дня".
 *
 * The unit is chosen from the size of the gap, because "in 45 days" is a number
 * to work out and "in 1 month" is a fact.
 */
export function formatRelativeDays(locale: Locale, days: number): string {
  const rounded = Math.round(days);
  const [value, unit]: [number, Intl.RelativeTimeFormatUnit] =
    Math.abs(rounded) >= 365
      ? [Math.round(rounded / 365), 'year']
      : Math.abs(rounded) >= 30
        ? [Math.round(rounded / 30), 'month']
        : [rounded, 'day'];

  return safe(
    () =>
      new Intl.RelativeTimeFormat(INTL_LOCALES[locale], { numeric: 'auto' }).format(value, unit),
    () => `${value} ${unit}`,
  );
}

/** Whole days between two instants, ignoring the time of day. */
export function daysBetween(from: Date | string | number, to: Date | string | number): number {
  const a = toDate(from);
  const b = toDate(to);
  const startA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const startB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((startB - startA) / 86400000);
}

/**
 * Address labels as Uzbekistan writes them.
 *
 * Not a translation of "state" and "county": the administrative units here are
 * viloyat (region), tuman (district) and mahalla (neighbourhood), and the
 * postal code is six digits. An address form that asks an Uzbek user for their
 * "State" and "ZIP" is asking them to translate their own address into someone
 * else's country, which is where wrong data comes from.
 *
 * These are the *field labels*; the catalogue holds their translations under
 * `address.*`, and this type is what keeps the two lists in step.
 */
export const ADDRESS_FIELDS = [
  'country',
  'region',
  'district',
  'city',
  'mahalla',
  'street',
  'building',
  'apartment',
  'postalCode',
  'landmark',
] as const;

export type AddressField = (typeof ADDRESS_FIELDS)[number];

export type PostalAddress = Partial<Record<AddressField, string>>;

/**
 * One address, written the way it is written locally: largest unit first.
 *
 * Uzbek and Russian postal convention both run region → district → city →
 * street → building, the opposite of the Anglo-American order. Rendering the
 * parts in the order a courier reads them matters more than which language the
 * labels are in.
 */
export function formatAddress(address: PostalAddress): string {
  const street = [address.street, address.building, address.apartment].filter(Boolean).join(' ');
  return [
    address.region,
    address.district,
    address.city,
    address.mahalla,
    street,
    address.postalCode,
    address.country,
  ]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(', ');
}
