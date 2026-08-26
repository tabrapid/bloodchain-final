import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { EducationProgressStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { EducationService } from './education.service';

function makeContent(overrides: Record<string, any> = {}) {
  return {
    id: 'content-1',
    type: 'ARTICLE',
    title: 'Why donate blood',
    description: 'desc',
    body: 'body',
    imageUrl: null,
    category: 'basics',
    difficulty: 'BEGINNER',
    xpReward: 50,
    estimatedMinutes: 5,
    isActive: true,
    displayOrder: 0,
    ...overrides,
  };
}

describe('EducationService', () => {
  let service: EducationService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      educationalContent: {
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      educationProgress: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        aggregate: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [EducationService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<EducationService>(EducationService);
  });

  describe('createContent', () => {
    it('defaults difficulty to BEGINNER and xpReward to 0 when omitted', async () => {
      prisma.educationalContent.create.mockResolvedValue(makeContent());

      await service.createContent({ type: 'ARTICLE', title: 'T', description: 'D', body: 'B' } as any);

      expect(prisma.educationalContent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ difficulty: 'BEGINNER', xpReward: 0, isActive: true }),
      });
    });

    it('honors an explicit difficulty and xpReward', async () => {
      prisma.educationalContent.create.mockResolvedValue(makeContent());

      await service.createContent({
        type: 'ARTICLE',
        title: 'T',
        description: 'D',
        body: 'B',
        difficulty: 'ADVANCED',
        xpReward: 200,
      } as any);

      expect(prisma.educationalContent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ difficulty: 'ADVANCED', xpReward: 200 }),
      });
    });
  });

  describe('updateContent', () => {
    it('throws NotFoundException when the content does not exist', async () => {
      prisma.educationalContent.findUnique.mockResolvedValue(null);

      await expect(service.updateContent('missing', {} as any)).rejects.toThrow(NotFoundException);
      expect(prisma.educationalContent.update).not.toHaveBeenCalled();
    });

    it('updates the content when it exists', async () => {
      prisma.educationalContent.findUnique.mockResolvedValue(makeContent());
      prisma.educationalContent.update.mockResolvedValue(makeContent({ title: 'New title' }));

      const result = await service.updateContent('content-1', { title: 'New title' } as any);

      expect(result.title).toBe('New title');
    });
  });

  describe('getContent', () => {
    it('always filters to isActive content', async () => {
      prisma.educationalContent.findMany.mockResolvedValue([]);
      prisma.educationalContent.count.mockResolvedValue(0);

      await service.getContent(1, 20);

      expect(prisma.educationalContent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true } }),
      );
    });

    it('adds type/category filters only when given', async () => {
      prisma.educationalContent.findMany.mockResolvedValue([]);
      prisma.educationalContent.count.mockResolvedValue(0);

      await service.getContent(1, 20, 'ARTICLE' as any, 'basics');

      expect(prisma.educationalContent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true, type: 'ARTICLE', category: 'basics' } }),
      );
    });

    it('paginates using skip/take derived from page and limit', async () => {
      prisma.educationalContent.findMany.mockResolvedValue([]);
      prisma.educationalContent.count.mockResolvedValue(0);

      await service.getContent(3, 10);

      expect(prisma.educationalContent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });
  });

  describe('getContentById', () => {
    it('throws NotFoundException when missing', async () => {
      prisma.educationalContent.findUnique.mockResolvedValue(null);

      await expect(service.getContentById('missing')).rejects.toThrow(NotFoundException);
    });

    it('returns the content when found', async () => {
      prisma.educationalContent.findUnique.mockResolvedValue(makeContent());

      expect(await service.getContentById('content-1')).toEqual(makeContent());
    });
  });

  describe('startContent', () => {
    it('throws NotFoundException when the content does not exist', async () => {
      prisma.educationalContent.findUnique.mockResolvedValue(null);

      await expect(service.startContent('user-1', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when the content is inactive', async () => {
      prisma.educationalContent.findUnique.mockResolvedValue(makeContent({ isActive: false }));

      await expect(service.startContent('user-1', 'content-1')).rejects.toThrow(BadRequestException);
    });

    it('returns the existing progress row instead of creating a duplicate', async () => {
      prisma.educationalContent.findUnique.mockResolvedValue(makeContent());
      const existing = { userId: 'user-1', contentId: 'content-1', status: EducationProgressStatus.STARTED };
      prisma.educationProgress.findUnique.mockResolvedValue(existing);

      const result = await service.startContent('user-1', 'content-1');

      expect(result).toBe(existing);
      expect(prisma.educationProgress.create).not.toHaveBeenCalled();
    });

    it('creates a new STARTED progress row on first start', async () => {
      prisma.educationalContent.findUnique.mockResolvedValue(makeContent());
      prisma.educationProgress.findUnique.mockResolvedValue(null);
      prisma.educationProgress.create.mockResolvedValue({});

      await service.startContent('user-1', 'content-1');

      expect(prisma.educationProgress.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', contentId: 'content-1', status: EducationProgressStatus.STARTED },
      });
    });
  });

  describe('completeContent', () => {
    it('throws NotFoundException when the content does not exist', async () => {
      prisma.educationalContent.findUnique.mockResolvedValue(null);

      await expect(service.completeContent('user-1', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when the user never started the content', async () => {
      prisma.educationalContent.findUnique.mockResolvedValue(makeContent());
      prisma.educationProgress.findUnique.mockResolvedValue(null);

      await expect(service.completeContent('user-1', 'content-1')).rejects.toThrow(BadRequestException);
    });

    it('is idempotent: returns the existing row without re-awarding XP when already completed', async () => {
      prisma.educationalContent.findUnique.mockResolvedValue(makeContent());
      const existing = { status: EducationProgressStatus.COMPLETED, xpAwarded: 50 };
      prisma.educationProgress.findUnique.mockResolvedValue(existing);

      const result = await service.completeContent('user-1', 'content-1');

      expect(result).toBe(existing);
      expect(prisma.educationProgress.update).not.toHaveBeenCalled();
    });

    it('marks progress COMPLETED and awards the content xpReward on first completion', async () => {
      prisma.educationalContent.findUnique.mockResolvedValue(makeContent({ xpReward: 75 }));
      prisma.educationProgress.findUnique.mockResolvedValue({ status: EducationProgressStatus.STARTED });
      prisma.educationProgress.update.mockResolvedValue({});

      await service.completeContent('user-1', 'content-1');

      expect(prisma.educationProgress.update).toHaveBeenCalledWith({
        where: { userId_contentId: { userId: 'user-1', contentId: 'content-1' } },
        data: expect.objectContaining({
          status: EducationProgressStatus.COMPLETED,
          xpAwarded: 75,
          completedAt: expect.any(Date),
        }),
      });
    });
  });

  describe('getUserProgress', () => {
    it('paginates and includes the related content', async () => {
      prisma.educationProgress.findMany.mockResolvedValue([]);
      prisma.educationProgress.count.mockResolvedValue(0);

      await service.getUserProgress('user-1', 2, 5);

      expect(prisma.educationProgress.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1' }, include: { content: true }, skip: 5, take: 5 }),
      );
    });
  });

  describe('getUserStats', () => {
    it('sums xpAwarded across completed items only, defaulting to 0 when null', async () => {
      prisma.educationProgress.count.mockResolvedValueOnce(10).mockResolvedValueOnce(4);
      prisma.educationProgress.aggregate.mockResolvedValue({ _sum: { xpAwarded: null } });

      const result = await service.getUserStats('user-1');

      expect(result).toEqual({ totalStarted: 10, totalCompleted: 4, totalXpEarned: 0 });
    });

    it('reflects a real xp sum when present', async () => {
      prisma.educationProgress.count.mockResolvedValueOnce(10).mockResolvedValueOnce(4);
      prisma.educationProgress.aggregate.mockResolvedValue({ _sum: { xpAwarded: 250 } });

      const result = await service.getUserStats('user-1');

      expect(result.totalXpEarned).toBe(250);
    });
  });
});
