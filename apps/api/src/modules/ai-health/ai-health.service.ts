import { Injectable, Logger, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { AIContextBuilder } from './ai-context-builder.service';
import { AIResponseService } from './ai-response.service';
import { AIHealthSafetyService, InsightType } from './ai-safety.service';
import { AIPromptBuilder } from './prompts';
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
    private readonly responseService: AIResponseService,
    private readonly safetyService: AIHealthSafetyService,
    private readonly promptBuilder: AIPromptBuilder,
    private readonly configService: ConfigService,
  ) {}

  async generateInsight(userId: string, dto: GenerateInsightDto): Promise<AiInsightResponseDto> {
    this.checkFeatureEnabled();

    const sanitizedQuestion = dto.question
      ? this.safetyService.sanitizeInput(dto.question)
      : undefined;

    if (sanitizedQuestion) {
      const requestSafety = this.safetyService.classifyRequest(sanitizedQuestion);
      if (requestSafety === SafetyLevel.OUT_OF_SCOPE || requestSafety === SafetyLevel.EMERGENCY_REDIRECT) {
        const fallback = this.safetyService.getSafeFallback(requestSafety);
        return this.responseService.generateStructuredInsight(
          this.promptBuilder.buildSystemPrompt(),
          String(fallback.summary),
        );
      }
    }

    let contextData: Record<string, unknown> = {};
    let systemPrompt: string;
    let userPrompt: string;

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

        contextData = {
          dataVersion: trendContext.latestDate,
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

        contextData = {
          dataVersion: resultContext.date,
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

        contextData = {
          dataVersion: new Date().toISOString(),
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

        contextData = {
          dataVersion: new Date().toISOString(),
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

    return this.responseService.generateStructuredInsight(systemPrompt, userPrompt, contextData);
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

    const sanitizedMessage = this.safetyService.sanitizeInput(dto.message);
    const requestSafety = this.safetyService.classifyRequest(sanitizedMessage);

    if (requestSafety === SafetyLevel.OUT_OF_SCOPE || requestSafety === SafetyLevel.EMERGENCY_REDIRECT) {
      const fallback = this.safetyService.getSafeFallback(requestSafety);
      const fallbackInsight = await this.responseService.generateStructuredInsight(
        this.promptBuilder.buildSystemPrompt(),
        String(fallback.summary),
      );
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

    return this.createChatResponse(userId, dto.conversationId, sanitizedMessage, insight);
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

  private checkFeatureEnabled(): void {
    const enabled = this.configService.get<string>('AI_ENABLED', 'false');
    if (enabled !== 'true') {
      throw new ForbiddenException('AI insights are not enabled');
    }
  }

  invalidateCache(userId: string): void {
    for (const [key, value] of this.insightCache.entries()) {
      if (value.userId === userId) {
        this.insightCache.delete(key);
      }
    }
  }
}
