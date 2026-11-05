/**
 * Localization for every Bloodchain app.
 *
 * Framework-agnostic on purpose: one donor app on React Native and three
 * consoles on Next.js, sharing catalogues and formatting rules. What each app
 * supplies for itself is only the two things that genuinely differ -- how it
 * stores a preference, and how it re-renders when that preference changes.
 *
 * Nothing here reaches for a runtime: no i18n framework, no backend loader, no
 * lazy chunking. Three languages and one product's worth of strings fit in
 * memory, and the type checker can then see every key.
 */
export {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  FALLBACK_LOCALE,
  LOCALE_NAMES,
  LOCALE_SHORT_NAMES,
  INTL_LOCALES,
  isLocale,
  normalizeLocale,
  pickSupportedLocale,
  detectPlatformLocales,
  type Locale,
} from './locale';

export {
  translate,
  createTranslator,
  collectKeys,
  type Catalog,
  type Message,
  type PluralForms,
  type TranslateFn,
  type TranslateOptions,
  type TranslateResult,
  type Values,
} from './translate';

export {
  formatDate,
  formatTime,
  formatDateTime,
  formatWeekday,
  formatMonth,
  formatDayHeading,
  formatNumber,
  formatRelativeDays,
  daysBetween,
  formatAddress,
  resetIntlProbe,
  ADDRESS_FIELDS,
  type AddressField,
  type PostalAddress,
} from './format';

export { CATALOGS, CLINICAL_REVIEW_KEYS, en, uz, ru } from './locales';

import { CATALOGS } from './locales';
import { createTranslator, type TranslateFn } from './translate';
import { DEFAULT_LOCALE, type Locale } from './locale';
import {
  formatDate,
  formatDateTime,
  formatDayHeading,
  formatMonth,
  formatNumber,
  formatRelativeDays,
  formatTime,
  formatWeekday,
} from './format';

/** Everything a screen needs, bound to one locale. */
export interface Localization {
  locale: Locale;
  t: TranslateFn;
  formatDate: (value: Date | string | number, style?: 'full' | 'long' | 'medium' | 'short') => string;
  formatTime: (value: Date | string | number) => string;
  formatDateTime: (value: Date | string | number, style?: 'long' | 'medium' | 'short') => string;
  formatWeekday: (value: Date | string | number, width?: 'long' | 'short' | 'narrow') => string;
  formatMonth: (value: Date | string | number, width?: 'long' | 'short') => string;
  formatDayHeading: (value: Date | string | number) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatRelativeDays: (days: number) => string;
}

/**
 * Binds the catalogues and formatters to a locale.
 *
 * Built once per locale change by whichever provider owns the preference, so a
 * screen calls `t('auth.login.title')` without carrying the locale around.
 */
export function createLocalization(locale: Locale = DEFAULT_LOCALE): Localization {
  return {
    locale,
    t: createTranslator(CATALOGS, locale),
    formatDate: (value, style) => formatDate(locale, value, style),
    formatTime: (value) => formatTime(locale, value),
    formatDateTime: (value, style) => formatDateTime(locale, value, style),
    formatWeekday: (value, width) => formatWeekday(locale, value, width),
    formatMonth: (value, width) => formatMonth(locale, value, width),
    formatDayHeading: (value) => formatDayHeading(locale, value),
    formatNumber: (value, options) => formatNumber(locale, value, options),
    formatRelativeDays: (days) => formatRelativeDays(locale, days),
  };
}
