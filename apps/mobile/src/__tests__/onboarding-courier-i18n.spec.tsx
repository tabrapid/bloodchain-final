import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createLocalization, type Locale } from '@bloodchain/i18n';
import { LocaleProvider, LOCALE_KEY } from '../i18n';
import { ThemeProvider } from '../theme';

/**
 * Sprint 1D: the two flows Sprint 1C left in English.
 *
 * Onboarding is the harder of the two to get right, because its six steps are
 * a module-level list: the headline of every step is a `titleKey` resolved in
 * the component, and nothing but mounting the screen proves that it is.
 */
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), dismissAll: jest.fn(), canGoBack: jest.fn(() => true) },
  useLocalSearchParams: () => ({}),
  Link: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));

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

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getCurrentPositionAsync: jest.fn(async () => ({ coords: { latitude: 41.3, longitude: 69.2 } })),
  watchPositionAsync: jest.fn(async () => ({ remove: jest.fn() })),
  Accuracy: { Balanced: 3 },
}));

jest.mock('../hooks/useDonors', () => ({ useUpdateDonorProfile: () => ({ mutateAsync: jest.fn(), isPending: false }) }));
jest.mock('../hooks/useUsers', () => ({ useUpdateUserProfile: () => ({ mutateAsync: jest.fn(), isPending: false }) }));
jest.mock('../hooks/useNotifications', () => ({
  useUpdateNotificationPreferences: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));
jest.mock('../hooks/useAuth', () => ({ useLogout: () => ({ mutate: jest.fn(), isPending: false }) }));

jest.mock('../api/courier', () => ({
  getActiveShipment: jest.fn(async () => null),
  getCourierShipments: jest.fn(async () => ({ data: [] })),
  getCourierStats: jest.fn(async () => ({ completed: 4, failed: 1, total: 5, avgDeliveryTimeMinutes: 37 })),
  getCourierProfile: jest.fn(async () => ({
    id: 'c-1',
    displayName: 'Courier One',
    phone: '+998901234567',
    status: 'AVAILABLE',
    organizationName: 'City Blood Center',
    currentShipmentId: null,
  })),
  updateCourierProfile: jest.fn(),
  updateCourierStatus: jest.fn(),
  getShipmentTracking: jest.fn(async () => null),
  updateLocation: jest.fn(),
  acceptShipment: jest.fn(),
  declineShipment: jest.fn(),
  startPickup: jest.fn(),
  confirmPickup: jest.fn(),
  startDelivery: jest.fn(),
  arriveAtHospital: jest.fn(),
  failShipment: jest.fn(),
}));

import CompleteProfile from '../../app/(onboarding)/complete-profile';
import CourierActive from '../../app/(courier)/active';
import CourierHistory from '../../app/(courier)/history';
import CourierProfile from '../../app/(courier)/profile';

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
  for (let i = 0; i < 5; i++) {
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
  /\b(?:common|auth|nav|units|validation|home|health|donate|calendar|community|profile|portal|address|medical|ops|status|table|actions|filters|booking|appointment|appointmentTypes|donationHistory|laboratory|healthTrends|insights|notifications|sos|campaigns|challenges|education|gamification|privacy|security|profileEdit|onboarding|courier)\.[A-Za-z][A-Za-z.]*/g;

beforeEach(() => {
  mockStored.clear();
});

describe.each([
  ['Onboarding: complete profile', () => <CompleteProfile />, 'onboarding.welcomeTitle'],
  ['Courier: active delivery', () => <CourierActive />, 'courier.noActive'],
  ['Courier: history', () => <CourierHistory />, 'courier.historySubtitle'],
  ['Courier: profile', () => <CourierProfile />, 'courier.availability'],
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

describe('onboarding step headlines', () => {
  it('resolves every step, not only the one the screen opens on', () => {
    // The six steps live in a module-level list, so each carries a key rather
    // than a headline; this is what proves each key has words behind it.
    const stepKeys = [
      'onboarding.welcomeTitle',
      'onboarding.nameTitle',
      'onboarding.bloodTypeTitle',
      'onboarding.locationTitle',
      'onboarding.notificationsTitle',
      'onboarding.reviewTitle',
    ];
    for (const locale of LANGUAGES) {
      const { t } = createLocalization(locale);
      for (const key of stepKeys) {
        expect({ locale, key, text: t(key) }).not.toEqual({ locale, key, text: key });
      }
    }
  });

  it('counts the steps in the reader’s language', () => {
    expect(createLocalization('uz').t('onboarding.stepOf', { current: 2, total: 6 })).toBe(
      '6 dan 2-qadam',
    );
    expect(createLocalization('ru').t('onboarding.stepOf', { current: 2, total: 6 })).toBe(
      'Шаг 2 из 6',
    );
    expect(createLocalization('en').t('onboarding.stepOf', { current: 2, total: 6 })).toBe(
      'Step 2 of 6',
    );
  });
});
