import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { AIRequestLogService } from './ai-logging.service';

describe('AIRequestLogService', () => {
  let service: AIRequestLogService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      aIRequestLog: {
        create: jest.fn(),
        findMany: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AIRequestLogService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<AIRequestLogService>(AIRequestLogService);
  });

  describe('logRequest', () => {
    it('writes the request through to the DB with a generated requestId', async () => {
      prisma.aIRequestLog.create.mockResolvedValue({});

      const requestId = await service.logRequest({
        userId: 'user-1',
        providerName: 'anthropic',
        success: true,
      });

      expect(requestId).toMatch(/^[0-9a-f-]{36}$/);
      expect(prisma.aIRequestLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          requestId,
          userId: 'user-1',
          providerName: 'anthropic',
          success: true,
        }),
      });
    });

    it('returns a requestId even when the write fails, instead of throwing', async () => {
      prisma.aIRequestLog.create.mockRejectedValue(new Error('db down'));

      const requestId = await service.logRequest({ providerName: 'anthropic', success: false });

      expect(requestId).toMatch(/^[0-9a-f-]{36}$/);
    });
  });

  describe('getUserRequestStats', () => {
    it('aggregates totals, success/failure counts, tokens, and average latency for successful requests only', async () => {
      prisma.aIRequestLog.findMany.mockResolvedValue([
        { success: true, totalTokens: 100, latencyMs: 200 },
        { success: true, totalTokens: 50, latencyMs: 400 },
        { success: false, totalTokens: 10, latencyMs: 1000 },
      ]);

      const result = await service.getUserRequestStats('user-1', 30);

      expect(result).toEqual({
        totalRequests: 3,
        successfulRequests: 2,
        failedRequests: 1,
        totalTokens: 160,
        averageLatencyMs: 300,
      });
    });

    it('returns zeroed stats when there are no requests in the window', async () => {
      prisma.aIRequestLog.findMany.mockResolvedValue([]);

      const result = await service.getUserRequestStats('user-1');

      expect(result).toEqual({
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        totalTokens: 0,
        averageLatencyMs: 0,
      });
    });

    it('scopes the query to the given user and lookback window', async () => {
      prisma.aIRequestLog.findMany.mockResolvedValue([]);

      await service.getUserRequestStats('user-1', 7);

      const call = prisma.aIRequestLog.findMany.mock.calls[0][0];
      expect(call.where.userId).toBe('user-1');
      expect(call.where.createdAt.gte).toBeInstanceOf(Date);
    });
  });

  describe('getPlatformRequestStats', () => {
    it('aggregates platform-wide stats and buckets requests by insight type', async () => {
      prisma.aIRequestLog.findMany.mockResolvedValue([
        { success: true, totalTokens: 100, latencyMs: 200, insightType: 'HEALTH_SUMMARY' },
        { success: true, totalTokens: 50, latencyMs: 400, insightType: 'HEALTH_SUMMARY' },
        { success: false, totalTokens: 10, latencyMs: 1000, insightType: 'RISK_FLAG' },
      ]);

      const result = await service.getPlatformRequestStats(30);

      expect(result).toEqual({
        totalRequests: 3,
        successfulRequests: 2,
        failedRequests: 1,
        totalTokens: 160,
        averageLatencyMs: 300,
        requestsByType: { HEALTH_SUMMARY: 2, RISK_FLAG: 1 },
      });
    });

    it('is not scoped to any single user', async () => {
      prisma.aIRequestLog.findMany.mockResolvedValue([]);

      await service.getPlatformRequestStats();

      const call = prisma.aIRequestLog.findMany.mock.calls[0][0];
      expect(call.where.userId).toBeUndefined();
    });
  });

  describe('cleanupOldLogs', () => {
    it('deletes logs older than the retention window and returns the count', async () => {
      prisma.aIRequestLog.deleteMany.mockResolvedValue({ count: 12 });

      const result = await service.cleanupOldLogs(90);

      expect(result).toBe(12);
      const call = prisma.aIRequestLog.deleteMany.mock.calls[0][0];
      expect(call.where.createdAt.lt).toBeInstanceOf(Date);
    });
  });
});
