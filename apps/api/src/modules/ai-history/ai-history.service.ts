import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AIInsightType, AIInsightStatus, AISafetyLevel } from '@prisma/client';
import { AiInsightResponseDto, DataPointDto, DataReferenceDto } from '../ai-health/dto';

export interface StoredInsight {
  id: string;
  userId: string;
  type: AIInsightType;
  status: AIInsightStatus;
  title?: string;
  summary?: string;
  observations?: string[];
  dataPoints?: DataPointDto[];
  caveats?: string[];
  questionsForProfessional?: string[];
  safetyLevel: AISafetyLevel;
  dataVersion?: string;
  dataReferences?: DataReferenceDto[];
  sourceType?: string;
  sourceId?: string;
  errorMessage?: string;
  generatedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateInsightInput {
  userId: string;
  type: AIInsightType;
  status?: AIInsightStatus;
  title?: string;
  summary?: string;
  observations?: string[];
  dataPoints?: DataPointDto[];
  caveats?: string[];
  questionsForProfessional?: string[];
  safetyLevel?: AISafetyLevel;
  dataVersion?: string;
  dataReferences?: DataReferenceDto[];
  sourceType?: string;
  sourceId?: string;
  promptVersion?: string;
  model?: string;
  errorMessage?: string;
  generatedAt?: Date;
  expiresAt?: Date;
}

export interface UpdateInsightInput {
  status?: AIInsightStatus;
  title?: string;
  summary?: string;
  observations?: string[];
  dataPoints?: DataPointDto[];
  caveats?: string[];
  questionsForProfessional?: string[];
  safetyLevel?: AISafetyLevel;
  dataVersion?: string;
  dataReferences?: DataReferenceDto[];
  errorMessage?: string;
  generatedAt?: Date;
  expiresAt?: Date;
}

@Injectable()
export class AIInsightHistoryService {
  private readonly logger = new Logger(AIInsightHistoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createInsight(input: CreateInsightInput): Promise<StoredInsight> {
    const insight = await this.prisma.aIInsight.create({
      data: {
        userId: input.userId,
        type: input.type,
        status: input.status || AIInsightStatus.PENDING,
        title: input.title,
        summary: input.summary,
        observations: (input.observations || []) as any,
        dataPoints: (input.dataPoints || []) as any,
        caveats: (input.caveats || []) as any,
        questionsForProfessional: (input.questionsForProfessional || []) as any,
        safetyLevel: input.safetyLevel || AISafetyLevel.SAFE_INFORMATIONAL,
        dataVersion: input.dataVersion,
        dataReferences: (input.dataReferences || []) as any,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        promptVersion: input.promptVersion,
        model: input.model,
        errorMessage: input.errorMessage,
        generatedAt: input.generatedAt,
        expiresAt: input.expiresAt,
      },
    });

    return this.mapToStoredInsight(insight);
  }

  async updateInsight(id: string, input: UpdateInsightInput): Promise<StoredInsight> {
    const insight = await this.prisma.aIInsight.update({
      where: { id },
      data: {
        status: input.status,
        title: input.title,
        summary: input.summary,
        observations: input.observations as any,
        dataPoints: input.dataPoints as any,
        caveats: input.caveats as any,
        questionsForProfessional: input.questionsForProfessional as any,
        safetyLevel: input.safetyLevel,
        dataVersion: input.dataVersion,
        dataReferences: input.dataReferences as any,
        errorMessage: input.errorMessage,
        generatedAt: input.generatedAt,
        expiresAt: input.expiresAt,
      },
    });

    return this.mapToStoredInsight(insight);
  }

  async getInsight(id: string, userId: string): Promise<StoredInsight> {
    const insight = await this.prisma.aIInsight.findFirst({
      where: { id, userId },
    });

    if (!insight) {
      throw new NotFoundException('Insight not found');
    }

    return this.mapToStoredInsight(insight);
  }

  async getUserInsights(
    userId: string,
    options: {
      type?: AIInsightType;
      status?: AIInsightStatus;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{ insights: StoredInsight[]; total: number }> {
    const { type, status, limit = 20, offset = 0 } = options;

    const where: any = { userId };
    if (type) where.type = type;
    if (status) where.status = status;

    const [insights, total] = await Promise.all([
      this.prisma.aIInsight.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.aIInsight.count({ where }),
    ]);

    return {
      insights: insights.map((i) => this.mapToStoredInsight(i)),
      total,
    };
  }

  async getInsightsBySource(
    userId: string,
    sourceType: string,
    sourceId: string,
  ): Promise<StoredInsight[]> {
    const insights = await this.prisma.aIInsight.findMany({
      where: { userId, sourceType, sourceId },
      orderBy: { createdAt: 'desc' },
    });

    return insights.map((i) => this.mapToStoredInsight(i));
  }

  async deleteInsight(id: string, userId: string): Promise<void> {
    const insight = await this.prisma.aIInsight.findFirst({
      where: { id, userId },
    });

    if (!insight) {
      throw new NotFoundException('Insight not found');
    }

    await this.prisma.aIInsight.delete({ where: { id } });
  }

  async deleteExpiredInsights(): Promise<number> {
    const now = new Date();
    const result = await this.prisma.aIInsight.deleteMany({
      where: {
        expiresAt: { not: null, lt: now },
      },
    });

    this.logger.log(`Deleted ${result.count} expired insights`);
    return result.count;
  }

  async insightToResponseDto(insight: StoredInsight): Promise<AiInsightResponseDto> {
    return {
      id: insight.id,
      type: insight.type as any,
      title: insight.title || 'Insight',
      summary: insight.summary || '',
      observations: insight.observations || [],
      dataPoints: insight.dataPoints,
      caveats: insight.caveats || ['AI-generated informational content. Not a medical diagnosis.'],
      questionsForProfessional: insight.questionsForProfessional,
      safetyLevel: insight.safetyLevel as any,
      generatedAt: insight.generatedAt?.toISOString() || insight.createdAt.toISOString(),
      dataVersion: insight.dataVersion,
      dataReferences: insight.dataReferences,
    };
  }

  private mapToStoredInsight(insight: any): StoredInsight {
    return {
      id: insight.id,
      userId: insight.userId,
      type: insight.type,
      status: insight.status,
      title: insight.title,
      summary: insight.summary,
      observations: (insight.observations as string[]) || [],
      dataPoints: (insight.dataPoints as DataPointDto[]) || [],
      caveats: (insight.caveats as string[]) || [],
      questionsForProfessional: (insight.questionsForProfessional as string[]) || [],
      safetyLevel: insight.safetyLevel,
      dataVersion: insight.dataVersion,
      dataReferences: (insight.dataReferences as DataReferenceDto[]) || [],
      sourceType: insight.sourceType,
      sourceId: insight.sourceId,
      errorMessage: insight.errorMessage,
      generatedAt: insight.generatedAt,
      expiresAt: insight.expiresAt,
      createdAt: insight.createdAt,
      updatedAt: insight.updatedAt,
    };
  }
}
