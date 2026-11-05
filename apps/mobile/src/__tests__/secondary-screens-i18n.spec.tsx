import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CATALOGS, createLocalization, translate, type Locale } from '@bloodchain/i18n';
import { LocaleProvider, LOCALE_KEY } from '../i18n';
import { ThemeProvider } from '../theme';

/**
 * Sprint 1C: the secondary donor screens, in every language.
 *
 * The source-level check in packages/i18n proves the catalogue answers every
 * key these screens ask for. It cannot prove the screen puts the answer on the
 * glass -- a label built in a module-level map renders whatever language the
 * bundle happened to start in, and passes every catalogue test there is. So
 * these mount the real screens, switch language, and read the words back.
 */
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), dismissAll: jest.fn(), canGoBack: jest.fn(() => true) },
  useLocalSearchParams: () => ({}),
  Link: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));

// The provider reads the stored preference through this, so the store is how a
// test says "open this screen in Russian".
const mockStored = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string) => mockStored.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    mockStored.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    mockStored.delete(key);
  },
}));

jest.mock('../hooks/useDonations', () => ({
  useMyDonations: () => ({ data: { data: [] }, isLoading: false, refetch: jest.fn(), isRefetching: false }),
  useDonationStatistics: () => ({ data: undefined }),
}));

jest.mock('../api/gamification', () => ({}));

import DonationsScreen from '../../app/(app)/donations/index';
import SelectType from '../../app/(booking)/select-type';

const LANGUAGES: Locale[] = ['uz', 'ru', 'en'];

/** Every string the rendered tree puts on screen, concatenated. */
function renderedText(tree: renderer.ReactTestRenderer): string {
  return tree.root
    .findAll((node) => typeof node.type === 'string')
    .flatMap((node) => node.children)
    .filter((child): child is string => typeof child === 'string')
    .join(' ');
}

async function settle() {
  for (let i = 0; i < 4; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function renderInLanguage(element: React.ReactNode, locale: Locale) {
  mockStored.set(LOCALE_KEY, locale);

  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <QueryClientProvider client={client}>
        <ThemeProvider>
          <LocaleProvider>
            <SafeAreaProvider
              initialMetrics={{
                frame: { x: 0, y: 0, width: 390, height: 844 },
                insets: { top: 47, left: 0, right: 0, bottom: 34 },
              }}
            >
              {element}
            </SafeAreaProvider>
          </LocaleProvider>
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  await settle();
  return tree;
}

/** A dotted path where a sentence should be: what a missing key looks like. */
const RAW_KEY =
  /\b(?:common|auth|nav|units|validation|home|health|donate|calendar|community|profile|portal|address|medical|ops|status|table|actions|filters|booking|appointment|appointmentTypes|donationHistory|laboratory|healthTrends|insights|notifications|sos|campaigns|challenges|education|gamification|privacy|security|profileEdit)\.[A-Za-z][A-Za-z.]*/g;

beforeEach(() => {
  mockStored.clear();
});

describe.each([
  ['Donation history', () => <DonationsScreen />, 'donationHistory.title'],
  ['Booking: choose a type', () => <SelectType />, 'booking.selectType'],
])('%s renders in every language', (_name, element, headingKey) => {
  it.each(LANGUAGES)('reads in %s, with no raw key left on the screen', async (locale) => {
    const tree = await renderInLanguage(element(), locale);
    const text = renderedText(tree);

    expect(text.match(RAW_KEY) ?? []).toEqual([]);
    // And it is genuinely that language: an empty leak list would also be true
    // of a screen that never left English.
    expect(text).toContain(createLocalization(locale).t(headingKey));

    act(() => tree.unmount());
  });
});

describe('fallback', () => {
  it('shows English for a key one language is missing, and its own words for the rest', () => {
    const partial = { ...CATALOGS, uz: { donationHistory: { title: 'Qon topshirish tarixi' } } };
    const t = (key: string) => translate(partial, 'uz', key);

    expect(t('donationHistory.title').resolvedFrom).toBe('uz');
    expect(t('donationHistory.subtitle').resolvedFrom).toBe('en');
    expect(t('donationHistory.subtitle').text).toBe('All your previous donations');
  });
});
