import { Injectable, Logger, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { AIInsightType, AIInsightStatus, AISafetyLevel } from '@prisma/client';
import { AIContextBuilder } from './ai-context-builder.service';
import { AIContextBuilderService } from './ai-context-builder-enhanced.service';
import { AIResponseService } from './ai-response.service';
import { AIHealthSafetyService, InsightType } from './ai-safety.service';
import { AIPromptBuilder } from './prompts';
import { AIInsightHistoryService } from '../ai-history/ai-history.service';
import { AIRequestLogService } from '../ai-logging/ai-logging.service';
import { AICacheService } from '../ai-cache/ai-cache.service';
import {
  GenerateInsightDto,
  ExplainResultDto,
  AnalyzeTrendDto,
  SendChatMessageDto,
  AiInsightResponseDto,
  ChatConversationDto,
  ChatMessageResponseDto,
  ChatResponseDto,
  SafetyLevel,
} from './dto';

interface CachedInsight {
  insight: AiInsightResponseDto;
  userId: string;
  dataVersion: string;
  createdAt: Date;
}

@Injectable()
export class AIHealthService {
  private readonly logger = new Logger(AIHealthService.name);
  private readonly insightCache = new Map<string, CachedInsight>();

  constructor(
    private readonly contextBuilder: AIContextBuilder,
    private readonly enhancedContextBuilder: AIContextBuilderService,
    private readonly responseService: AIResponseService,
    private readonly safetyService: AIHealthSafetyService,
    private readonly promptBuilder: AIPromptBuilder,
    private readonly configService: ConfigService,
    private readonly historyService: AIInsightHistoryService,
    private readonly loggingService: AIRequestLogService,
    private readonly cacheService: AICacheService,
  ) {}

  async generateInsight(userId: string, dto: GenerateInsightDto): Promise<AiInsightResponseDto> {
    this.checkFeatureEnabled();
    const startTime = Date.now();

    const sanitizedQuestion = dto.question
      ? this.safetyService.sanitizeInput(dto.question)
      : undefined;

    if (sanitizedQuestion) {
      const requestSafety = this.safetyService.classifyRequest(sanitizedQuestion);
      if (requestSafety === SafetyLevel.OUT_OF_SCOPE || requestSafety === SafetyLevel.EMERGENCY_REDIRECT) {
        const fallback = this.safetyService.getSafeFallback(requestSafety);
        const insight = await this.responseService.generateStructuredInsight(
          this.promptBuilder.buildSystemPrompt(),
          String(fallback.summary),
        );

        await this.logRequest(userId, dto.type, startTime, true, insight);
        return insight;
      }
    }

    let contextData: Record<string, unknown> = {};
    let systemPrompt: string;
    let userPrompt: string;
    let dataVersion: string;

    switch (dto.type) {
      case InsightType.TREND_SUMMARY:
      case InsightType.DATA_CHANGE: {
        if (!dto.parameterCode) {
          throw new ForbiddenException('Parameter code is required for trend analysis');
        }

        const trendContext = await this.contextBuilder.buildTrendContext(
          userId,
          dto.parameterCode,
          { from: dto.from, to: dto.to },
        );

        if (!trendContext) {
          throw new NotFoundException('No trend data found for this parameter');
        }

        dataVersion = trendContext.latestDate;
        contextData = {
          dataVersion,
          parameterCode: dto.parameterCode,
        };

        systemPrompt = this.promptBuilder.buildSystemPrompt();
        userPrompt = this.promptBuilder.buildUserPrompt(
          dto.type,
          this.promptBuilder.buildTrendSummaryContext(trendContext),
        );
        break;
      }

      case InsightType.RESULT_EXPLANATION: {
        if (!dto.resultId) {
          throw new ForbiddenException('Result ID is required for explanation');
        }

        const resultContext = await this.contextBuilder.buildResultExplanationContext(userId, dto.resultId);

        if (!resultContext) {
          throw new NotFoundException('Result not found or not accessible');
        }

        dataVersion = resultContext.date;
        contextData = {
          dataVersion,
          resultId: dto.resultId,
        };

        systemPrompt = this.promptBuilder.buildSystemPrompt();
        userPrompt = this.promptBuilder.buildUserPrompt(
          InsightType.RESULT_EXPLANATION,
          this.promptBuilder.buildResultExplanationContext(resultContext),
        );
        break;
      }

      case InsightType.GENERAL_HEALTH_INFORMATION: {
        if (!dto.parameterCode) {
          throw new ForbiddenException('Parameter code is required for general information');
        }

        const infoContext = await this.contextBuilder.buildGeneralInfoContext(dto.parameterCode);

        if (!infoContext) {
          throw new NotFoundException('Parameter not found');
        }

        dataVersion = new Date().toISOString();
        contextData = {
          dataVersion,
          parameterCode: dto.parameterCode,
        };

        systemPrompt = this.promptBuilder.buildSystemPrompt();
        userPrompt = this.promptBuilder.buildUserPrompt(
          InsightType.GENERAL_HEALTH_INFORMATION,
          this.promptBuilder.buildGeneralInfoContext(infoContext),
        );
        break;
      }

      case InsightType.QUESTION_SUGGESTION: {
        const healthSummary = await this.contextBuilder.getUserHealthSummary(userId);

        dataVersion = new Date().toISOString();
        contextData = {
          dataVersion,
        };

        systemPrompt = this.promptBuilder.buildSystemPrompt();
        userPrompt = this.promptBuilder.buildUserPrompt(
          InsightType.QUESTION_SUGGESTION,
          healthSummary,
        );
        break;
      }

      default:
        throw new ForbiddenException('Unsupported insight type');
    }

    if (dto.question) {
      userPrompt += `\n\nUser's specific question: ${sanitizedQuestion}`;
    }

    // Check cache first
    const cached = await this.cacheService.get(userId, dto.type as any, dataVersion);
    if (cached) {
      this.logger.debug(`Cache hit for ${dto.type}`);
      await this.logRequest(userId, dto.type, startTime, true, cached.insight);
      return cached.insight;
    }

    const insight = await this.responseService.generateStructuredInsight(systemPrompt, userPrompt, contextData);

    // Store in cache
    await this.cacheService.set(userId, dto.type as any, dataVersion, insight);

    // Store in history
    await this.historyService.createInsight({
      userId,
      type: dto.type as any,
      status: AIInsightStatus.COMPLETED,
      title: insight.title,
      summary: insight.summary,
      observations: insight.observations,
      dataPoints: insight.dataPoints,
      caveats: insight.caveats,
      questionsForProfessional: insight.questionsForProfessional,
      safetyLevel: insight.safetyLevel as any,
      dataVersion,
      dataReferences: insight.dataReferences,
      sourceType: dto.type === InsightType.RESULT_EXPLANATION ? 'BLOOD_TEST' : undefined,
      sourceId: dto.resultId,
      generatedAt: new Date(),
    });

    await this.logRequest(userId, dto.type, startTime, true, insight);

    return insight;
  }

  async generateDonationInsight(userId: string): Promise<AiInsightResponseDto> {
    this.checkFeatureEnabled();
    const startTime = Date.now();

    const context = await this.enhancedContextBuilder.buildEnhancedContext(userId);
    const donationContext = context.donations;

    const systemPrompt = this.promptBuilder.buildSystemPrompt();
    const userPrompt = this.buildDonationInsightPrompt(donationContext);

    const insight = await this.responseService.generateStructuredInsight(systemPrompt, userPrompt, {
      dataVersion: donationContext.lastDonationDate || new Date().toISOString(),
    });

    // Store in history
    await this.historyService.createInsight({
      userId,
      type: AIInsightType.DONATION_INSIGHT,
      status: AIInsightStatus.COMPLETED,
      title: insight.title,
      summary: insight.summary,
      observations: insight.observations,
      caveats: insight.caveats,
      questionsForProfessional: insight.questionsForProfessional,
      safetyLevel: insight.safetyLevel as any,
      generatedAt: new Date(),
    });

    await this.logRequest(userId, AIInsightType.DONATION_INSIGHT, startTime, true, insight);

    return insight;
  }

  async generateAppointmentInsight(userId: string): Promise<AiInsightResponseDto> {
    this.checkFeatureEnabled();
    const startTime = Date.now();

    const context = await this.enhancedContextBuilder.buildEnhancedContext(userId);
    const appointmentContext = context.appointments;

    const systemPrompt = this.promptBuilder.buildSystemPrompt();
    const userPrompt = this.buildAppointmentInsightPrompt(appointmentContext);

    const insight = await this.responseService.generateStructuredInsight(systemPrompt, userPrompt, {
      dataVersion: new Date().toISOString(),
    });

    // Store in history
    await this.historyService.createInsight({
      userId,
      type: AIInsightType.APPOINTMENT_INSIGHT,
      status: AIInsightStatus.COMPLETED,
      title: insight.title,
      summary: insight.summary,
      observations: insight.observations,
      caveats: insight.caveats,
      questionsForProfessional: insight.questionsForProfessional,
      safetyLevel: insight.safetyLevel as any,
      generatedAt: new Date(),
    });

    await this.logRequest(userId, AIInsightType.APPOINTMENT_INSIGHT, startTime, true, insight);

    return insight;
  }

  async generateHealthSummary(userId: string): Promise<AiInsightResponseDto> {
    this.checkFeatureEnabled();
    const startTime = Date.now();

    const context = await this.enhancedContextBuilder.buildEnhancedContext(userId);

    const systemPrompt = this.promptBuilder.buildSystemPrompt();
    const userPrompt = this.buildHealthSummaryPrompt(context);

    const insight = await this.responseService.generateStructuredInsight(systemPrompt, userPrompt, {
      dataVersion: new Date().toISOString(),
    });

    // Store in history
    await this.historyService.createInsight({
      userId,
      type: AIInsightType.HEALTH_SUMMARY,
      status: AIInsightStatus.COMPLETED,
      title: insight.title,
      summary: insight.summary,
      observations: insight.observations,
      caveats: insight.caveats,
      questionsForProfessional: insight.questionsForProfessional,
      safetyLevel: insight.safetyLevel as any,
      generatedAt: new Date(),
    });

    await this.logRequest(userId, AIInsightType.HEALTH_SUMMARY, startTime, true, insight);

    return insight;
  }

  async explainResult(userId: string, dto: ExplainResultDto): Promise<AiInsightResponseDto> {
    return this.generateInsight(userId, {
      type: InsightType.RESULT_EXPLANATION,
      resultId: dto.resultId,
    });
  }

  async analyzeTrend(userId: string, dto: AnalyzeTrendDto): Promise<AiInsightResponseDto> {
    return this.generateInsight(userId, {
      type: InsightType.TREND_SUMMARY,
      parameterCode: dto.parameterCode,
      from: dto.from,
      to: dto.to,
    });
  }

  async chat(userId: string, dto: SendChatMessageDto): Promise<ChatResponseDto> {
    this.checkFeatureEnabled();
    const startTime = Date.now();

    const sanitizedMessage = this.safetyService.sanitizeInput(dto.message);
    const requestSafety = this.safetyService.classifyRequest(sanitizedMessage);

    if (requestSafety === SafetyLevel.OUT_OF_SCOPE || requestSafety === SafetyLevel.EMERGENCY_REDIRECT) {
      const fallback = this.safetyService.getSafeFallback(requestSafety);
      const fallbackInsight = await this.responseService.generateStructuredInsight(
        this.promptBuilder.buildSystemPrompt(),
        String(fallback.summary),
      );

      await this.logRequest(userId, undefined, startTime, true, fallbackInsight);

      return this.createChatResponse(
        userId,
        dto.conversationId,
        sanitizedMessage,
        fallbackInsight,
      );
    }

    const healthSummary = await this.contextBuilder.getUserHealthSummary(userId);
    const systemPrompt = this.promptBuilder.buildSystemPrompt();
    const userPrompt = this.promptBuilder.buildChatPrompt(healthSummary, sanitizedMessage);

    const insight = await this.responseService.generateStructuredInsight(systemPrompt, userPrompt, {
      dataVersion: new Date().toISOString(),
    });

    await this.logRequest(userId, undefined, startTime, true, insight);

    return this.createChatResponse(userId, dto.conversationId, sanitizedMessage, insight);
  }

  async getInsightHistory(
    userId: string,
    options: {
      type?: AIInsightType;
      limit?: number;
      offset?: number;
    } = {},
  ) {
    return this.historyService.getUserInsights(userId, options);
  }

  async getInsight(userId: string, insightId: string) {
    const stored = await this.historyService.getInsight(insightId, userId);
    return this.historyService.insightToResponseDto(stored);
  }

  async deleteInsight(userId: string, insightId: string) {
    await this.historyService.deleteInsight(insightId, userId);
  }

  private async createChatResponse(
    userId: string,
    conversationId: string | undefined,
    userMessage: string,
    insight: AiInsightResponseDto,
  ): Promise<ChatResponseDto> {
    const convId = conversationId || uuidv4();

    const conversation: ChatConversationDto = {
      id: convId,
      title: this.generateConversationTitle(insight),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastMessage: userMessage.slice(0, 100),
    };

    const userMsg: ChatMessageResponseDto = {
      id: uuidv4(),
      conversationId: convId,
      role: 'user',
      content: userMessage,
      createdAt: new Date().toISOString(),
    };

    const assistantMsg: ChatMessageResponseDto = {
      id: uuidv4(),
      conversationId: convId,
      role: 'assistant',
      content: insight.summary,
      createdAt: new Date().toISOString(),
      insight,
    };

    return {
      conversation,
      message: assistantMsg,
    };
  }

  private generateConversationTitle(insight: AiInsightResponseDto): string {
    if (insight.title && !insight.title.includes('scope')) {
      const words = insight.title.split(' ').slice(0, 3);
      return words.join(' ');
    }

    switch (insight.type) {
      case InsightType.TREND_SUMMARY:
        return 'Trend Summary';
      case InsightType.RESULT_EXPLANATION:
        return 'Result Explanation';
      case InsightType.DATA_CHANGE:
        return 'Data Change';
      case InsightType.QUESTION_SUGGESTION:
        return 'Questions';
      default:
        return 'Health Insight';
    }
  }

  private buildDonationInsightPrompt(context: any): string {
    return `Based on the following donation history, provide a helpful summary:

DONATION HISTORY:
- Total donations: ${context.totalDonations}
- Last donation: ${context.lastDonationDate || 'Never'}
- Next eligible date: ${context.nextEligibleDate || 'Unknown'}
- Donation frequency: ${context.donationFrequency}
- Blood type: ${context.bloodType || 'Unknown'}

Recent donations:
${context.recentDonations.map((d: any) => `- ${d.date}: ${d.type} (${d.status})`).join('\n')}

Provide observations about their donation pattern, any recommendations, and questions they might want to discuss with a healthcare professional. Remember to be informational only, not medical advice.`;
  }

  private buildAppointmentInsightPrompt(context: any): string {
    return `Based on the following appointment history, provide a helpful summary:

APPOINTMENT HISTORY:
- Total appointments: ${context.totalAppointments}
- Completed: ${context.completedAppointments}
- No-shows: ${context.noShowCount}
- Completion rate: ${context.completionRate}%

Upcoming appointments:
${context.upcomingAppointments.map((a: any) => `- ${a.date}: ${a.type} at ${a.organizationName}`).join('\n') || 'None scheduled'}

Provide observations about their appointment patterns, any recommendations, and questions they might want to discuss with a healthcare professional. Remember to be informational only, not medical advice.`;
  }

  private buildHealthSummaryPrompt(context: any): string {
    return `Based on the following health data, provide a comprehensive summary:

${context.summary}

BLOOD TESTS:
- Total tests: ${context.bloodTests.total}
- Last test: ${context.bloodTests.lastTestDate || 'Never'}

DONATIONS:
- Total donations: ${context.donations.totalDonations}
- Last donation: ${context.donations.lastDonationDate || 'Never'}
- Next eligible: ${context.donations.nextEligibleDate || 'Unknown'}

APPOINTMENTS:
- Total: ${context.appointments.totalAppointments}
- Completed: ${context.appointments.completedAppointments}
- Upcoming: ${context.appointments.upcomingAppointments.length}

Provide a helpful overview of their health engagement, any patterns observed, and questions they might want to discuss with a healthcare professional. Remember to be informational only, not medical advice.`;
  }

  private checkFeatureEnabled(): void {
    const enabled = this.configService.get<string>('AI_ENABLED', 'false');
    if (enabled !== 'true') {
      throw new ForbiddenException('AI insights are not enabled');
    }
  }

  private async logRequest(
    userId: string,
    insightType: any,
    startTime: number,
    success: boolean,
    insight?: AiInsightResponseDto,
  ): Promise<void> {
    const latencyMs = Date.now() - startTime;

    await this.loggingService.logRequest({
      userId,
      insightType,
      providerName: 'openai',
      latencyMs,
      success,
      safetyLevel: insight?.safetyLevel as any,
      dataVersion: insight?.dataVersion,
    });
  }

  invalidateCache(userId: string): void {
    for (const [key, value] of this.insightCache.entries()) {
      if (value.userId === userId) {
        this.insightCache.delete(key);
      }
    }
  }
}
