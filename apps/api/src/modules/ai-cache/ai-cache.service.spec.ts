import { Test, TestingModule } from '@nestjs/testing';
import { AIInsightType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AICacheService } from './ai-cache.service';

describe('AICacheService', () => {
  let service: AICacheService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      aIInsightCache: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AICacheService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<AICacheService>(AICacheService);
  });

  describe('get', () => {
    it('returns null when no cache entry exists', async () => {
      prisma.aIInsightCache.findUnique.mockResolvedValue(null);

      const result = await service.get('user-1', AIInsightType.HEALTH_SUMMARY, 'v1');

      expect(result).toBeNull();
      expect(prisma.aIInsightCache.findUnique).toHaveBeenCalledWith({
        where: { cacheKey: 'user-1:HEALTH_SUMMARY:v1' },
      });
    });

    it('returns the cached insight when it has not expired', async () => {
      const expiresAt = new Date(Date.now() + 60_000);
      prisma.aIInsightCache.findUnique.mockResolvedValue({
        cacheKey: 'user-1:HEALTH_SUMMARY:v1',
        response: { summary: 'ok' },
        dataVersion: 'v1',
        expiresAt,
      });

      const result = await service.get('user-1', AIInsightType.HEALTH_SUMMARY, 'v1');

      expect(result).toEqual({ insight: { summary: 'ok' }, dataVersion: 'v1', expiresAt });
      expect(prisma.aIInsightCache.delete).not.toHaveBeenCalled();
    });

    it('deletes and returns null when the cache entry has expired', async () => {
      const expiresAt = new Date(Date.now() - 60_000);
      prisma.aIInsightCache.findUnique.mockResolvedValue({
        cacheKey: 'user-1:HEALTH_SUMMARY:v1',
        response: { summary: 'stale' },
        dataVersion: 'v1',
        expiresAt,
      });

      const result = await service.get('user-1', AIInsightType.HEALTH_SUMMARY, 'v1');

      expect(result).toBeNull();
      expect(prisma.aIInsightCache.delete).toHaveBeenCalledWith({
        where: { cacheKey: 'user-1:HEALTH_SUMMARY:v1' },
      });
    });
  });

  describe('set', () => {
    it('upserts using the default 24h TTL when none is given', async () => {
      prisma.aIInsightCache.upsert.mockResolvedValue({});
      const before = Date.now();

      await service.set('user-1', AIInsightType.HEALTH_SUMMARY, 'v1', { summary: 'ok' } as any);

      const call = prisma.aIInsightCache.upsert.mock.calls[0][0];
      expect(call.where).toEqual({ cacheKey: 'user-1:HEALTH_SUMMARY:v1' });
      expect(call.create).toEqual(
        expect.objectContaining({
          cacheKey: 'user-1:HEALTH_SUMMARY:v1',
          userId: 'user-1',
          insightType: AIInsightType.HEALTH_SUMMARY,
          dataVersion: 'v1',
          response: { summary: 'ok' },
        }),
      );
      const ttlMs = call.create.expiresAt.getTime() - before;
      expect(ttlMs).toBeGreaterThan(23 * 60 * 60 * 1000);
      expect(ttlMs).toBeLessThanOrEqual(24 * 60 * 60 * 1000 + 1000);
    });

    it('honors a custom TTL when provided', async () => {
      prisma.aIInsightCache.upsert.mockResolvedValue({});
      const before = Date.now();

      await service.set('user-1', AIInsightType.HEALTH_SUMMARY, 'v1', { summary: 'ok' } as any, 5_000);

      const call = prisma.aIInsightCache.upsert.mock.calls[0][0];
      const ttlMs = call.create.expiresAt.getTime() - before;
      expect(ttlMs).toBeGreaterThan(0);
      expect(ttlMs).toBeLessThanOrEqual(5_000 + 1000);
    });

    it('swallows a write failure instead of throwing', async () => {
      prisma.aIInsightCache.upsert.mockRejectedValue(new Error('db down'));

      await expect(
        service.set('user-1', AIInsightType.HEALTH_SUMMARY, 'v1', { summary: 'ok' } as any),
      ).resolves.toBeUndefined();
    });
  });

  describe('delete', () => {
    it('deletes the cache entry by key', async () => {
      prisma.aIInsightCache.delete.mockResolvedValue({});

      await service.delete('user-1:HEALTH_SUMMARY:v1');

      expect(prisma.aIInsightCache.delete).toHaveBeenCalledWith({
        where: { cacheKey: 'user-1:HEALTH_SUMMARY:v1' },
      });
    });

    it('swallows a delete failure instead of throwing', async () => {
      prisma.aIInsightCache.delete.mockRejectedValue(new Error('not found'));

      await expect(service.delete('missing-key')).resolves.toBeUndefined();
    });
  });

  describe('invalidateUserCache', () => {
    it('deletes all cache entries for the user and returns the count', async () => {
      prisma.aIInsightCache.deleteMany.mockResolvedValue({ count: 3 });

      const result = await service.invalidateUserCache('user-1');

      expect(result).toBe(3);
      expect(prisma.aIInsightCache.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
    });

    it('returns 0 instead of throwing when the delete fails', async () => {
      prisma.aIInsightCache.deleteMany.mockRejectedValue(new Error('db down'));

      expect(await service.invalidateUserCache('user-1')).toBe(0);
    });
  });

  describe('cleanupExpired', () => {
    it('deletes all entries whose expiresAt is in the past and returns the count', async () => {
      prisma.aIInsightCache.deleteMany.mockResolvedValue({ count: 7 });

      const result = await service.cleanupExpired();

      expect(result).toBe(7);
      expect(prisma.aIInsightCache.deleteMany).toHaveBeenCalledWith({
        where: { expiresAt: { lt: expect.any(Date) } },
      });
    });

    it('returns 0 instead of throwing when the delete fails', async () => {
      prisma.aIInsightCache.deleteMany.mockRejectedValue(new Error('db down'));

      expect(await service.cleanupExpired()).toBe(0);
    });
  });
});
