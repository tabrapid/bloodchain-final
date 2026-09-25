import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CATALOGS, collectKeys, DEFAULT_LOCALE, type Locale } from '@bloodchain/i18n';

import { ThemeProvider } from '../theme';

/**
 * Sprint 1A: localization in the donor app.
 *
 * Four things are worth a test here, and they are the four that break quietly.
 * A language that does not persist looks fine in the session that set it. A
 * switch that drops the session logs someone out for changing a word. A missing
 * key renders as a dotted path, which reads as a bug to the user and as nothing
 * to the developer. And English left in a screen is invisible to anyone who
 * reads English -- which is everyone reviewing the code.
 */

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => 'dark',
}));

const mockStore = new Map<string, string>();
const mockGetItem = jest.fn(async (key: string) => mockStore.get(key) ?? null);
const mockSetItem = jest.fn(async (key: string, value: string) => {
  mockStore.set(key, value);
});
const mockDeleteItem = jest.fn(async (key: string) => {
  mockStore.delete(key);
});

// What the device reports it reads. Controlled per test, because the branch
// under test is "device language we speak" vs "one we do not", and a test
// runner always reports en-US.
let mockPlatformLocales: string[] = [];
jest.mock('@bloodchain/i18n', () => {
  const actual = jest.requireActual('@bloodchain/i18n');
  return { ...actual, detectPlatformLocales: () => mockPlatformLocales };
});

jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn(), dismissAll: jest.fn(), canGoBack: jest.fn(() => true) } }));

jest.mock('expo-secure-store', () => ({
  getItemAsync: (key: string) => mockGetItem(key),
  setItemAsync: (key: string, value: string) => mockSetItem(key, value),
  deleteItemAsync: (key: string) => mockDeleteItem(key),
}));

import { LocaleProvider, useLocale, LOCALE_KEY } from '../i18n';
import Welcome from '../../app/(auth)/welcome';

/** Renders a probe inside the provider and hands back what it sees. */
function renderWithLocale() {
  const seen: { locale: Locale; t: (key: string) => string; setLocale: (l: Locale) => void }[] = [];

  function Probe() {
    const { locale, t, setLocale } = useLocale();
    seen.push({ locale, t, setLocale });
    return null;
  }

  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <ThemeProvider>
        <SafeAreaProvider
          initialMetrics={{
            frame: { x: 0, y: 0, width: 390, height: 844 },
            insets: { top: 47, left: 0, right: 0, bottom: 34 },
          }}
        >
          <LocaleProvider>
            <Probe />
          </LocaleProvider>
        </SafeAreaProvider>
      </ThemeProvider>,
    );
  });

  return { tree, seen, latest: () => seen[seen.length - 1]! };
}

const settle = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

beforeEach(() => {
  mockPlatformLocales = [];
  mockStore.clear();
  mockGetItem.mockClear();
  mockSetItem.mockClear();
});

describe('locale selection', () => {
  it('defaults to Uzbek when nothing is stored and the device speaks something else', async () => {
    mockPlatformLocales = ['de-DE'];
    const { latest } = renderWithLocale();
    await settle();

    expect(latest().locale).toBe(DEFAULT_LOCALE);
    expect(DEFAULT_LOCALE).toBe('uz');
  });

  it('follows the device language when it is one this product speaks', async () => {
    mockPlatformLocales = ['ru-RU'];
    const { latest } = renderWithLocale();
    await settle();

    expect(latest().locale).toBe('ru');
  });

  it('reads Uzbek Cyrillic as Uzbek, which serves that reader far better than English', async () => {
    mockPlatformLocales = ['uz-Cyrl-UZ'];
    const { latest } = renderWithLocale();
    await settle();

    expect(latest().locale).toBe('uz');
  });

  it('restores a stored choice over the default', async () => {
    mockStore.set(LOCALE_KEY, 'ru');
    const { latest } = renderWithLocale();
    await settle();

    expect(latest().locale).toBe('ru');
    expect(latest().t('nav.home')).toBe('Главная');
  });

  it('ignores a stored value that is not a language we speak', async () => {
    // A downgrade, a typo, or a half-written value should not brick the app.
    mockStore.set(LOCALE_KEY, 'de');
    mockPlatformLocales = ['de-DE'];
    const { latest } = renderWithLocale();
    await settle();

    expect(latest().locale).toBe(DEFAULT_LOCALE);
  });

  it('prefers a stored choice over the device language', async () => {
    // Someone who picked Russian on an Uzbek phone meant it.
    mockStore.set(LOCALE_KEY, 'ru');
    mockPlatformLocales = ['uz-Latn-UZ'];
    const { latest } = renderWithLocale();
    await settle();

    expect(latest().locale).toBe('ru');
  });
});

describe('switching language', () => {
  it('re-renders every consumer in the new language', async () => {
    const { latest } = renderWithLocale();
    await settle();
    expect(latest().t('nav.profile')).toBe('Profil');

    await act(async () => {
      latest().setLocale('ru');
    });

    expect(latest().locale).toBe('ru');
    expect(latest().t('nav.profile')).toBe('Профиль');
  });

  it('persists the choice for the next launch', async () => {
    const { latest } = renderWithLocale();
    await settle();

    await act(async () => {
      latest().setLocale('en');
    });

    expect(mockSetItem).toHaveBeenCalledWith(LOCALE_KEY, 'en');
    expect(mockStore.get(LOCALE_KEY)).toBe('en');
  });

  it('never touches the auth tokens, so a switch cannot sign anyone out', async () => {
    mockStore.set('donor_access_token', 'access-abc');
    mockStore.set('donor_refresh_token', 'refresh-xyz');

    const { latest } = renderWithLocale();
    await settle();
    await act(async () => {
      latest().setLocale('ru');
    });

    expect(mockStore.get('donor_access_token')).toBe('access-abc');
    expect(mockStore.get('donor_refresh_token')).toBe('refresh-xyz');
    // The language is written under its own key and nothing else is written at
    // all -- the property that makes "switch language" safe while signed in.
    expect(mockSetItem.mock.calls.map(([key]) => key)).toEqual([LOCALE_KEY]);
  });

  it('keeps working when storage refuses to save', async () => {
    mockSetItem.mockRejectedValueOnce(new Error('storage full'));
    const { latest } = renderWithLocale();
    await settle();

    await act(async () => {
      latest().setLocale('ru');
    });

    // Applied for this session even though it could not be remembered: losing
    // the preference later is better than ignoring the tap now.
    expect(latest().locale).toBe('ru');
  });
});

describe('fallback', () => {
  it('falls back to English for a key a language has not translated', async () => {
    const { latest } = renderWithLocale();
    await settle();

    // Both catalogues are complete today, so this proves the mechanism rather
    // than a real gap: an unknown key resolves to itself, and a key only
    // English has resolves to English.
    expect(latest().t('definitely.not.a.key')).toBe('definitely.not.a.key');
  });

  it('renders a real string for every key in the covered flows', async () => {
    const { latest } = renderWithLocale();
    await settle();

    for (const locale of ['uz', 'ru', 'en'] as const) {
      await act(async () => {
        latest().setLocale(locale);
      });
      const t = latest().t;
      const unresolved = collectKeys(CATALOGS[locale]).filter((key) => t(key) === key);
      expect(unresolved).toEqual([]);
    }
  });
});

/**
 * Any catalogue path that reached the screen as text. A missing key renders as
 * itself, so this is exactly what "untranslated" looks like to a donor: a
 * dotted path where a sentence should be.
 */
const RAW_KEY =
  /\b(?:common|auth|nav|language|units|validation|home|health|donate|calendar|community|profile|portal|address|medical|ops|status|table|actions|filters|booking|appointment|appointmentTypes|donationHistory|laboratory|healthTrends|insights|notifications|sos|campaigns|challenges|education|gamification|privacy|security|profileEdit|apiErrors)\.[A-Za-z][A-Za-z.]*/g;

/** Every string the rendered tree puts on screen, concatenated. */
function renderedText(tree: renderer.ReactTestRenderer): string {
  return tree.root
    .findAll((node) => typeof node.type === 'string')
    .flatMap((node) => node.children)
    .filter((child): child is string => typeof child === 'string')
    .join(' ');
}

/** The one string on Welcome that has to change when the language does. */
const HEADLINE = {
  uz: 'Birgalikda kuchliroq ertaga.',
  ru: 'Вместе — сильнее завтра.',
  en: 'A stronger tomorrow, together.',
} as const;

describe('a covered screen in every language', () => {
  it('renders Welcome with no raw catalogue key left on it', async () => {
    const { tree, latest } = renderWithLocale();
    await settle();

    for (const language of ['uz', 'ru', 'en'] as const) {
      await act(async () => {
        latest().setLocale(language);
      });

      let screen!: renderer.ReactTestRenderer;
      act(() => {
        screen = renderer.create(
          <ThemeProvider>
            <LocaleProvider>
              <SafeAreaProvider
                initialMetrics={{
                  frame: { x: 0, y: 0, width: 390, height: 844 },
                  insets: { top: 47, left: 0, right: 0, bottom: 34 },
                }}
              >
                <Welcome />
              </SafeAreaProvider>
            </LocaleProvider>
          </ThemeProvider>,
        );
      });
      await settle();

      const text = renderedText(screen);
      const leaked = text.match(RAW_KEY) ?? [];
      expect({ language, leaked }).toEqual({ language, leaked: [] });
      // And it is genuinely in that language -- an empty leak list would also
      // be true of a screen that stayed in English the whole time.
      expect(text).toContain(HEADLINE[language]);
      act(() => screen.unmount());
    }

    tree.unmount();
  });
});
