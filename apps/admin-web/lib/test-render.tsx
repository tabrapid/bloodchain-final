import type { ReactElement } from 'react';
import { render, type RenderResult } from '@testing-library/react';
import { LocaleProvider, LOCALE_KEY } from '@bloodchain/ui/i18n';

/**
 * Renders a page the way the console actually mounts it: inside the language
 * provider, which every page now reads through `useTranslation`.
 *
 * The language is pinned rather than left to detection so a behaviour test
 * stays a behaviour test -- jsdom reports en-US, a translator could change an
 * Uzbek string tomorrow, and neither should turn a recovery test red. Tests
 * that are about language pass their own locale.
 */
export function renderLocalized(
  ui: ReactElement,
  locale: 'uz' | 'ru' | 'en' = 'en',
): RenderResult {
  window.localStorage.setItem(LOCALE_KEY, locale);
  return render(<LocaleProvider>{ui}</LocaleProvider>);
}
