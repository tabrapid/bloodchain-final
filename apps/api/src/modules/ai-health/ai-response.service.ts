import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { AIProviderMessage } from './providers/ai-provider.interface';
import { AIProviderFactory } from './providers/ai-provider.factory';
import { AIPromptBuilder } from './prompts';
import { AIHealthSafetyService, InsightType } from './ai-safety.service';
import {
  AiInsightResponseDto,
  SafetyLevel,
  DataReferenceDto,
  DataPointDto,
} from './dto';

interface ParsedAIResponse {
  title?: string;
  summary?: string;
  observations?: string[];
  dataPoints?: Array<{ label?: string; value?: string; unit?: string; date?: string }>;
  caveats?: string[];
  questionsForProfessional?: string[];
  safetyLevel?: string;
  type?: string;
}

interface ProviderResult {
  content: string;
  provider: string;
  model: string;
  isFallback: boolean;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

@Injectable()
export class AIResponseService {
  private readonly logger = new Logger(AIResponseService.name);

  constructor(
    private readonly providerFactory: AIProviderFactory,
    private readonly promptBuilder: AIPromptBuilder,
    private readonly safetyService: AIHealthSafetyService,
    private readonly configService: ConfigService,
  ) {}

  async generateStructuredInsight(
    systemPrompt: string,
    userPrompt: string,
    contextData?: Record<string, unknown>,
  ): Promise<AiInsightResponseDto & { provider: string; model: string; isFallback: boolean }> {
    const messages: AIProviderMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const maxTokens = this.configService.get<number>('AI_MAX_TOKENS', 1000);
    const timeout = this.configService.get<number>('AI_TIMEOUT_MS', 30000);

    try {
      const result = await this.providerFactory.generate(messages, {
        temperature: 0.3,
        maxTokens,
        timeout,
        responseFormat: 'json',
      });

      const validation = this.safetyService.validateOutput(result.content);
      if (!validation.isValid) {
        this.logger.warn(`Unsafe AI output detected: ${validation.reason}`);
        const fallback = this.createFallbackResponse(validation.safetyLevel);
        return { ...fallback, provider: result.provider, model: result.model, isFallback: result.isFallback };
      }

      const parsed = this.parseAndValidateResponse(result.content);

      if (!parsed) {
        this.logger.warn('Failed to parse AI response as valid JSON');
        const fallback = this.createFallbackResponse(SafetyLevel.NEEDS_CONTEXT);
        return { ...fallback, provider: result.provider, model: result.model, isFallback: result.isFallback };
      }

      const dataVersion = contextData?.dataVersion as string | undefined;

      return {
        ...this.buildResponseDto(parsed, dataVersion),
        provider: result.provider,
        model: result.model,
        isFallback: result.isFallback,
      };
    } catch (error) {
      this.logger.error(`AI provider error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new ServiceUnavailableException('AI insights are temporarily unavailable');
    }
  }

  private parseAndValidateResponse(content: string): ParsedAIResponse | null {
    try {
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned) as ParsedAIResponse;

      if (!parsed.title || !parsed.summary) {
        return null;
      }

      return {
        title: String(parsed.title).slice(0, 200),
        summary: String(parsed.summary).slice(0, 500),
        observations: Array.isArray(parsed.observations)
          ? parsed.observations.map((o) => String(o)).slice(0, 10)
          : [],
        dataPoints: Array.isArray(parsed.dataPoints)
          ? parsed.dataPoints.slice(0, 20).map((dp) => ({
              label: String(dp.label || ''),
              value: String(dp.value || ''),
              unit: dp.unit ? String(dp.unit) : undefined,
              date: dp.date ? String(dp.date) : undefined,
            }))
          : [],
        caveats: Array.isArray(parsed.caveats)
          ? parsed.caveats.map((c) => String(c)).slice(0, 10)
          : [],
        questionsForProfessional: Array.isArray(parsed.questionsForProfessional)
          ? parsed.questionsForProfessional.map((q) => String(q)).slice(0, 5)
          : undefined,
        safetyLevel: ['SAFE_INFORMATIONAL', 'NEEDS_CONTEXT', 'PROFESSIONAL_REVIEW_SUGGESTED', 'EMERGENCY_REDIRECT', 'OUT_OF_SCOPE'].includes(String(parsed.safetyLevel))
          ? String(parsed.safetyLevel)
          : 'SAFE_INFORMATIONAL',
        type: ['TREND_SUMMARY', 'RESULT_EXPLANATION', 'DATA_CHANGE', 'REFERENCE_RANGE_CONTEXT', 'GENERAL_HEALTH_INFORMATION', 'QUESTION_SUGGESTION', 'DATA_QUALITY_WARNING'].includes(String(parsed.type))
          ? String(parsed.type)
          : 'GENERAL_HEALTH_INFORMATION',
      };
    } catch {
      return null;
    }
  }

  private buildResponseDto(parsed: ParsedAIResponse, dataVersion?: string): AiInsightResponseDto {
    const dataReferences: DataReferenceDto[] = [];
    const dataPoints: DataPointDto[] = [];

    if (parsed.dataPoints) {
      for (const dp of parsed.dataPoints) {
        dataPoints.push({
          label: dp.label || 'Value',
          value: dp.value || 'N/A',
          unit: dp.unit,
          date: dp.date,
        });
      }
    }

    const defaultCaveats = parsed.caveats || [];
    if (!defaultCaveats.some((c) => c.toLowerCase().includes('not a medical diagnosis'))) {
      defaultCaveats.unshift('AI-generated informational content. Not a medical diagnosis.');
    }

    return {
      id: uuidv4(),
      type: (parsed.type as InsightType) || InsightType.GENERAL_HEALTH_INFORMATION,
      title: parsed.title || 'Insight',
      summary: parsed.summary || 'No summary available.',
      observations: parsed.observations || [],
      dataPoints: dataPoints.length > 0 ? dataPoints : undefined,
      caveats: defaultCaveats,
      questionsForProfessional: parsed.questionsForProfessional,
      safetyLevel: (parsed.safetyLevel as SafetyLevel) || SafetyLevel.SAFE_INFORMATIONAL,
      generatedAt: new Date().toISOString(),
      dataVersion,
      dataReferences: dataReferences.length > 0 ? dataReferences : undefined,
    };
  }

  private createFallbackResponse(safetyLevel: SafetyLevel): AiInsightResponseDto {
    const fallback = this.safetyService.getSafeFallback(safetyLevel) as Record<string, unknown>;

    return {
      id: uuidv4(),
      type: (fallback.type as InsightType) || InsightType.GENERAL_HEALTH_INFORMATION,
      title: String(fallback.title),
      summary: String(fallback.summary),
      observations: (fallback.observations as string[]) || [],
      caveats: (fallback.caveats as string[]) || ['AI-generated informational content. Not a medical diagnosis.'],
      questionsForProfessional: (fallback.questionsForProfessional as string[]) || [],
      safetyLevel: (fallback.safetyLevel as SafetyLevel) || SafetyLevel.OUT_OF_SCOPE,
      generatedAt: new Date().toISOString(),
    };
  }
}
