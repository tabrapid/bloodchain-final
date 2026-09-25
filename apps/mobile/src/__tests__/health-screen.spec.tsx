import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LocaleProvider } from '../i18n';
import { ThemeProvider } from '../theme';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), dismissAll: jest.fn(), canGoBack: jest.fn(() => true) },
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => 'dark',
}));

const mockTrendSummary = jest.fn();
const mockLatestInsight = jest.fn();
const mockAiEnabled = jest.fn();
jest.mock('../hooks/useHealth', () => ({
  useTrendSummary: () => mockTrendSummary(),
  useLatestInsight: () => mockLatestInsight(),
  useAiEnabled: () => mockAiEnabled(),
}));

const mockResults = jest.fn();
jest.mock('../hooks/useLaboratory', () => ({
  useDonorLaboratoryResults: () => mockResults(),
}));

import { createLocalization } from '@bloodchain/i18n';
import Health from '../../app/(app)/health';

const { t } = createLocalization('en');

function render(node: React.ReactNode) {
  let tree: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <ThemeProvider>
        <LocaleProvider>
          <SafeAreaProvider
            initialMetrics={{
              frame: { x: 0, y: 0, width: 390, height: 844 },
              insets: { top: 47, left: 0, right: 0, bottom: 34 },
            }}
          >
            {node}
          </SafeAreaProvider>
        </LocaleProvider>
      </ThemeProvider>,
    );
  });
  return tree!;
}

function renderedText(tree: renderer.ReactTestRenderer): string {
  return tree.root
    .findAll((node) => typeof node.type === 'string')
    .flatMap((node) => node.children)
    .filter((child): child is string => typeof child === 'string')
    .join(' | ');
}

const query = (over: Record<string, unknown>) => ({
  data: undefined,
  isPending: false,
  isError: false,
  isRefetching: false,
  refetch: jest.fn(),
  ...over,
});

const SUMMARY = {
  totalTests: 3,
  availableParameters: [
    {
      code: 'HEMOGLOBIN',
      name: 'Haemoglobin',
      unit: 'g/dL',
      category: 'HEMATOLOGY',
      measurementCount: 3,
      latestValue: 14.2,
      latestValueDate: '2026-09-01T00:00:00.000Z',
      hasReferenceRange: true,
    },
  ],
  recentTrend: {
    parameterCode: 'HEMOGLOBIN',
    parameterName: 'Haemoglobin',
    unit: 'g/dL',
    latestValue: 14.2,
    latestValueDate: '2026-09-01T00:00:00.000Z',
    trend: 'STABLE' as const,
    hasReferenceRange: true,
    referenceMin: 13,
    referenceMax: 17,
    points: [
      { date: '2026-07-01T00:00:00.000Z', value: 13.8, flag: 'NORMAL' },
      { date: '2026-08-01T00:00:00.000Z', value: 14.0, flag: 'NORMAL' },
      { date: '2026-09-01T00:00:00.000Z', value: 14.2, flag: 'NORMAL' },
    ],
  },
};

beforeEach(() => {
  mockTrendSummary.mockReset().mockReturnValue(query({ data: SUMMARY }));
  mockResults.mockReset().mockReturnValue(query({ data: [] }));
  mockLatestInsight.mockReset().mockReturnValue(query({ data: null }));
  mockAiEnabled.mockReset().mockReturnValue(query({ data: true }));
});

/**
 * S11 B4: the Health tab's four states, and the two claims it must never make
 * without support.
 *
 * V1 had one state -- "loaded" -- and rendered an empty screen for the other
 * three. A donor whose request failed saw the spinner stop and nothing appear.
 */
describe('Health tells its states apart', () => {
  it('shows neither an error nor an empty state while it is still loading', () => {
    mockTrendSummary.mockReturnValue(query({ isPending: true }));
    mockResults.mockReturnValue(query({ isPending: true }));

    const text = renderedText(render(<Health />));

    expect(text).toContain(t('health.title'));
    expect(text).not.toContain(t('common.errorTitle'));
    expect(text).not.toContain(t('health.noDataTitle'));
  });

  it('says the request failed, and offers a retry, when nothing could be loaded', () => {
    mockTrendSummary.mockReturnValue(query({ isError: true }));
    mockResults.mockReturnValue(query({ isError: true }));

    const text = renderedText(render(<Health />));

    expect(text).toContain(t('common.errorTitle'));
    expect(text).toContain(t('common.retry'));
    expect(text).not.toContain(t('health.noDataTitle'));
  });

  it('says there is no data yet when the account really is empty', () => {
    mockTrendSummary.mockReturnValue(
      query({ data: { totalTests: 0, availableParameters: [] } }),
    );

    const text = renderedText(render(<Health />));

    expect(text).toContain(t('health.noDataTitle'));
    expect(text).toContain(t('laboratory.bookBloodTest'));
    expect(text).not.toContain(t('common.errorTitle'));
  });

  it('keeps the half that loaded when only one request failed', () => {
    mockTrendSummary.mockReturnValue(query({ isError: true }));
    mockResults.mockReturnValue(
      query({
        data: [
          {
            id: 'r1',
            status: 'PUBLISHED',
            publishedAt: '2026-09-01T00:00:00.000Z',
            testType: { name: 'Full blood count' },
            items: [{ flag: 'NORMAL', parameter: { code: 'HEMOGLOBIN' } }],
          },
        ],
      }),
    );

    const text = renderedText(render(<Health />));

    expect(text).toContain('Full blood count');
    expect(text).toContain(t('common.retry'));
    // Not the whole-screen failure: most of this screen is still true.
    expect(text).not.toContain(t('common.errorTitle'));
  });
});

describe('Health does not overstate what it knows', () => {
  it('states the range only when the laboratory gave one', () => {
    const text = renderedText(render(<Health />));
    expect(text).toContain(t('medical.resultFlags.withinRange'));

    const noRange = {
      ...SUMMARY,
      recentTrend: {
        ...SUMMARY.recentTrend,
        hasReferenceRange: false,
        referenceMin: undefined,
        referenceMax: undefined,
        points: SUMMARY.recentTrend.points.map((p) => ({ ...p, flag: undefined })),
      },
    };
    mockTrendSummary.mockReturnValue(query({ data: noRange }));

    const without = renderedText(render(<Health />));
    expect(without).toContain('Haemoglobin');
    expect(without).not.toContain(t('medical.resultFlags.withinRange'));
    expect(without).not.toContain(t('medical.resultFlags.outsideRange'));
  });

  it('carries the AI disclaimer in the card that shows the AI sentence', () => {
    mockLatestInsight.mockReturnValue(
      query({ data: { id: 'i1', title: 'Your haemoglobin is steady', summary: 'Three measurements, all within range.' } }),
    );

    const text = renderedText(render(<Health />));

    expect(text).toContain('Your haemoglobin is steady');
    expect(text).toContain(t('medical.aiSafety.disclaimer'));
  });

  it('shows no AI section at all when the deployment has AI switched off', () => {
    mockAiEnabled.mockReturnValue(query({ data: false }));
    mockLatestInsight.mockReturnValue(query({ data: { id: 'i1', title: 'An insight', summary: 'A summary.' } }));

    const text = renderedText(render(<Health />));

    expect(text).not.toContain(t('health.aiInsights'));
    expect(text).not.toContain('An insight');
    expect(text).not.toContain(t('medical.aiSafety.disclaimer'));
  });
});
