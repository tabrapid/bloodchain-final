import React from 'react';
import renderer, { act, type ReactTestRendererJSON } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors } from '../theme';

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

jest.mock('../api/community', () => ({
  getFeed: jest.fn(),
  getImpactStats: jest.fn(),
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
  startContent: jest.fn(),
  completeContent: jest.fn(),
}));

import { getFeed, getImpactStats } from '../api/community';
import { getActiveChallenges } from '../api/challenges';
import { getCampaigns } from '../api/campaigns';
import { getEducationalContent, getMyEducationStats } from '../api/education';

import CommunityScreen from '../../app/(app)/community/index';
import CampaignsScreen from '../../app/(app)/campaigns/index';
import ChallengesScreen from '../../app/(app)/challenges/index';
import EducationScreen from '../../app/(app)/education/index';

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
});

async function renderScreen(Screen: React.ComponentType) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}
      >
        <QueryClientProvider client={queryClient}>
          <Screen />
        </QueryClientProvider>
      </SafeAreaProvider>,
    );
  });

  // React Query flushes subscriber notifications on a macrotask, so the first
  // commit still shows the loading state. Let the queries settle so the tests
  // assert against the real, populated screen rather than a spinner.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

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

    // The dark background and the app's real text color must both be present —
    // these come from src/theme.ts, so a screen rendering unstyled (or reverting
    // to light-mode Tailwind strings) fails here.
    expect(fingerprint).toContain(colors.background);
    expect(fingerprint).toContain(colors.text);
  });

  it('community renders real content from the API, not just chrome', async () => {
    const nodes = allNodes(await renderTree(CommunityScreen));
    const text = renderedText(nodes);

    expect(text).toContain('Your Impact');
    expect(text).toContain(postFixture.title);
    expect(text).toContain(challengeFixture.title);
    expect(text).toContain(campaignFixture.title);
  });

  it('campaigns renders campaign detail rows with themed muted text', async () => {
    const nodes = allNodes(await renderTree(CampaignsScreen));
    const text = renderedText(nodes);

    expect(text).toContain(campaignFixture.title);
    expect(text).toContain(campaignFixture.location);
    expect(styleFingerprint(nodes)).toContain(colors.textMuted);
  });

  it('challenges renders a themed progress bar for a joined challenge', async () => {
    const nodes = allNodes(await renderTree(ChallengesScreen));
    const fingerprint = styleFingerprint(nodes);

    // ProgressBar fills to userProgress/goal (1 of 3) using the primary color.
    expect(fingerprint).toContain(colors.primary);
    expect(fingerprint).toMatch(/33\.3\d*%/);
    expect(renderedText(nodes)).toContain(challengeFixture.title);
  });

  it('education renders its stats card and content list', async () => {
    const text = renderedText(allNodes(await renderTree(EducationScreen)));

    expect(text).toContain('Your Progress');
    expect(text).toContain(contentFixture.title);
    expect(text).toContain('Complete');
  });
});
