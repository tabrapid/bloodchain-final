import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AIInsightType } from '@prisma/client';
import { AiInsightResponseDto } from '../ai-health/dto';

export interface CachedInsight {
  insight: AiInsightResponseDto;
  dataVersion: string;
  expiresAt: Date;
}

@Injectable()
export class AICacheService {
  private readonly logger = new Logger(AICacheService.name);
  private readonly DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  constructor(private readonly prisma: PrismaService) {}

  async get(
    userId: string,
    insightType: AIInsightType,
    dataVersion: string,
  ): Promise<CachedInsight | null> {
    const cacheKey = this.buildCacheKey(userId, insightType, dataVersion);

    const cached = await this.prisma.aIInsightCache.findUnique({
      where: { cacheKey },
    });

    if (!cached) {
      return null;
    }

    // Check if expired
    if (new Date() > cached.expiresAt) {
      await this.delete(cacheKey);
      return null;
    }

    return {
      insight: cached.response as unknown as AiInsightResponseDto,
      dataVersion: cached.dataVersion,
      expiresAt: cached.expiresAt,
    };
  }

  async set(
    userId: string,
    insightType: AIInsightType,
    dataVersion: string,
    insight: AiInsightResponseDto,
    ttlMs?: number,
  ): Promise<void> {
    const cacheKey = this.buildCacheKey(userId, insightType, dataVersion);
    const expiresAt = new Date(Date.now() + (ttlMs || this.DEFAULT_TTL_MS));

    try {
      await this.prisma.aIInsightCache.upsert({
        where: { cacheKey },
        update: {
          response: insight as any,
          dataVersion,
          expiresAt,
        },
        create: {
          cacheKey,
          userId,
          insightType,
          dataVersion,
          response: insight as any,
          expiresAt,
        },
      });

      this.logger.debug(`Cached insight for ${cacheKey}`);
    } catch (error) {
      this.logger.error(`Failed to cache insight: ${error}`);
    }
  }

  async delete(cacheKey: string): Promise<void> {
    try {
      await this.prisma.aIInsightCache.delete({
        where: { cacheKey },
      });
      this.logger.debug(`Deleted cached insight: ${cacheKey}`);
    } catch (error) {
      this.logger.error(`Failed to delete cached insight: ${error}`);
    }
  }

  async invalidateUserCache(userId: string): Promise<number> {
    try {
      const result = await this.prisma.aIInsightCache.deleteMany({
        where: { userId },
      });

      this.logger.log(`Invalidated ${result.count} cached insights for user ${userId}`);
      return result.count;
    } catch (error) {
      this.logger.error(`Failed to invalidate user cache: ${error}`);
      return 0;
    }
  }

  async cleanupExpired(): Promise<number> {
    try {
      const now = new Date();
      const result = await this.prisma.aIInsightCache.deleteMany({
        where: {
          expiresAt: { lt: now },
        },
      });

      this.logger.log(`Cleaned up ${result.count} expired cached insights`);
      return result.count;
    } catch (error) {
      this.logger.error(`Failed to cleanup expired cache: ${error}`);
      return 0;
    }
  }

  private buildCacheKey(
    userId: string,
    insightType: AIInsightType,
    dataVersion: string,
  ): string {
    return `${userId}:${insightType}:${dataVersion}`;
  }
}
