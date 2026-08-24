import { Test, TestingModule } from '@nestjs/testing';
import { AIFeedbackService } from './ai-feedback.service';
import { PrismaService } from '../../database/prisma.service';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('AIFeedbackService', () => {
  let service: AIFeedbackService;

  const mockPrisma = {
    aIInsight: { findFirst: jest.fn(), create: jest.fn() },
    aIFeedback: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIFeedbackService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AIFeedbackService>(AIFeedbackService);
    jest.clearAllMocks();
  });

  describe('submitFeedback', () => {
    it('should throw NotFoundException if insight not found', async () => {
      mockPrisma.aIInsight.findFirst.mockResolvedValue(null);

      await expect(
        service.submitFeedback('user1', { insightId: 'nonexistent', type: 'HELPFUL' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if feedback already exists', async () => {
      mockPrisma.aIInsight.findFirst.mockResolvedValue({ id: 'insight1', userId: 'user1' });
      mockPrisma.aIFeedback.findUnique.mockResolvedValue({ id: 'fb1' });

      await expect(
        service.submitFeedback('user1', { insightId: 'insight1', type: 'HELPFUL' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create feedback for valid insight', async () => {
      mockPrisma.aIInsight.findFirst.mockResolvedValue({ id: 'insight1', userId: 'user1' });
      mockPrisma.aIFeedback.findUnique.mockResolvedValue(null);
      mockPrisma.aIFeedback.create.mockResolvedValue({
        id: 'fb1',
        userId: 'user1',
        insightId: 'insight1',
        type: 'HELPFUL',
        reason: null,
        createdAt: new Date(),
      });

      const result = await service.submitFeedback('user1', { insightId: 'insight1', type: 'HELPFUL' });

      expect(result.type).toBe('HELPFUL');
      expect(mockPrisma.aIFeedback.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user1',
            insightId: 'insight1',
            type: 'HELPFUL',
          }),
        }),
      );
    });
  });

  describe('getPlatformFeedbackAnalytics', () => {
    it('should return correct analytics', async () => {
      mockPrisma.aIFeedback.findMany.mockResolvedValue([
        { type: 'HELPFUL' },
        { type: 'HELPFUL' },
        { type: 'NOT_HELPFUL' },
        { type: 'REPORT_ISSUE' },
      ]);

      const result = await service.getPlatformFeedbackAnalytics(30);

      expect(result.totalFeedback).toBe(4);
      expect(result.helpful).toBe(2);
      expect(result.notHelpful).toBe(1);
      expect(result.reportIssue).toBe(1);
      expect(result.helpfulRate).toBe(50);
    });

    it('should handle empty feedback', async () => {
      mockPrisma.aIFeedback.findMany.mockResolvedValue([]);

      const result = await service.getPlatformFeedbackAnalytics(30);

      expect(result.totalFeedback).toBe(0);
      expect(result.helpfulRate).toBe(0);
    });
  });
});
