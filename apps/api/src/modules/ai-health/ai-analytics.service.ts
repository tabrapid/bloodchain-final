import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface AIPlatformAnalyticsDto {
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

export interface AIInsightStatsDto {
  totalInsights: number;
  insightsByType: Record<string, number>;
  insightsBySafetyLevel: Record<string, number>;
  averageInsightsPerUser: number;
}

const COST_PER_1K_TOKENS = 0.00015;

@Injectable()
export class AIAnalyticsService {
  private readonly logger = new Logger(AIAnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getPlatformAnalytics(days = 30): Promise<AIPlatformAnalyticsDto> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const logs = await this.prisma.aIRequestLog.findMany({
      where: { createdAt: { gte: since } },
      select: {
        success: true,
        latencyMs: true,
        totalTokens: true,
        insightType: true,
        modelUsed: true,
        safetyLevel: true,
        createdAt: true,
      },
    });

    const total = logs.length;
    const successful = logs.filter((l) => l.success).length;
    const failed = total - successful;
    const totalTokens = logs.reduce((sum, l) => sum + (l.totalTokens || 0), 0);

    const successfulLogs = logs.filter((l) => l.success && l.latencyMs);
    const avgLatency = successfulLogs.length > 0
      ? Math.round(successfulLogs.reduce((sum, l) => sum + (l.latencyMs || 0), 0) / successfulLogs.length)
      : 0;

    const requestsByType: Record<string, number> = {};
    const requestsByModel: Record<string, number> = {};
    let fallbackCount = 0;
    let safetyBlocks = 0;

    for (const log of logs) {
      if (log.insightType) {
        requestsByType[log.insightType] = (requestsByType[log.insightType] || 0) + 1;
      }
      if (log.modelUsed) {
        requestsByModel[log.modelUsed] = (requestsByModel[log.modelUsed] || 0) + 1;
      }
      if (log.modelUsed === 'deterministic') {
        fallbackCount++;
      }
      if (log.safetyLevel === 'OUT_OF_SCOPE' || log.safetyLevel === 'EMERGENCY_REDIRECT') {
        safetyBlocks++;
      }
    }

    const feedbacks = await this.prisma.aIFeedback.findMany({
      where: { createdAt: { gte: since } },
      select: { type: true },
    });

    const feedbackHelpful = feedbacks.filter((f: { type: string }) => f.type === 'HELPFUL').length;
    const feedbackNotHelpful = feedbacks.filter((f: { type: string }) => f.type === 'NOT_HELPFUL').length;
    const feedbackReportIssue = feedbacks.filter((f: { type: string }) => f.type === 'REPORT_ISSUE').length;

    const last7Days: number[] = [];
    const labels: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const dayCount = logs.filter((l) => l.createdAt >= date && l.createdAt < nextDate).length;
      last7Days.push(dayCount);
      labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    }

    return {
      totalRequests: total,
      successfulRequests: successful,
      failedRequests: failed,
      successRate: total > 0 ? Math.round((successful / total) * 100) : 0,
      averageLatencyMs: avgLatency,
      totalTokens,
      estimatedCost: Math.round((totalTokens / 1000) * COST_PER_1K_TOKENS * 100) / 100,
      requestsByType,
      requestsByModel,
      fallbackCount,
      safetyBlocks,
      feedbackAnalytics: {
        total: feedbacks.length,
        helpful: feedbackHelpful,
        notHelpful: feedbackNotHelpful,
        reportIssue: feedbackReportIssue,
        helpfulRate: feedbacks.length > 0 ? Math.round((feedbackHelpful / feedbacks.length) * 100) : 0,
      },
      recentTrend: { last7Days, labels },
    };
  }

  async getInsightStats(days = 30): Promise<AIInsightStatsDto> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const insights = await this.prisma.aIInsight.findMany({
      where: { createdAt: { gte: since } },
      select: { type: true, safetyLevel: true, userId: true },
    });

    const total = insights.length;
    const byType: Record<string, number> = {};
    const bySafety: Record<string, number> = {};
    const uniqueUsers = new Set<string>();

    for (const insight of insights) {
      byType[insight.type] = (byType[insight.type] || 0) + 1;
      bySafety[insight.safetyLevel] = (bySafety[insight.safetyLevel] || 0) + 1;
      uniqueUsers.add(insight.userId);
    }

    return {
      totalInsights: total,
      insightsByType: byType,
      insightsBySafetyLevel: bySafety,
      averageInsightsPerUser: uniqueUsers.size > 0 ? Math.round(total / uniqueUsers.size * 10) / 10 : 0,
    };
  }
}
