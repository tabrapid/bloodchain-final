'use client';

import { useEffect, useState } from 'react';
import { Brain, TrendingUp, TrendingDown, CheckCircle, XCircle, AlertTriangle, BarChart3, Clock, MessageSquare, ThumbsUp, ThumbsDown, Flag, RefreshCw, LayoutDashboard, Users, Building2, Ship, Package, Droplet, TestTube, Bell, FileText, Activity, Settings } from 'lucide-react';
import { DashboardShell, LoadingState } from '@donor/ui/components';
import { isAuthenticated, me } from '@lib/auth';
import { getAIPatformAnalytics, getAIInsightStats } from '@lib/ai-api';
import { StatusBadgeWrapper } from '@lib/status';

import { navItems } from '@lib/navigation';

interface AIAnalytics {
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

interface AIInsightStats {
  totalInsights: number;
  insightsByType: Record<string, number>;
  insightsBySafetyLevel: Record<string, number>;
  averageInsightsPerUser: number;
}

export default function AIAnalyticsPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AIAnalytics | null>(null);
  const [insightStats, setInsightStats] = useState<AIInsightStats | null>(null);
  const [days, setDays] = useState(30);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        if (!isAuthenticated()) return;
        const userData = await me();
        if (!userData.roles.includes('SUPER_ADMIN')) return;
        setCurrentUser({ firstName: userData.firstName, lastName: userData.lastName, roles: userData.roles });
        await loadData();
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  async function loadData() {
    try {
      const [analyticsData, insightData] = await Promise.all([
        getAIPatformAnalytics(days),
        getAIInsightStats(days),
      ]);
      setAnalytics(analyticsData);
      setInsightStats(insightData);
    } catch (err) {
      console.error('Failed to load AI analytics:', err);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  if (isLoading) {
    return (
      <DashboardShell title="AI Analytics" sidebarItems={navItems} userName={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : undefined} onLogout={() => {}}>
        <LoadingState />
      </DashboardShell>
    );
  }

  if (!analytics || !insightStats) {
    return (
      <DashboardShell title="AI Analytics" sidebarItems={navItems} userName={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : undefined} onLogout={() => {}}>
        <div className="p-6">
          <p className="text-gray-500">AI analytics data not available.</p>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="AI Analytics" sidebarItems={navItems} userName={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : undefined} onLogout={() => {}}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">AI Health Intelligence</h1>
            <p className="text-sm text-gray-500 mt-1">Platform AI usage, performance, and safety metrics</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="bg-gray-100 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-blue-100">
                <BarChart3 className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Requests</p>
                <p className="text-xl font-semibold text-gray-900">{analytics.totalRequests}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${analytics.successRate >= 95 ? 'bg-green-100' : analytics.successRate >= 80 ? 'bg-yellow-100' : 'bg-red-100'}`}>
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Success Rate</p>
                <p className="text-xl font-semibold text-gray-900">{analytics.successRate}%</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-purple-100">
                <Clock className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Avg Latency</p>
                <p className="text-xl font-semibold text-gray-900">{analytics.averageLatencyMs}ms</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-orange-100">
                <AlertTriangle className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Safety Blocks</p>
                <p className="text-xl font-semibold text-gray-900">{analytics.safetyBlocks}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-medium text-gray-900 mb-4">Requests by Feature</h3>
            <div className="space-y-3">
              {Object.entries(analytics.requestsByType).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-700">{type.replace(/_/g, ' ')}</span>
                  <span className="font-semibold text-gray-900">{count}</span>
                </div>
              ))}
              {Object.keys(analytics.requestsByType).length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">No data available</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-medium text-gray-900 mb-4">Feedback Analytics</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <ThumbsUp className="w-5 h-5 text-green-600" />
                  <span className="text-sm text-gray-700">Helpful</span>
                </div>
                <span className="font-semibold text-gray-900">{analytics.feedbackAnalytics.helpful}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <ThumbsDown className="w-5 h-5 text-yellow-600" />
                  <span className="text-sm text-gray-700">Not Helpful</span>
                </div>
                <span className="font-semibold text-gray-900">{analytics.feedbackAnalytics.notHelpful}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Flag className="w-5 h-5 text-red-600" />
                  <span className="text-sm text-gray-700">Reported Issues</span>
                </div>
                <span className="font-semibold text-gray-900">{analytics.feedbackAnalytics.reportIssue}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <span className="text-sm text-gray-700">Helpful Rate</span>
                <span className="font-semibold text-gray-900">{analytics.feedbackAnalytics.helpfulRate}%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-medium text-gray-900 mb-4">Insight Statistics</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Total Insights</p>
                <p className="text-xl font-semibold text-gray-900">{insightStats.totalInsights}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Avg per User</p>
                <p className="text-xl font-semibold text-gray-900">{insightStats.averageInsightsPerUser}</p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <h4 className="text-sm font-medium text-gray-700">By Type</h4>
              {Object.entries(insightStats.insightsByType).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{type.replace(/_/g, ' ')}</span>
                  <span className="font-medium text-gray-900">{count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-medium text-gray-900 mb-4">7-Day Trend</h3>
            <div className="space-y-2">
              {analytics.recentTrend.labels.map((label, idx) => {
                const count = analytics.recentTrend.last7Days[idx] || 0;
                const maxCount = Math.max(...analytics.recentTrend.last7Days, 1);
                const width = Math.round((count / maxCount) * 100);
                return (
                  <div key={label} className="flex items-center gap-3">
                    <span className="text-sm text-gray-500 w-16">{label}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                      <div
                        className="bg-blue-500 h-full rounded-full"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-900 w-8">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-medium text-gray-900 mb-4">Performance Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Failed Requests</p>
              <p className="text-xl font-semibold text-gray-900">{analytics.failedRequests}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Fallback Uses</p>
              <p className="text-xl font-semibold text-gray-900">{analytics.fallbackCount}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Total Tokens</p>
              <p className="text-xl font-semibold text-gray-900">{analytics.totalTokens.toLocaleString()}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Est. Cost</p>
              <p className="text-xl font-semibold text-gray-900">${analytics.estimatedCost.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
