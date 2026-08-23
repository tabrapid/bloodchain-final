import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { EducationContentType, EducationProgressStatus } from '@prisma/client';
import { CreateEducationalContentDto, UpdateEducationalContentDto } from './dto/education.dto';

@Injectable()
export class EducationService {
  constructor(private readonly prisma: PrismaService) {}

  async createContent(dto: CreateEducationalContentDto) {
    const content = await this.prisma.educationalContent.create({
      data: {
        type: dto.type,
        title: dto.title,
        description: dto.description,
        body: dto.body,
        imageUrl: dto.imageUrl,
        category: dto.category,
        difficulty: dto.difficulty || 'BEGINNER',
        xpReward: dto.xpReward || 0,
        estimatedMinutes: dto.estimatedMinutes,
        isActive: true,
      },
    });

    return content;
  }

  async updateContent(contentId: string, dto: UpdateEducationalContentDto) {
    const content = await this.prisma.educationalContent.findUnique({
      where: { id: contentId },
    });

    if (!content) {
      throw new NotFoundException('Educational content not found');
    }

    const updated = await this.prisma.educationalContent.update({
      where: { id: contentId },
      data: {
        title: dto.title,
        description: dto.description,
        body: dto.body,
        imageUrl: dto.imageUrl,
        category: dto.category,
        difficulty: dto.difficulty,
        xpReward: dto.xpReward,
        estimatedMinutes: dto.estimatedMinutes,
        isActive: dto.isActive,
      },
    });

    return updated;
  }

  async getContent(
    page: number = 1,
    limit: number = 20,
    type?: EducationContentType,
    category?: string,
  ) {
    const where: any = {
      isActive: true,
    };

    if (type) {
      where.type = type;
    }

    if (category) {
      where.category = category;
    }

    const [items, total] = await Promise.all([
      this.prisma.educationalContent.findMany({
        where,
        orderBy: { displayOrder: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.educationalContent.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
    };
  }

  async getContentById(contentId: string) {
    const content = await this.prisma.educationalContent.findUnique({
      where: { id: contentId },
    });

    if (!content) {
      throw new NotFoundException('Educational content not found');
    }

    return content;
  }

  async startContent(userId: string, contentId: string) {
    const content = await this.prisma.educationalContent.findUnique({
      where: { id: contentId },
    });

    if (!content) {
      throw new NotFoundException('Educational content not found');
    }

    if (!content.isActive) {
      throw new BadRequestException('This content is no longer available');
    }

    const existingProgress = await this.prisma.educationProgress.findUnique({
      where: {
        userId_contentId: {
          userId,
          contentId,
        },
      },
    });

    if (existingProgress) {
      return existingProgress;
    }

    const progress = await this.prisma.educationProgress.create({
      data: {
        userId,
        contentId,
        status: EducationProgressStatus.STARTED,
      },
    });

    return progress;
  }

  async completeContent(userId: string, contentId: string) {
    const content = await this.prisma.educationalContent.findUnique({
      where: { id: contentId },
    });

    if (!content) {
      throw new NotFoundException('Educational content not found');
    }

    const progress = await this.prisma.educationProgress.findUnique({
      where: {
        userId_contentId: {
          userId,
          contentId,
        },
      },
    });

    if (!progress) {
      throw new BadRequestException('You must start the content before completing it');
    }

    if (progress.status === EducationProgressStatus.COMPLETED) {
      return progress;
    }

    const updated = await this.prisma.educationProgress.update({
      where: {
        userId_contentId: {
          userId,
          contentId,
        },
      },
      data: {
        status: EducationProgressStatus.COMPLETED,
        completedAt: new Date(),
        xpAwarded: content.xpReward,
      },
    });

    return updated;
  }

  async getUserProgress(userId: string, page: number = 1, limit: number = 20) {
    const [items, total] = await Promise.all([
      this.prisma.educationProgress.findMany({
        where: { userId },
        include: {
          content: true,
        },
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.educationProgress.count({
        where: { userId },
      }),
    ]);

    return {
      items,
      total,
      page,
      limit,
    };
  }

  async getUserStats(userId: string) {
    const [totalStarted, totalCompleted, totalXpEarned] = await Promise.all([
      this.prisma.educationProgress.count({
        where: { userId },
      }),
      this.prisma.educationProgress.count({
        where: {
          userId,
          status: EducationProgressStatus.COMPLETED,
        },
      }),
      this.prisma.educationProgress.aggregate({
        where: {
          userId,
          status: EducationProgressStatus.COMPLETED,
        },
        _sum: {
          xpAwarded: true,
        },
      }),
    ]);

    return {
      totalStarted,
      totalCompleted,
      totalXpEarned: totalXpEarned._sum.xpAwarded || 0,
    };
  }
}
