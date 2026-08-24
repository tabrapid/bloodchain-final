import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { AIInsightType } from '@prisma/client';

export interface DedupResult {
  isDuplicate: boolean;
  cachedInsight?: any;
  fingerprint: string;
}

@Injectable()
export class AIDeduplicationService {
  private readonly logger = new Logger(AIDeduplicationService.name);
  private readonly requestCache = new Map<string, { timestamp: number; promise: Promise<any> }>();
  private readonly DEDUPE_WINDOW_MS = 5000;

  constructor(private readonly prisma: PrismaService) {}

  generateFingerprint(
    userId: string,
    insightType: AIInsightType,
    contextData: Record<string, unknown>,
    promptVersion: string,
  ): string {
    const sortedContext = Object.keys(contextData)
      .sort()
      .map((key) => `${key}:${String(contextData[key])}`)
      .join('|');

    const raw = `${userId}:${insightType}:${sortedContext}:${promptVersion}`;
    return createHash('sha256').update(raw).digest('hex').slice(0, 32);
  }

  async checkDuplicate(fingerprint: string, windowMs = 60000): Promise<DedupResult> {
    const recentLog = await this.prisma.aIRequestLog.findFirst({
      where: {
        requestFingerprint: fingerprint,
        success: true,
        createdAt: {
          gte: new Date(Date.now() - windowMs),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (recentLog) {
      this.logger.debug(`Duplicate request detected: ${fingerprint.slice(0, 8)}...`);

      const recentInsight = await this.prisma.aIInsight.findFirst({
        where: {
          userId: recentLog.userId!,
          sourceType: recentLog.insightType ? String(recentLog.insightType) : undefined,
          createdAt: {
            gte: new Date(Date.now() - windowMs),
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return {
        isDuplicate: true,
        cachedInsight: recentInsight,
        fingerprint,
      };
    }

    return { isDuplicate: false, fingerprint };
  }

  async inflightDedup(
    key: string,
    fn: () => Promise<any>,
  ): Promise<any> {
    const existing = this.requestCache.get(key);

    if (existing && Date.now() - existing.timestamp < this.DEDUPE_WINDOW_MS) {
      this.logger.debug(`Inflight dedup hit: ${key.slice(0, 8)}...`);
      return existing.promise;
    }

    const promise = fn();
    this.requestCache.set(key, { timestamp: Date.now(), promise });

    promise.finally(() => {
      setTimeout(() => {
        this.requestCache.delete(key);
      }, this.DEDUPE_WINDOW_MS * 2);
    });

    return promise;
  }

  clearInflightCache(): void {
    this.requestCache.clear();
  }
}
