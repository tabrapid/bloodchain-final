import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AIInsightType, AISafetyLevel } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

export interface AIRequestLogInput {
  userId?: string;
  insightType?: AIInsightType;
  providerName: string;
  modelUsed?: string;
  promptVersion?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  latencyMs?: number;
  success: boolean;
  errorMessage?: string;
  safetyLevel?: AISafetyLevel;
  dataVersion?: string;
  requestFingerprint?: string;
}

@Injectable()
export class AIRequestLogService {
  private readonly logger = new Logger(AIRequestLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async logRequest(input: AIRequestLogInput): Promise<string> {
    const requestId = uuidv4();

    try {
      await this.prisma.aIRequestLog.create({
        data: {
          requestId,
          userId: input.userId,
          insightType: input.insightType,
          providerName: input.providerName,
          modelUsed: input.modelUsed,
          promptVersion: input.promptVersion,
          promptTokens: input.promptTokens,
          completionTokens: input.completionTokens,
          totalTokens: input.totalTokens,
          latencyMs: input.latencyMs,
          success: input.success,
          errorMessage: input.errorMessage,
          safetyLevel: input.safetyLevel,
          dataVersion: input.dataVersion,
          requestFingerprint: input.requestFingerprint,
        },
      });

      this.logger.debug(`Logged AI request: ${requestId}`);
      return requestId;
    } catch (error) {
      this.logger.error(`Failed to log AI request: ${error}`);
      return requestId;
    }
  }

  async getUserRequestStats(
    userId: string,
    days: number = 30,
  ): Promise<{
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    totalTokens: number;
    averageLatencyMs: number;
  }> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const logs = await this.prisma.aIRequestLog.findMany({
      where: {
        userId,
        createdAt: { gte: since },
      },
      select: {
        success: true,
        totalTokens: true,
        latencyMs: true,
      },
    });

    const successfulRequests = logs.filter((l) => l.success).length;
    const failedRequests = logs.filter((l) => !l.success).length;
    const totalTokens = logs.reduce((sum, l) => sum + (l.totalTokens || 0), 0);
    const successfulLogs = logs.filter((l) => l.success && l.latencyMs);
    const averageLatencyMs =
      successfulLogs.length > 0
        ? Math.round(successfulLogs.reduce((sum, l) => sum + (l.latencyMs || 0), 0) / successfulLogs.length)
        : 0;

    return {
      totalRequests: logs.length,
      successfulRequests,
      failedRequests,
      totalTokens,
      averageLatencyMs,
    };
  }

  async getPlatformRequestStats(
    days: number = 30,
  ): Promise<{
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    totalTokens: number;
    averageLatencyMs: number;
    requestsByType: Record<string, number>;
  }> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const logs = await this.prisma.aIRequestLog.findMany({
      where: {
        createdAt: { gte: since },
      },
      select: {
        success: true,
        totalTokens: true,
        latencyMs: true,
        insightType: true,
      },
    });

    const successfulRequests = logs.filter((l) => l.success).length;
    const failedRequests = logs.filter((l) => !l.success).length;
    const totalTokens = logs.reduce((sum, l) => sum + (l.totalTokens || 0), 0);
    const successfulLogs = logs.filter((l) => l.success && l.latencyMs);
    const averageLatencyMs =
      successfulLogs.length > 0
        ? Math.round(successfulLogs.reduce((sum, l) => sum + (l.latencyMs || 0), 0) / successfulLogs.length)
        : 0;

    const requestsByType: Record<string, number> = {};
    for (const log of logs) {
      if (log.insightType) {
        requestsByType[log.insightType] = (requestsByType[log.insightType] || 0) + 1;
      }
    }

    return {
      totalRequests: logs.length,
      successfulRequests,
      failedRequests,
      totalTokens,
      averageLatencyMs,
      requestsByType,
    };
  }

  async cleanupOldLogs(daysToKeep: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.prisma.aIRequestLog.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });

    this.logger.log(`Cleaned up ${result.count} old AI request logs`);
    return result.count;
  }
}
