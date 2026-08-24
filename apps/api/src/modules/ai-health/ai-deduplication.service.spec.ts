import { Test, TestingModule } from '@nestjs/testing';
import { AIDeduplicationService } from './ai-deduplication.service';
import { PrismaService } from '../../database/prisma.service';
import { AIInsightType } from '@prisma/client';

describe('AIDeduplicationService', () => {
  let service: AIDeduplicationService;

  const mockPrisma = {
    aIRequestLog: { findFirst: jest.fn() },
    aIInsight: { findFirst: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIDeduplicationService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AIDeduplicationService>(AIDeduplicationService);
    jest.clearAllMocks();
  });

  describe('generateFingerprint', () => {
    it('should generate consistent fingerprints for identical inputs', () => {
      const fp1 = service.generateFingerprint('user1', AIInsightType.TREND_SUMMARY, { parameterCode: 'HGB' }, 'health-trend-analysis-v1');
      const fp2 = service.generateFingerprint('user1', AIInsightType.TREND_SUMMARY, { parameterCode: 'HGB' }, 'health-trend-analysis-v1');
      expect(fp1).toBe(fp2);
      expect(fp1.length).toBe(32);
    });

    it('should generate different fingerprints for different users', () => {
      const fp1 = service.generateFingerprint('user1', AIInsightType.TREND_SUMMARY, { parameterCode: 'HGB' }, 'health-trend-analysis-v1');
      const fp2 = service.generateFingerprint('user2', AIInsightType.TREND_SUMMARY, { parameterCode: 'HGB' }, 'health-trend-analysis-v1');
      expect(fp1).not.toBe(fp2);
    });

    it('should generate different fingerprints for different insight types', () => {
      const fp1 = service.generateFingerprint('user1', AIInsightType.TREND_SUMMARY, { parameterCode: 'HGB' }, 'health-trend-analysis-v1');
      const fp2 = service.generateFingerprint('user1', AIInsightType.RESULT_EXPLANATION, { resultId: 'res1' }, 'health-test-analysis-v1');
      expect(fp1).not.toBe(fp2);
    });

    it('should generate different fingerprints for different prompt versions', () => {
      const fp1 = service.generateFingerprint('user1', AIInsightType.TREND_SUMMARY, { parameterCode: 'HGB' }, 'health-trend-analysis-v1');
      const fp2 = service.generateFingerprint('user1', AIInsightType.TREND_SUMMARY, { parameterCode: 'HGB' }, 'health-trend-analysis-v2');
      expect(fp1).not.toBe(fp2);
    });

    it('should generate consistent fingerprints regardless of context key order', () => {
      const fp1 = service.generateFingerprint('user1', AIInsightType.TREND_SUMMARY, { b: '2', a: '1' }, 'v1');
      const fp2 = service.generateFingerprint('user1', AIInsightType.TREND_SUMMARY, { a: '1', b: '2' }, 'v1');
      expect(fp1).toBe(fp2);
    });
  });

  describe('checkDuplicate', () => {
    it('should return isDuplicate false when no recent log exists', async () => {
      mockPrisma.aIRequestLog.findFirst.mockResolvedValue(null);

      const result = await service.checkDuplicate('test-fingerprint');

      expect(result.isDuplicate).toBe(false);
      expect(result.fingerprint).toBe('test-fingerprint');
    });

    it('should return isDuplicate true when recent successful log exists', async () => {
      mockPrisma.aIRequestLog.findFirst.mockResolvedValue({
        id: 'log1',
        userId: 'user1',
        success: true,
        insightType: AIInsightType.TREND_SUMMARY,
      });
      mockPrisma.aIInsight.findFirst.mockResolvedValue({
        id: 'insight1',
        userId: 'user1',
        type: AIInsightType.TREND_SUMMARY,
        summary: 'Cached insight',
      });

      const result = await service.checkDuplicate('test-fingerprint');

      expect(result.isDuplicate).toBe(true);
      expect(result.cachedInsight).toBeTruthy();
    });
  });

  describe('inflightDedup', () => {
    it('should return existing promise for same key within window', async () => {
      const fn = jest.fn().mockResolvedValue('result');

      const p1 = service.inflightDedup('key1', fn);
      const p2 = service.inflightDedup('key1', fn);

      await p1;
      await p2;
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should call function for different keys', async () => {
      const fn = jest.fn().mockResolvedValue('result');

      await service.inflightDedup('key1', fn);
      await service.inflightDedup('key2', fn);

      expect(fn).toHaveBeenCalledTimes(2);
    });
  });
});
