import { useQuery } from '@tanstack/react-query';

import {
  getAvailableParameters,
  getParameterHistory,
  getParameterTrend,
  getTrendSummary,
  type AvailableParameter,
  type TrendData,
  type TrendHistoryResponse,
  type TrendSummary,
} from '../api/health-trends';
import { getAiAvailability, getInsightHistory, type AiInsight } from '../api/ai-health';

/**
 * The Health tab's data.
 *
 * The screen used to fetch all four of these in one `Promise.all` inside a
 * `useEffect`, with the failure swallowed into a `console.error`. That is why
 * a donor whose connection dropped saw the screen finish loading and then show
 * nothing at all: no error, no retry, no explanation. Splitting them into
 * queries is what lets the screen say which part failed and offer to try that
 * part again, and it is also what makes the tab honour the shared cache
 * instead of refetching everything on every visit.
 */
export function useTrendSummary(range?: string) {
  return useQuery<TrendSummary>({
    queryKey: ['health-trend-summary', range ?? null],
    queryFn: () => getTrendSummary(range),
  });
}

/**
 * The most recent AI insight, or null when the donor has none.
 *
 * `null` rather than `undefined` so the screen can tell "nothing generated
 * yet" apart from "still loading" -- the difference between an invitation and
 * a spinner.
 */
export function useLatestInsight() {
  return useQuery<AiInsight | null>({
    queryKey: ['ai-insight-latest'],
    queryFn: async () => {
      const history = await getInsightHistory({ limit: 1 });
      return history.insights[0] ?? null;
    },
  });
}

/**
 * Whether AI is switched on in this deployment.
 *
 * A failure resolves to `false`, not to an error. The section is hidden when
 * the answer is no, and a card promising an explanation the deployment cannot
 * produce is exactly what this check exists to prevent -- so an unreachable
 * availability endpoint has to fall on the safe side.
 */
export function useAiEnabled() {
  return useQuery<boolean>({
    queryKey: ['ai-availability'],
    queryFn: () =>
      getAiAvailability()
        .then((availability) => availability.enabled)
        .catch(() => false),
  });
}

/**
 * Every parameter the donor has a measurement for.
 *
 * The trends screen used to fetch this and the summary together in a
 * `Promise.all` whose rejection set one flag for both, so a partial failure
 * showed the empty state -- "no health trends yet" -- to a donor who has
 * years of them.
 */
export function useAvailableParameters() {
  return useQuery<AvailableParameter[]>({
    queryKey: ['health-parameters'],
    queryFn: getAvailableParameters,
  });
}

/** One parameter's series over a range. Disabled until a parameter is chosen. */
export function useParameterTrend(code: string | null, range: string) {
  return useQuery<TrendData | null>({
    queryKey: ['health-parameter-trend', code, range],
    queryFn: () => getParameterTrend(code!, { range }),
    enabled: Boolean(code),
  });
}

/** The measurements behind the series, newest first. */
export function useParameterHistory(code: string | null, limit = 10) {
  return useQuery<TrendHistoryResponse | null>({
    queryKey: ['health-parameter-history', code, limit],
    queryFn: () => getParameterHistory(code!, limit, 0),
    enabled: Boolean(code),
  });
}
