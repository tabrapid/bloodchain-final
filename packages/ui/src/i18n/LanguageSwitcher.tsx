'use client';

import { LOCALE_SHORT_NAMES, LOCALE_NAMES, SUPPORTED_LOCALES } from '@bloodchain/i18n';
import { useTranslation } from './LocaleProvider';

/**
 * A compact language switcher for a console's top bar.
 *
 * Three short codes rather than a dropdown: with exactly three languages, a
 * select is one more click than the choice is worth. The full name is on each
 * option's `title` and `aria-label`, in its own language, so the meaning is
 * available to anyone who needs it.
 */
export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { locale, setLocale, t } = useTranslation();

  return (
    <div
      role="group"
      aria-label={t('language.change')}
      className={`inline-flex items-center gap-0.5 rounded-lg bc-solid p-0.5 ${className}`}
    >
      {SUPPORTED_LOCALES.map((value) => {
        const active = value === locale;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setLocale(value)}
            title={LOCALE_NAMES[value]}
            aria-label={LOCALE_NAMES[value]}
            aria-pressed={active}
            className={`rounded-md px-2 py-1 text-xs font-semibold transition-colors ${
              active
                ? 'bg-donor-primary text-white'
                : 'text-donor-muted hover:text-donor-text'
            }`}
          >
            {LOCALE_SHORT_NAMES[value]}
          </button>
        );
      })}
    </div>
  );
}
