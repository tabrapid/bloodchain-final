import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CATALOGS, collectKeys, DEFAULT_LOCALE, type Locale } from '@bloodchain/i18n';

/**
 * Sprint 1A: the language of the three web consoles.
 *
 * The provider is shared, so these are the rules for all three at once. Four of
 * them break quietly: a language that does not persist looks right in the
 * session that set it; a switch that clears storage signs the operator out for
 * changing a word; a missing key renders as a dotted path that reads as a bug
 * to the user and as nothing to the developer; and the first paint has to match
 * the server's, or React discards the markup and hydration warns.
 */

// What the browser says it reads. Controlled per test: jsdom always reports
// en-US, which is exactly one of the branches under test.
let mockPlatformLocales: string[] = [];
vi.mock('@bloodchain/i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@bloodchain/i18n')>();
  return { ...actual, detectPlatformLocales: () => mockPlatformLocales };
});

import { LocaleProvider, useLocale, LOCALE_KEY } from './LocaleProvider';
import { LanguageSwitcher } from './LanguageSwitcher';

/** Renders the current language and a few strings a console actually shows. */
function Probe() {
  const { locale, t } = useLocale();
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="signIn">{t('portal.signIn')}</span>
      <span data-testid="dashboard">{t('portal.nav.dashboard')}</span>
    </div>
  );
}

const renderConsole = () =>
  render(
    <LocaleProvider>
      <LanguageSwitcher />
      <Probe />
    </LocaleProvider>,
  );

const locale = () => screen.getByTestId('locale').textContent;

beforeEach(() => {
  mockPlatformLocales = [];
  window.localStorage.clear();
  document.documentElement.lang = '';
});

describe('locale selection', () => {
  it('defaults to Uzbek when nothing is stored and the browser speaks something else', () => {
    mockPlatformLocales = ['de-DE'];
    renderConsole();

    expect(locale()).toBe(DEFAULT_LOCALE);
    expect(DEFAULT_LOCALE).toBe('uz');
  });

  it('follows the browser language when it is one this product speaks', () => {
    mockPlatformLocales = ['ru-RU', 'en-US'];
    renderConsole();

    expect(locale()).toBe('ru');
    expect(screen.getByTestId('signIn')).toHaveTextContent('Войти');
  });

  it('reads Uzbek Cyrillic as Uzbek, which serves that reader far better than English', () => {
    mockPlatformLocales = ['uz-Cyrl-UZ'];
    renderConsole();

    expect(locale()).toBe('uz');
  });

  it('restores a stored choice', () => {
    window.localStorage.setItem(LOCALE_KEY, 'en');
    renderConsole();

    expect(locale()).toBe('en');
    expect(screen.getByTestId('dashboard')).toHaveTextContent('Dashboard');
  });

  it('prefers a stored choice over the browser language', () => {
    // Someone who picked Russian in an Uzbek browser meant it.
    window.localStorage.setItem(LOCALE_KEY, 'ru');
    mockPlatformLocales = ['uz-Latn-UZ'];
    renderConsole();

    expect(locale()).toBe('ru');
  });

  it('ignores a stored value that is not a language we speak', () => {
    // A downgrade, a typo, or a half-written value should not brick the console.
    window.localStorage.setItem(LOCALE_KEY, 'de');
    mockPlatformLocales = ['de-DE'];
    renderConsole();

    expect(locale()).toBe(DEFAULT_LOCALE);
  });

  it('renders the default language first, so the server markup and the first client paint agree', () => {
    // `localStorage` does not exist on the server. If the provider guessed on
    // the client before hydration, React would throw the server's markup away.
    window.localStorage.setItem(LOCALE_KEY, 'ru');
    let firstPaint: string | undefined;

    function CapturesFirstRender() {
      const { locale: current } = useLocale();
      firstPaint ??= current;
      return null;
    }

    render(
      <LocaleProvider>
        <CapturesFirstRender />
      </LocaleProvider>,
    );

    expect(firstPaint).toBe(DEFAULT_LOCALE);
  });
});

describe('switching language', () => {
  it('re-renders every consumer in the new language', async () => {
    const user = userEvent.setup();
    renderConsole();
    expect(screen.getByTestId('signIn')).toHaveTextContent('Kirish');

    await user.click(screen.getByRole('button', { name: 'Русский' }));

    expect(locale()).toBe('ru');
    expect(screen.getByTestId('signIn')).toHaveTextContent('Войти');
    expect(screen.getByTestId('dashboard')).toHaveTextContent('Панель');
  });

  it('persists the choice for the next visit', async () => {
    const user = userEvent.setup();
    renderConsole();

    await user.click(screen.getByRole('button', { name: 'English' }));

    expect(window.localStorage.getItem(LOCALE_KEY)).toBe('en');
  });

  it('never touches the auth tokens, so a switch cannot sign anyone out', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem('donor_access_token', 'access-abc');
    window.localStorage.setItem('donor_refresh_token', 'refresh-xyz');

    renderConsole();
    await user.click(screen.getByRole('button', { name: 'Русский' }));

    expect(window.localStorage.getItem('donor_access_token')).toBe('access-abc');
    expect(window.localStorage.getItem('donor_refresh_token')).toBe('refresh-xyz');
    // The language lives under its own key, and switching writes nothing else
    // -- the property that makes it safe to change while signed in.
    expect(new Set(Object.keys(window.localStorage))).toEqual(
      new Set(['donor_access_token', 'donor_refresh_token', LOCALE_KEY]),
    );
  });

  it('keeps working when storage refuses to save', async () => {
    const user = userEvent.setup();
    const setItem = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('storage disabled');
      });

    try {
      renderConsole();
      await user.click(screen.getByRole('button', { name: 'Русский' }));

      // Applied for this visit even though it could not be remembered: losing
      // the preference later beats ignoring the click now.
      expect(locale()).toBe('ru');
    } finally {
      setItem.mockRestore();
    }
  });

  it('keeps the document language in step for screen readers and hyphenation', async () => {
    const user = userEvent.setup();
    renderConsole();
    expect(document.documentElement.lang).toBe('uz');

    await user.click(screen.getByRole('button', { name: 'Русский' }));

    expect(document.documentElement.lang).toBe('ru');
  });
});

describe('fallback', () => {
  it('returns an unknown key unchanged rather than rendering nothing', () => {
    function Unknown() {
      const { t } = useLocale();
      return <span data-testid="unknown">{t('definitely.not.a.key')}</span>;
    }
    render(
      <LocaleProvider>
        <Unknown />
      </LocaleProvider>,
    );

    expect(screen.getByTestId('unknown')).toHaveTextContent('definitely.not.a.key');
  });

  it('renders a real string for every key of every catalogue', () => {
    let translate!: (key: string) => string;
    let switchTo!: (next: Locale) => void;

    function Harness() {
      const { t, setLocale } = useLocale();
      translate = t;
      switchTo = setLocale;
      return null;
    }
    render(
      <LocaleProvider>
        <Harness />
      </LocaleProvider>,
    );

    for (const target of ['uz', 'ru', 'en'] as const) {
      act(() => switchTo(target));
      const unresolved = collectKeys(CATALOGS[target]).filter((key) => translate(key) === key);
      expect(unresolved).toEqual([]);
    }
  });
});

describe('the switcher itself', () => {
  it('names each language in its own language, not in English', () => {
    renderConsole();

    // "Uzbek / Russian / English" only helps someone who already reads English
    // -- exactly the person who does not need the switcher.
    expect(screen.getByRole('button', { name: "O'zbekcha" })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Русский' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'English' })).toBeInTheDocument();
  });

  it('marks the active language for assistive technology', async () => {
    const user = userEvent.setup();
    renderConsole();
    expect(screen.getByRole('button', { name: "O'zbekcha" })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(screen.getByRole('button', { name: 'English' }));

    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: "O'zbekcha" })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});
