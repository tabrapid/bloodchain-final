jest.mock('../auth/storage', () => ({
  getAccessToken: jest.fn().mockResolvedValue('test-access-token'),
  getRefreshToken: jest.fn().mockResolvedValue('test-refresh-token'),
  setAccessToken: jest.fn().mockResolvedValue(undefined),
  deleteAccessToken: jest.fn().mockResolvedValue(undefined),
  deleteRefreshToken: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() },
}));

import {
  generateInsight,
  explainResult,
  analyzeTrend,
  sendChatMessage,
  submitFeedback,
  getInsightHistory,
  getInsight,
  getConversations,
  InsightType,
  FeedbackType,
} from './ai-health';

function mockFetchOnce(body: unknown, status = 200) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

/**
 * Every read-returning function in this file called
 * `apiRequest<{ data: T }>(...)` and then returned `response.data` -- but
 * `apiRequest` already strips exactly one `{ data: ... }` envelope (the
 * backend hand-wraps every route here in exactly one, per
 * ai-health.controller.ts's `return { data: ... }`). That's a double-unwrap:
 * `response` at runtime was already the real T with no `.data` property, so
 * `response.data` always resolved to `undefined`. Every AI Insights feature
 * (Analyze My Results, Summarize Trends, Questions to Discuss, Ask About My
 * Results chat, insight history) crashed inside its own try/catch reading a
 * field off `undefined` and surfaced a generic "temporarily unavailable"
 * message -- indistinguishable from a real backend outage, on every single
 * attempt, for every user, always.
 */
describe('ai-health API client (bug: double .data unwrap on an already-unwrapped response)', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('generateInsight resolves to the insight object directly, not undefined', async () => {
    mockFetchOnce({ data: { id: 'insight-1', title: 'Your latest result', summary: 'Looks normal.' } });

    const result = await generateInsight({ type: InsightType.RESULT_EXPLANATION });

    expect(result).toEqual({ id: 'insight-1', title: 'Your latest result', summary: 'Looks normal.' });
    expect(result).not.toBeUndefined();
  });

  it('explainResult resolves to the insight object directly, not undefined', async () => {
    mockFetchOnce({ data: { id: 'insight-2', title: 'Explanation', summary: 'Here is why.' } });

    const result = await explainResult({ resultId: 'result-1' });

    expect(result).toEqual({ id: 'insight-2', title: 'Explanation', summary: 'Here is why.' });
  });

  it('analyzeTrend resolves to the insight object directly, not undefined', async () => {
    mockFetchOnce({ data: { id: 'insight-3', title: 'Trend summary', summary: 'Stable.' } });

    const result = await analyzeTrend({ parameterCode: 'HGB' });

    expect(result).toEqual({ id: 'insight-3', title: 'Trend summary', summary: 'Stable.' });
  });

  it('sendChatMessage resolves to the chat response directly, not undefined -- this is what insights/index.tsx reads response.message.content off of', async () => {
    mockFetchOnce({
      data: {
        conversation: { id: 'conv-1', title: 'Chat' },
        message: { id: 'msg-1', role: 'assistant', content: 'Your hemoglobin is within range.' },
      },
    });

    const result = await sendChatMessage({ message: 'How is my hemoglobin?' });

    expect(result.message.content).toBe('Your hemoglobin is within range.');
  });

  it('submitFeedback resolves to the feedback object directly, not undefined', async () => {
    mockFetchOnce({ data: { id: 'fb-1', insightId: 'insight-1', type: FeedbackType.HELPFUL } });

    const result = await submitFeedback({ insightId: 'insight-1', type: FeedbackType.HELPFUL });

    expect(result).toEqual({ id: 'fb-1', insightId: 'insight-1', type: FeedbackType.HELPFUL });
  });

  it('getInsightHistory resolves to the history object directly, not undefined', async () => {
    mockFetchOnce({ data: { insights: [{ id: 'insight-1' }], total: 1 } });

    const result = await getInsightHistory();

    expect(result).toEqual({ insights: [{ id: 'insight-1' }], total: 1 });
  });

  it('getInsight resolves to the insight object directly, not undefined', async () => {
    mockFetchOnce({ data: { id: 'insight-1', title: 'Saved insight' } });

    const result = await getInsight('insight-1');

    expect(result).toEqual({ id: 'insight-1', title: 'Saved insight' });
  });

  it('getConversations resolves to the array directly, not undefined', async () => {
    mockFetchOnce({ data: [{ id: 'conv-1', title: 'Chat', messageCount: 2 }] });

    const result = await getConversations();

    expect(result).toEqual([{ id: 'conv-1', title: 'Chat', messageCount: 2 }]);
  });
});
