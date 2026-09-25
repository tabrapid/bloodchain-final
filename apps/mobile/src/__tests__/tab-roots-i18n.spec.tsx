import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createLocalization, type Locale } from '@bloodchain/i18n';
import { LocaleProvider, LOCALE_KEY } from '../i18n';
import { ThemeProvider } from '../theme';

/**
 * S11 B4: the six tab roots, in every language.
 *
 * These are the screens a donor opens every time, and they were the screens
 * with the most English baked into them -- `'Schedule\nDonation'`, `'ELIGIBLE
 * NOW'`, `${n} measurement${n === 1 ? '' : 's'} tracked`. A catalogue test
 * cannot see any of that: the key is simply never asked for. So these mount
 * the real screen in each language and read the glass back, checking both
 * directions -- no dotted catalogue path left showing (a key the screen asks
 * for and the catalogue does not have), and the screen genuinely in that
 * language (a string the catalogue has and the screen never asks for).
 */
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
  Link: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => 'dark',
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

const query = (data: unknown) => ({
  data,
  isPending: false,
  isLoading: false,
  isError: false,
  isRefetching: false,
  refetch: jest.fn(),
});

jest.mock('../hooks/useUsers', () => ({
  useUserProfile: () => query({ firstName: 'Aziza', lastName: 'Karimova' }),
}));
jest.mock('../hooks/useDonors', () => ({
  useDonorProfile: () =>
    query({ bloodType: 'O', rhFactor: 'POSITIVE', verificationStatus: 'VERIFIED', city: 'Tashkent' }),
  useProfileCompletion: () => query({ data: { percentage: 60 } }),
}));
jest.mock('../hooks/useAppointments', () => ({
  useNextAppointment: () => query(undefined),
}));
jest.mock('../hooks/useDonations', () => ({
  useDonationStatistics: () =>
    query({
      totalDonations: 4,
      totalVolumeMl: 1800,
      completedCount: 4,
      cancelledCount: 0,
      abortedCount: 0,
      lastDonationAt: '2026-08-01T00:00:00.000Z',
      nextDonationDate: '2026-11-01T00:00:00.000Z',
    }),
  useMyDonations: () => query({ data: [{ status: 'COMPLETED', donationType: 'WHOLE_BLOOD' }] }),
}));
jest.mock('../hooks/useGamification', () => ({
  useGamificationProfile: () => query({ emergencyResponseCount: 2 }),
  useLevelProgress: () => query({ currentLevel: 3, currentXp: 120, xpForNextLevel: 200, progress: 0.6 }),
}));
jest.mock('../hooks/useNotifications', () => ({
  useUnreadCount: () => query({ count: 2 }),
}));
jest.mock('../hooks/useEmergency', () => ({
  useDonorEmergencies: () => query({ active: [], responded: [] }),
}));
jest.mock('../hooks/useHealth', () => ({
  useTrendSummary: () =>
    query({
      totalTests: 2,
      availableParameters: [
        {
          code: 'HEMOGLOBIN',
          name: 'Haemoglobin',
          unit: 'g/dL',
          category: 'HEMATOLOGY',
          measurementCount: 2,
          latestValue: 14.2,
          latestValueDate: '2026-09-01T00:00:00.000Z',
        },
      ],
      recentTrend: {
        parameterCode: 'HEMOGLOBIN',
        parameterName: 'Haemoglobin',
        unit: 'g/dL',
        latestValue: 14.2,
        latestValueDate: '2026-09-01T00:00:00.000Z',
        trend: 'STABLE',
        hasReferenceRange: true,
        referenceMin: 13,
        referenceMax: 17,
        points: [
          { date: '2026-08-01T00:00:00.000Z', value: 14.0, flag: 'NORMAL' },
          { date: '2026-09-01T00:00:00.000Z', value: 14.2, flag: 'NORMAL' },
        ],
      },
    }),
  useLatestInsight: () => query(null),
  useAiEnabled: () => query(true),
}));
jest.mock('../hooks/useLaboratory', () => ({
  useDonorLaboratoryResults: () => query([]),
}));
jest.mock('../api/campaigns', () => ({ getCampaigns: async () => ({ items: [] }) }));
jest.mock('../api/challenges', () => ({ getActiveChallenges: async () => [] }));
jest.mock('../api/community', () => ({
  getFeed: async () => ({
    items: [
      {
        id: 'p1',
        type: 'CAMPAIGN',
        title: 'Yangi aksiya',
        body: 'Shahar markazida qon topshirish kuni.',
        publishedAt: '2026-09-20T00:00:00.000Z',
        author: { firstName: 'Dilnoza', lastName: 'Yusupova' },
      },
    ],
  }),
  getImpactStats: async () => ({ donations: 4, campaignParticipations: 2, challengeCompletions: 1 }),
  reportContent: async () => undefined,
}));
jest.mock('../api/gamification', () => ({ getUserRank: async () => ({ rank: 12, total: 480 }) }));

import Home from '../../app/(app)/home';
import Health from '../../app/(app)/health';
import Donate from '../../app/(app)/donate';
import Community from '../../app/(app)/community/index';

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
  /\b(?:common|auth|nav|units|validation|home|health|donate|calendar|community|profile|medical|booking|appointment|donationHistory|laboratory|healthTrends|insights|notifications|sos|campaigns|challenges|education|gamification|privacy|security|profileEdit)\.[A-Za-z][A-Za-z.]*/g;

beforeEach(() => {
  mockStored.clear();
});

describe.each([
  ['Home', () => <Home />, 'home.quickActions'],
  ['Health', () => <Health />, 'health.labMarkers'],
  ['Donate', () => <Donate />, 'donate.donationTypes'],
  ['Community', () => <Community />, 'community.feed'],
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
