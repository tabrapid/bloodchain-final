import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export type AIFeedbackType = 'HELPFUL' | 'NOT_HELPFUL' | 'REPORT_ISSUE';

export interface SubmitFeedbackDto {
  insightId: string;
  type: AIFeedbackType;
  reason?: string;
}

export interface FeedbackAnalyticsDto {
  totalFeedback: number;
  helpful: number;
  notHelpful: number;
  reportIssue: number;
  helpfulRate: number;
}

@Injectable()
export class AIFeedbackService {
  private readonly logger = new Logger(AIFeedbackService.name);

  constructor(private readonly prisma: PrismaService) {}

  async submitFeedback(userId: string, dto: SubmitFeedbackDto) {
    const insight = await this.prisma.aIInsight.findFirst({
      where: { id: dto.insightId, userId },
    });

    if (!insight) {
      throw new NotFoundException('Insight not found');
    }

    const existing = await this.prisma.aIFeedback.findUnique({
      where: { insightId: dto.insightId },
    });

    if (existing) {
      throw new ConflictException('Feedback already submitted for this insight');
    }

    const feedback = await this.prisma.aIFeedback.create({
      data: {
        userId,
        insightId: dto.insightId,
        type: dto.type,
        reason: dto.reason?.slice(0, 500) || null,
      },
    });

    this.logger.log(`Feedback submitted for insight ${dto.insightId}: ${dto.type}`);
    return feedback;
  }

  async getUserFeedback(userId: string, options: { limit?: number; offset?: number } = {}) {
    const { limit = 20, offset = 0 } = options;

    const [feedbacks, total] = await Promise.all([
      this.prisma.aIFeedback.findMany({
        where: { userId },
        include: { insight: { select: { id: true, type: true, title: true, summary: true } } },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.aIFeedback.count({ where: { userId } }),
    ]);

    return { feedbacks, total };
  }

  async getPlatformFeedbackAnalytics(days = 30): Promise<FeedbackAnalyticsDto> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const feedbacks = await this.prisma.aIFeedback.findMany({
      where: { createdAt: { gte: since } },
      select: { type: true },
    });

    const total = feedbacks.length;
    const helpful = feedbacks.filter((f) => f.type === 'HELPFUL').length;
    const notHelpful = feedbacks.filter((f) => f.type === 'NOT_HELPFUL').length;
    const reportIssue = feedbacks.filter((f) => f.type === 'REPORT_ISSUE').length;

    return {
      totalFeedback: total,
      helpful,
      notHelpful,
      reportIssue,
      helpfulRate: total > 0 ? Math.round((helpful / total) * 100) : 0,
    };
  }
}
