import { apiRequest } from './client';

/**
 * This file used to hand-roll its own fetch wrapper reading
 * `localStorage.getItem('accessToken')` — but every other admin-web module
 * stores the token under `admin_access_token` (see `client.tsx`), so this
 * page's requests always carried `Authorization: Bearer null` and the API
 * correctly answered 401 (see P0-14). Routed through the shared `apiRequest`
 * instead, which also gets this page the refresh-and-retry behavior every
 * other admin-web page already has.
 */

export interface AIAnalytics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  successRate: number;
  averageLatencyMs: number;
  totalTokens: number;
  estimatedCost: number;
  requestsByType: Record<string, number>;
  requestsByModel: Record<string, number>;
  fallbackCount: number;
  safetyBlocks: number;
  feedbackAnalytics: {
    total: number;
    helpful: number;
    notHelpful: number;
    reportIssue: number;
    helpfulRate: number;
  };
  recentTrend: {
    last7Days: number[];
    labels: string[];
  };
}

export interface AIInsightStats {
  totalInsights: number;
  insightsByType: Record<string, number>;
  insightsBySafetyLevel: Record<string, number>;
  averageInsightsPerUser: number;
}

export async function getAIPatformAnalytics(days = 30): Promise<AIAnalytics> {
  return apiRequest<AIAnalytics>(`/admin/ai/analytics?days=${days}`);
}

export async function getAIInsightStats(days = 30): Promise<AIInsightStats> {
  return apiRequest<AIInsightStats>(`/admin/ai/insight-stats?days=${days}`);
}
