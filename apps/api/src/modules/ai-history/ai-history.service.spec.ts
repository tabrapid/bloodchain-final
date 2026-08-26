import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AIInsightStatus, AISafetyLevel } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AIInsightHistoryService } from './ai-history.service';

function makeRow(overrides: Record<string, any> = {}) {
  return {
    id: 'insight-1',
    userId: 'user-1',
    type: 'HEALTH_SUMMARY',
    status: AIInsightStatus.COMPLETED,
    title: 'Summary',
    summary: 'You are healthy',
    observations: ['obs-1'],
    dataPoints: [],
    caveats: ['not medical advice'],
    questionsForProfessional: [],
    safetyLevel: AISafetyLevel.SAFE_INFORMATIONAL,
    dataVersion: 'v1',
    dataReferences: [],
    sourceType: 'donation',
    sourceId: 'donation-1',
    errorMessage: null,
    generatedAt: new Date('2026-01-01'),
    expiresAt: new Date('2026-02-01'),
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('AIInsightHistoryService', () => {
  let service: AIInsightHistoryService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      aIInsight: {
        create: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AIInsightHistoryService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<AIInsightHistoryService>(AIInsightHistoryService);
  });

  describe('createInsight', () => {
    it('defaults status to PENDING and safetyLevel to SAFE_INFORMATIONAL when omitted', async () => {
      prisma.aIInsight.create.mockResolvedValue(makeRow({ status: AIInsightStatus.PENDING }));

      await service.createInsight({ userId: 'user-1', type: 'HEALTH_SUMMARY' as any });

      expect(prisma.aIInsight.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: AIInsightStatus.PENDING,
          safetyLevel: AISafetyLevel.SAFE_INFORMATIONAL,
          observations: [],
          dataPoints: [],
          caveats: [],
          questionsForProfessional: [],
          dataReferences: [],
        }),
      });
    });

    it('maps the created row into a StoredInsight', async () => {
      prisma.aIInsight.create.mockResolvedValue(makeRow());

      const result = await service.createInsight({ userId: 'user-1', type: 'HEALTH_SUMMARY' as any });

      expect(result).toEqual(expect.objectContaining({ id: 'insight-1', summary: 'You are healthy' }));
    });
  });

  describe('updateInsight', () => {
    it('passes only the given fields through to the update call', async () => {
      prisma.aIInsight.update.mockResolvedValue(makeRow({ status: AIInsightStatus.COMPLETED }));

      await service.updateInsight('insight-1', { status: AIInsightStatus.COMPLETED });

      expect(prisma.aIInsight.update).toHaveBeenCalledWith({
        where: { id: 'insight-1' },
        data: expect.objectContaining({ status: AIInsightStatus.COMPLETED }),
      });
    });
  });

  describe('getInsight', () => {
    it('scopes the lookup to both id and userId', async () => {
      prisma.aIInsight.findFirst.mockResolvedValue(makeRow());

      await service.getInsight('insight-1', 'user-1');

      expect(prisma.aIInsight.findFirst).toHaveBeenCalledWith({
        where: { id: 'insight-1', userId: 'user-1' },
      });
    });

    it('throws NotFoundException when no matching row exists (wrong user or wrong id)', async () => {
      prisma.aIInsight.findFirst.mockResolvedValue(null);

      await expect(service.getInsight('insight-1', 'other-user')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUserInsights', () => {
    it('defaults to limit 20 / offset 0 and returns the total count', async () => {
      prisma.aIInsight.findMany.mockResolvedValue([makeRow()]);
      prisma.aIInsight.count.mockResolvedValue(1);

      const result = await service.getUserInsights('user-1');

      expect(prisma.aIInsight.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1' }, take: 20, skip: 0 }),
      );
      expect(result.total).toBe(1);
      expect(result.insights).toHaveLength(1);
    });

    it('adds type/status filters only when given', async () => {
      prisma.aIInsight.findMany.mockResolvedValue([]);
      prisma.aIInsight.count.mockResolvedValue(0);

      await service.getUserInsights('user-1', { type: 'HEALTH_SUMMARY' as any, status: AIInsightStatus.COMPLETED });

      expect(prisma.aIInsight.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', type: 'HEALTH_SUMMARY', status: AIInsightStatus.COMPLETED },
        }),
      );
    });
  });

  describe('getInsightsBySource', () => {
    it('scopes the lookup to userId, sourceType, and sourceId', async () => {
      prisma.aIInsight.findMany.mockResolvedValue([makeRow()]);

      const result = await service.getInsightsBySource('user-1', 'donation', 'donation-1');

      expect(prisma.aIInsight.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1', sourceType: 'donation', sourceId: 'donation-1' } }),
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('deleteInsight', () => {
    it('throws NotFoundException when the insight does not belong to the user', async () => {
      prisma.aIInsight.findFirst.mockResolvedValue(null);

      await expect(service.deleteInsight('insight-1', 'other-user')).rejects.toThrow(NotFoundException);
      expect(prisma.aIInsight.delete).not.toHaveBeenCalled();
    });

    it('deletes the insight when it belongs to the user', async () => {
      prisma.aIInsight.findFirst.mockResolvedValue(makeRow());
      prisma.aIInsight.delete.mockResolvedValue({});

      await service.deleteInsight('insight-1', 'user-1');

      expect(prisma.aIInsight.delete).toHaveBeenCalledWith({ where: { id: 'insight-1' } });
    });
  });

  describe('deleteExpiredInsights', () => {
    it('deletes insights with a non-null expiresAt in the past and returns the count', async () => {
      prisma.aIInsight.deleteMany.mockResolvedValue({ count: 5 });

      const result = await service.deleteExpiredInsights();

      expect(result).toBe(5);
      expect(prisma.aIInsight.deleteMany).toHaveBeenCalledWith({
        where: { expiresAt: { not: null, lt: expect.any(Date) } },
      });
    });
  });

  describe('insightToResponseDto', () => {
    it('falls back to default title/summary/caveats when the stored insight lacks them', async () => {
      const bare: any = { id: 'insight-1', createdAt: new Date('2026-01-01') };

      const dto = await service.insightToResponseDto(bare);

      expect(dto.title).toBe('Insight');
      expect(dto.summary).toBe('');
      expect(dto.caveats).toEqual(['AI-generated informational content. Not a medical diagnosis.']);
    });

    it('uses generatedAt when present, falling back to createdAt otherwise', async () => {
      prisma.aIInsight.create.mockResolvedValue(makeRow({ generatedAt: null, createdAt: new Date('2026-03-01') }));
      const insight = await service.createInsight({ userId: 'user-1', type: 'HEALTH_SUMMARY' as any });

      const dto = await service.insightToResponseDto(insight);

      expect(dto.generatedAt).toBe(new Date('2026-03-01').toISOString());
    });
  });
});
