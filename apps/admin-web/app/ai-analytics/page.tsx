'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, AlertTriangle, BarChart3, Clock, ThumbsUp, ThumbsDown, Flag, RefreshCw } from 'lucide-react';
import { LoadingState } from '@bloodchain/ui/components';
import { isAuthenticated, me } from '@lib/auth';
import { getAIPatformAnalytics, getAIInsightStats, type AIAnalytics, type AIInsightStats } from '@lib/ai-api';
import {  } from '@lib/status';
import { AppShell } from '../../components/AppShell';
import { useTranslation } from '@bloodchain/ui/i18n';

export default function AIAnalyticsPage() {
  const { t } = useTranslation();
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

  async function loadData(rangeDays = days) {
    try {
      const [analyticsData, insightData] = await Promise.all([
        getAIPatformAnalytics(rangeDays),
        getAIInsightStats(rangeDays),
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
      <AppShell title={t('portal.nav.aiAnalytics')} userName={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : undefined}>
        <LoadingState />
      </AppShell>
    );
  }

  if (!analytics || !insightStats) {
    return (
      <AppShell title={t('portal.nav.aiAnalytics')} userName={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : undefined}>
        <div className="p-6">
          <p className="text-donor-muted">{t('ops.aiAnalytics.unavailable')}</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={t('portal.nav.aiAnalytics')} userName={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : undefined}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-donor-text">{t('ops.aiAnalytics.title')}</h1>
            <p className="text-sm text-donor-muted mt-1">{t('ops.aiAnalytics.subtitle')}</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={days}
              onChange={(e) => {
                const value = Number(e.target.value);
                setDays(value);
                loadData(value);
              }}
              className="bg-donor-elevated text-donor-text px-3 py-2 rounded-lg text-sm font-medium"
            >
              <option value={7}>{t('filters.last7Days')}</option>
              <option value={30}>{t('filters.last30Days')}</option>
              <option value={90}>{t('ops.analytics.last90Days')}</option>
            </select>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 bg-donor-elevated text-donor-text px-4 py-2 rounded-lg text-sm font-medium hover:bg-donor-border/60 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? t('ops.common.refreshing') : t('actions.refresh')}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bc-glass rounded-card p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-donor-secondaryMuted">
                <BarChart3 className="w-6 h-6 text-donor-onSecondaryMuted" />
              </div>
              <div>
                <p className="text-sm text-donor-muted">{t('ops.aiAnalytics.totalRequests')}</p>
                <p className="text-xl font-semibold text-donor-text">{analytics.totalRequests}</p>
              </div>
            </div>
          </div>

          <div className="bc-glass rounded-card p-6">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${analytics.successRate >= 95 ? 'bg-donor-successMuted' : analytics.successRate >= 80 ? 'bg-donor-warningMuted' : 'bg-donor-dangerMuted'}`}>
                <CheckCircle className={`w-6 h-6 ${analytics.successRate >= 95 ? 'text-donor-onSuccessMuted' : analytics.successRate >= 80 ? 'text-donor-onWarningMuted' : 'text-donor-onDangerMuted'}`} />
              </div>
              <div>
                <p className="text-sm text-donor-muted">{t('ops.aiAnalytics.successRate')}</p>
                <p className="text-xl font-semibold text-donor-text">{analytics.successRate}%</p>
              </div>
            </div>
          </div>

          <div className="bc-glass rounded-card p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-donor-aiMuted">
                <Clock className="w-6 h-6 text-donor-onAiMuted" />
              </div>
              <div>
                <p className="text-sm text-donor-muted">{t('ops.analytics.avgLatency')}</p>
                <p className="text-xl font-semibold text-donor-text">{analytics.averageLatencyMs}ms</p>
              </div>
            </div>
          </div>

          <div className="bc-glass rounded-card p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-donor-warningMuted">
                <AlertTriangle className="w-6 h-6 text-donor-onWarningMuted" />
              </div>
              <div>
                <p className="text-sm text-donor-muted">{t('ops.aiAnalytics.safetyBlocks')}</p>
                <p className="text-xl font-semibold text-donor-text">{analytics.safetyBlocks}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bc-glass rounded-card p-6">
            <h3 className="font-medium text-donor-text mb-4">{t('ops.aiAnalytics.requestsByFeature')}</h3>
            <div className="space-y-3">
              {Object.entries(analytics.requestsByType).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between p-3 bg-donor-elevated rounded-lg">
                  <span className="text-sm text-donor-text">{t(`medical.aiInsightTypes.${type}`)}</span>
                  <span className="font-semibold text-donor-text">{count}</span>
                </div>
              ))}
              {Object.keys(analytics.requestsByType).length === 0 && (
                <p className="text-sm text-donor-muted text-center py-4">{t('ops.analytics.noData')}</p>
              )}
            </div>
          </div>

          <div className="bc-glass rounded-card p-6">
            <h3 className="font-medium text-donor-text mb-4">{t('ops.aiAnalytics.feedback')}</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-donor-successMuted rounded-lg">
                <div className="flex items-center gap-3">
                  <ThumbsUp className="w-5 h-5 text-donor-onSuccessMuted" />
                  <span className="text-sm text-donor-text">{t('ops.aiAnalytics.helpful')}</span>
                </div>
                <span className="font-semibold text-donor-text">{analytics.feedbackAnalytics.helpful}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-donor-warningMuted rounded-lg">
                <div className="flex items-center gap-3">
                  <ThumbsDown className="w-5 h-5 text-donor-onWarningMuted" />
                  <span className="text-sm text-donor-text">{t('ops.aiAnalytics.notHelpful')}</span>
                </div>
                <span className="font-semibold text-donor-text">{analytics.feedbackAnalytics.notHelpful}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-donor-dangerMuted rounded-lg">
                <div className="flex items-center gap-3">
                  <Flag className="w-5 h-5 text-donor-onDangerMuted" />
                  <span className="text-sm text-donor-text">{t('ops.aiAnalytics.reportedIssues')}</span>
                </div>
                <span className="font-semibold text-donor-text">{analytics.feedbackAnalytics.reportIssue}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-donor-secondaryMuted rounded-lg">
                <span className="text-sm text-donor-text">{t('ops.aiAnalytics.helpfulRate')}</span>
                <span className="font-semibold text-donor-text">{analytics.feedbackAnalytics.helpfulRate}%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bc-glass rounded-card p-6">
            <h3 className="font-medium text-donor-text mb-4">{t('ops.aiAnalytics.insightStatistics')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-donor-elevated rounded-lg">
                <p className="text-sm text-donor-muted">{t('ops.aiAnalytics.totalInsights')}</p>
                <p className="text-xl font-semibold text-donor-text">{insightStats.totalInsights}</p>
              </div>
              <div className="p-4 bg-donor-elevated rounded-lg">
                <p className="text-sm text-donor-muted">{t('ops.analytics.avgPerUser')}</p>
                <p className="text-xl font-semibold text-donor-text">{insightStats.averageInsightsPerUser}</p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <h4 className="text-sm font-medium text-donor-text">{t('filters.byType')}</h4>
              {Object.entries(insightStats.insightsByType).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between text-sm">
                  <span className="text-donor-muted">{t(`medical.aiInsightTypes.${type}`)}</span>
                  <span className="font-medium text-donor-text">{count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bc-glass rounded-card p-6">
            <h3 className="font-medium text-donor-text mb-4">{t('ops.aiAnalytics.sevenDayTrend')}</h3>
            <div className="space-y-2">
              {analytics.recentTrend.labels.map((label, idx) => {
                const count = analytics.recentTrend.last7Days[idx] || 0;
                const maxCount = Math.max(...analytics.recentTrend.last7Days, 1);
                const width = Math.round((count / maxCount) * 100);
                return (
                  <div key={label} className="flex items-center gap-3">
                    <span className="text-sm text-donor-muted w-16">{label}</span>
                    <div className="flex-1 bg-donor-elevated rounded-full h-4 overflow-hidden">
                      <div
                        className="bg-donor-secondary h-full rounded-full"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-donor-text w-8">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="bc-glass rounded-card p-6">
          <h3 className="font-medium text-donor-text mb-4">{t('ops.aiAnalytics.performanceSummary')}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-donor-elevated rounded-lg">
              <p className="text-sm text-donor-muted">{t('ops.aiAnalytics.failedRequests')}</p>
              <p className="text-xl font-semibold text-donor-text">{analytics.failedRequests}</p>
            </div>
            <div className="p-4 bg-donor-elevated rounded-lg">
              <p className="text-sm text-donor-muted">{t('ops.aiAnalytics.fallbackUses')}</p>
              <p className="text-xl font-semibold text-donor-text">{analytics.fallbackCount}</p>
            </div>
            <div className="p-4 bg-donor-elevated rounded-lg">
              <p className="text-sm text-donor-muted">{t('ops.aiAnalytics.totalTokens')}</p>
              <p className="text-xl font-semibold text-donor-text">{analytics.totalTokens.toLocaleString()}</p>
            </div>
            <div className="p-4 bg-donor-elevated rounded-lg">
              <p className="text-sm text-donor-muted">{t('ops.analytics.estCost')}</p>
              <p className="text-xl font-semibold text-donor-text">${analytics.estimatedCost.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
