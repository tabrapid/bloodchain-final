import React from 'react';
import renderer, { act, type ReactTestRendererJSON } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LocaleProvider } from '../i18n';
import { colors, ThemeProvider } from '../theme';
import { themes } from '../design';

/**
 * P3-9 regression tests.
 *
 * These four screens were written with web-style `className="..."` Tailwind
 * strings on plain React Native primitives, in an app that has no NativeWind (or
 * any other className processor) wired up. `className` is silently a no-op on
 * `View`/`Text`/`TouchableOpacity`, so the screens rendered completely unstyled
 * on a real device — every one of them a flat, default-black-on-white wall of
 * text inside an app whose theme is dark.
 *
 * Type-checking alone can't prove the fix: it only shows the props are legal
 * now. So these tests actually mount each screen and walk the rendered tree,
 * asserting (a) no node carries a `className` prop, and (b) the app's real theme
 * colors are actually present in the resolved styles.
 */

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), dismissAll: jest.fn(), canGoBack: jest.fn(() => true) },
}));
// Pin the resolved theme to dark so assertions against the static `colors`
// export (the dark palette) stay meaningful regardless of what the test
// environment's own system color scheme happens to report.
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => 'dark',
}));
jest.mock('../api/community', () => ({
  getFeed: jest.fn(),
  getImpactStats: jest.fn(),
  getCommunityStats: jest.fn(),
}));
jest.mock('../hooks/useDonations', () => ({
  useDonationStatistics: () => ({ data: undefined }),
  useMyDonations: () => ({ data: { data: [] } }),
}));
jest.mock('../api/challenges', () => ({
  getActiveChallenges: jest.fn(),
  joinChallenge: jest.fn(),
}));
jest.mock('../api/campaigns', () => ({
  getCampaigns: jest.fn(),
  joinCampaign: jest.fn(),
}));
jest.mock('../api/education', () => ({
  getEducationalContent: jest.fn(),
  getMyEducationStats: jest.fn(),
  getMyEducationProgress: jest.fn(),
  startContent: jest.fn(),
  completeContent: jest.fn(),
}));

import { router } from 'expo-router';
import { getFeed, getImpactStats, getCommunityStats } from '../api/community';
import { getActiveChallenges } from '../api/challenges';
import { getCampaigns } from '../api/campaigns';
import {
  getEducationalContent,
  getMyEducationProgress,
  getMyEducationStats,
} from '../api/education';

import CommunityScreen from '../../app/(app)/community/index';
import DonateScreen from '../../app/(app)/donate';
import CampaignsScreen from '../../app/(app)/campaigns/index';
import ChallengesScreen from '../../app/(app)/challenges/index';
import EducationScreen from '../../app/(app)/education/index';
import { createLocalization } from '@bloodchain/i18n';

/**
 * The screens' own words, looked up the way the screens look them up, so a
 * catalogue rewording moves the assertion with it instead of breaking it.
 */
const { t } = createLocalization('en');

const challengeFixture = {
  id: 'challenge-1',
  title: 'Donate three times',
  description: 'Complete three donations before the end of the quarter.',
  type: 'DONATION',
  goal: 3,
  userProgress: 1,
  xpReward: 250,
  endDate: '2026-12-31T00:00:00.000Z',
  badge: { id: 'badge-1', name: 'Lifesaver' },
};

const campaignFixture = {
  id: 'campaign-1',
  title: 'Winter blood drive',
  description: 'Help us stock the regional blood bank before flu season.',
  startDate: '2026-01-01T00:00:00.000Z',
  endDate: '2026-12-31T00:00:00.000Z',
  location: 'Tashkent Central',
  bloodGroupsNeeded: ['O_NEGATIVE', 'A_POSITIVE'],
  participantCount: 42,
  targetParticipants: 100,
  organization: { id: 'org-1', name: 'City Blood Center' },
};

const postFixture = {
  id: 'post-1',
  title: 'A record-breaking month',
  body: 'Our donors gave more blood this month than any other on record.',
  type: 'ANNOUNCEMENT',
  publishedAt: '2026-06-01T00:00:00.000Z',
  author: { id: 'user-1', firstName: 'Aziza', lastName: 'Karimova', displayName: 'Aziza K.' },
};

const contentFixture = {
  id: 'content-1',
  title: 'What happens to your donation',
  description: 'A short walkthrough of the journey from donation to transfusion.',
  type: 'ARTICLE',
  category: 'BASICS',
  difficulty: 'BEGINNER',
  estimatedMinutes: 5,
  xpReward: 50,
};

beforeEach(() => {
  jest.mocked(getFeed).mockResolvedValue({ items: [postFixture], total: 1, page: 1, limit: 20 } as never);
  jest.mocked(getImpactStats).mockResolvedValue({
    donations: 4,
    campaignParticipations: 2,
    challengeCompletions: 3,
    educationCompletions: 5,
    level: 7,
    xp: 1250,
    reputation: 88,
  } as never);
  jest.mocked(getCommunityStats).mockResolvedValue({} as never);
  jest.mocked(getActiveChallenges).mockResolvedValue([challengeFixture] as never);
  jest.mocked(getCampaigns).mockResolvedValue({
    items: [campaignFixture],
    total: 1,
    page: 1,
    limit: 50,
  } as never);
  jest.mocked(getEducationalContent).mockResolvedValue({
    items: [contentFixture],
    total: 1,
    page: 1,
    limit: 50,
  } as never);
  jest.mocked(getMyEducationStats).mockResolvedValue({
    totalCompleted: 5,
    totalStarted: 8,
    totalXpEarned: 400,
  } as never);
  jest.mocked(getMyEducationProgress).mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    limit: 100,
  } as never);
});

/** Mounted trees, unmounted after each test so their effects stop running. */
const mounted: renderer.ReactTestRenderer[] = [];

afterEach(() => {
  act(() => {
    mounted.splice(0).forEach((tree) => tree.unmount());
  });
});

async function renderScreen(Screen: React.ComponentType) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  const element = (
    <ThemeProvider>
      <LocaleProvider>
      <LocaleProvider>
        <SafeAreaProvider
          initialMetrics={{
            frame: { x: 0, y: 0, width: 390, height: 844 },
            insets: { top: 47, left: 0, right: 0, bottom: 34 },
          }}
        >
          <QueryClientProvider client={queryClient}>
            <Screen />
          </QueryClientProvider>
        </SafeAreaProvider>
      </LocaleProvider>
      </LocaleProvider>
    </ThemeProvider>
  );

  // Mount inside a synchronous act, then flush in a separate async one. Doing the
  // mount inside an *async* act nests an act scope inside the renderer's own,
  // which React reports as "overlapping act() calls".
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(element);
  });
  mounted.push(tree);

  // React Query flushes subscriber notifications on a macrotask, so the first
  // commit still shows the loading state. Settle the queries before returning,
  // otherwise the tests assert against a spinner instead of the real screen.
  //
  // Deliberately a loop rather than a single tick. One tick was enough locally
  // but not on a cold CI runner, where the first screen mount pays the React
  // Native module-transform cost (~9s) and the community screen has four
  // queries to resolve: the suite failed there with a fingerprint containing
  // only LoadingState's colours. Waiting until the loading state is actually
  // gone makes it independent of how many ticks the machine happens to need.
  // (walks the node tree rather than JSON.stringify-ing it — the render output
  // carries React context objects that stringify hits circular refs on.)
  //
  // The first few ticks are unconditional: a screen with no loading text at
  // all (Donate renders its header immediately) would otherwise break out
  // before its queries ever resolved, leaving the data-driven sections
  // unrendered.
  for (let attempt = 0; attempt < 25; attempt++) {
    const json = tree.toJSON() as ReactTestRendererJSON | null;
    if (!json) break;
    if (attempt >= 3 && !renderedText(allNodes(json)).includes('Loading')) break;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  return tree;
}

async function renderTree(Screen: React.ComponentType) {
  const tree = await renderScreen(Screen);
  return tree.toJSON() as ReactTestRendererJSON;
}

/** Every node in the rendered host tree, flattened. */
function allNodes(node: ReactTestRendererJSON | null): ReactTestRendererJSON[] {
  if (!node) return [];
  const children = (node.children ?? []).filter(
    (child): child is ReactTestRendererJSON => typeof child === 'object' && child !== null,
  );
  return [node, ...children.flatMap(allNodes)];
}

/**
 * All visible text in the tree. Deliberately walks the nodes rather than
 * JSON.stringify-ing the whole render output, which hits circular references
 * once a React context object ends up on a prop.
 */
function renderedText(nodes: ReactTestRendererJSON[]): string {
  return nodes
    .flatMap((node) => (node.children ?? []).filter((child): child is string => typeof child === 'string'))
    .join(' ');
}

/** Flattened style objects across the whole tree, as one searchable string. */
function styleFingerprint(nodes: ReactTestRendererJSON[]): string {
  return JSON.stringify(nodes.map((node) => node.props?.style ?? null));
}

/**
 * Finds the pressable test *instance* (not JSON node) whose rendered text
 * contains `text`. `onPress` is a prop TouchableOpacity/Pressable consume
 * internally -- it never reaches the host node in `tree.toJSON()`, only the
 * component-tree `ReactTestInstance` sees it, so this walks that tree
 * instead of the JSON one the other helpers use.
 */
function findPressableByText(tree: renderer.ReactTestRenderer, text: string) {
  return tree.root.findAll((node) => {
    if (typeof node.props.onPress !== 'function') return false;
    const ownText = node
      .findAll((n) => typeof n.type === 'string' && (n.type as string) === 'Text')
      .flatMap((n) => (Array.isArray(n.props.children) ? n.props.children : [n.props.children]))
      .filter((c): c is string => typeof c === 'string')
      .join(' ');
    return ownText.includes(text);
  })[0];
}

const screens: Array<[string, React.ComponentType]> = [
  ['community', CommunityScreen],
  ['campaigns', CampaignsScreen],
  ['challenges', ChallengesScreen],
  ['education', EducationScreen],
];

describe('P3-9: the four screens that used className render with real styles', () => {
  it.each(screens)('%s renders without crashing', async (_name, Screen) => {
    const nodes = allNodes(await renderTree(Screen));
    expect(nodes.length).toBeGreaterThan(5);
  });

  it.each(screens)('%s passes no className prop to any native component', async (_name, Screen) => {
    const withClassName = allNodes(await renderTree(Screen)).filter(
      (node) => node.props && 'className' in node.props,
    );
    expect(withClassName).toHaveLength(0);
  });

  it.each(screens)('%s applies the app theme rather than rendering unstyled', async (_name, Screen) => {
    const fingerprint = styleFingerprint(allNodes(await renderTree(Screen)));

    // A real text colour and a real surface edge must be present, so a screen
    // rendering unstyled (or reverting to light-mode Tailwind strings) fails
    // here. Either palette counts: S11 moved Community to the V2 design
    // system, and the other three screens on this list have not been rebuilt
    // yet, so the check is "themed", not "themed by one particular module".
    // (The V1 background paints via a LinearGradient `colors` prop, which
    // React Native serializes to processed native colour ints rather than the
    // original hex string, so it isn't substring-matchable here.)
    const dark = themes.dark;
    expect(
      fingerprint.includes(colors.text) || fingerprint.includes(dark.textPrimary),
    ).toBe(true);
    expect(
      fingerprint.includes(colors.border) ||
        fingerprint.includes(colors.glassBorder) ||
        fingerprint.includes(dark.surface) ||
        fingerprint.includes(dark.divider),
    ).toBe(true);
  });

  it('community renders real content from the API, not just chrome', async () => {
    const nodes = allNodes(await renderTree(CommunityScreen));
    const text = renderedText(nodes);

    // Community is the leaderboard teaser plus the feed; campaigns and
    // challenges live on Donate, which is where those cards are asserted.
    expect(text).toContain('Community');
    expect(text).toContain(postFixture.title);
    expect(text).toContain(postFixture.body);
  });

  it('donate: tapping a challenge card navigates to the challenges list (there is no per-challenge detail route)', async () => {
    const tree = await renderScreen(DonateScreen);
    const card = findPressableByText(tree, challengeFixture.title);
    expect(card).toBeDefined();

    act(() => {
      (card!.props.onPress as () => void)();
    });

    expect(router.push).toHaveBeenCalledWith('/challenges');
  });

  it('donate: tapping a campaign card navigates to the campaigns list (there is no per-campaign detail route)', async () => {
    const tree = await renderScreen(DonateScreen);
    const card = findPressableByText(tree, campaignFixture.title);
    expect(card).toBeDefined();

    act(() => {
      (card!.props.onPress as () => void)();
    });

    expect(router.push).toHaveBeenCalledWith('/campaigns');
  });

  it('campaigns renders campaign detail rows with themed muted text', async () => {
    const nodes = allNodes(await renderTree(CampaignsScreen));
    const text = renderedText(nodes);

    expect(text).toContain(campaignFixture.title);
    expect(text).toContain(campaignFixture.location);
    // Either palette: S11 moved this screen to the V2 design system, and what
    // is being checked is that the detail rows are drawn in a real secondary
    // text colour rather than unstyled.
    const fingerprint = styleFingerprint(nodes);
    expect(
      fingerprint.includes(colors.textMuted) || fingerprint.includes(themes.dark.textSecondary),
    ).toBe(true);
  });

  it('challenges renders a themed progress bar for a joined challenge', async () => {
    const nodes = allNodes(await renderTree(ChallengesScreen));
    const fingerprint = styleFingerprint(nodes);

    // The bar fills to userProgress/goal (1 of 3) in a real accent -- the
    // brand rose, since a challenge in progress is not a warning -- rather
    // than an unstyled rectangle.
    expect(
      fingerprint.includes(colors.primary) ||
        fingerprint.includes(themes.dark.rose.base) ||
        fingerprint.includes(themes.dark.warning.base),
    ).toBe(true);
    expect(fingerprint).toMatch(/33\.3\d*%/);
    expect(renderedText(nodes)).toContain(challengeFixture.title);
  });

  it('education renders its stats card and content list', async () => {
    const text = renderedText(allNodes(await renderTree(EducationScreen)));

    expect(text).toContain(t('education.yourProgress'));
    expect(text).toContain(contentFixture.title);
  });
});

/**
 * P3-10 regression tests.
 *
 * The card used to offer a single "Complete" button and nothing ever called
 * `startContent`. The backend rejects that outright — `completeContent` throws
 * `You must start the content before completing it` when no progress row
 * exists — so the only control on the screen failed every time it was tapped.
 * The card now derives its control from the donor's actual progress.
 */
describe('P3-10: the education card offers the control the backend will accept', () => {
  /**
   * Only the content list below the "Available Content" heading — the stats
   * card above it reads "5 Completed 8 Started", which would satisfy any
   * naive assertion about these words appearing on screen.
   */
  async function cardText() {
    const text = renderedText(allNodes(await renderTree(EducationScreen)));
    const listStart = text.indexOf(t('education.availableContent'));
    expect(listStart).toBeGreaterThan(-1);
    return text.slice(listStart + t('education.availableContent').length);
  }

  it('offers Start, not Complete, for content the donor has not begun', async () => {
    const text = await cardText();

    expect(text).toContain('Start');
    expect(text).not.toContain('Complete');
  });

  it('offers Complete once the content is started', async () => {
    jest.mocked(getMyEducationProgress).mockResolvedValue({
      items: [
        {
          id: 'progress-1',
          userId: 'user-1',
          contentId: contentFixture.id,
          status: 'STARTED',
          startedAt: '2026-06-01T00:00:00.000Z',
          xpAwarded: 0,
        },
      ],
      total: 1,
      page: 1,
      limit: 100,
    } as never);

    const text = await cardText();

    // S11.1: the card used to offer "Complete" for an article the app had no
    // screen for -- `Start` called the start endpoint and opened nothing, and
    // the body has been in the payload since the module shipped. Completion
    // now lives at the end of the article, where the donor has actually been
    // through the thing they are claiming to have read; the card continues it.
    expect(text).toContain('Continue');
    expect(text).not.toContain('Start');
  });

  it('opens the article rather than completing it from the list', async () => {
    const { router } = require('expo-router');
    jest.mocked(getMyEducationProgress).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 100,
    } as never);

    const tree = await renderScreen(EducationScreen);
    // The Button element carrying the Start label, whose onPress is the card's.
    const startButton = tree.root.find(
      (node) => node.props?.label === t('education.start') && typeof node.props?.onPress === 'function',
    );

    await act(async () => {
      startButton.props.onPress();
    });

    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/(app)/education/[id]' }),
    );
    tree.unmount();
  });

  it('offers no action once the content is completed', async () => {
    jest.mocked(getMyEducationProgress).mockResolvedValue({
      items: [
        {
          id: 'progress-1',
          userId: 'user-1',
          contentId: contentFixture.id,
          status: 'COMPLETED',
          startedAt: '2026-06-01T00:00:00.000Z',
          completedAt: '2026-06-02T00:00:00.000Z',
          xpAwarded: 50,
        },
      ],
      total: 1,
      page: 1,
      limit: 100,
    } as never);

    const text = await cardText();

    expect(text).toContain('Completed');
    expect(text).not.toContain('Start');
  });
});
