import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIProvider, AIProviderMessage, AIProviderOptions, AIProviderResponse } from './ai-provider.interface';
import { OpenAIProvider } from './openai.provider';
import { AIFallbackProvider } from './fallback.provider';
import { AIModelConfig } from './ai-model-config';

@Injectable()
export class AIProviderFactory {
  private readonly logger = new Logger(AIProviderFactory.name);
  private readonly primaryProvider: AIProvider;
  private readonly fallbackProvider: AIProvider;
  private readonly primaryConfig: AIModelConfig;

  constructor(
    private readonly openaiProvider: OpenAIProvider,
    private readonly configService: ConfigService,
  ) {
    this.primaryProvider = this.openaiProvider;
    this.fallbackProvider = new AIFallbackProvider();
    this.primaryConfig = {
      name: configService.get<string>('AI_MODEL', 'gpt-4o-mini'),
      provider: 'openai',
      temperature: 0.3,
      maxTokens: configService.get<number>('AI_MAX_TOKENS', 1000),
      timeoutMs: configService.get<number>('AI_TIMEOUT_MS', 30000),
      isPrimary: true,
      enabled: true,
    };
  }

  async generate(
    messages: AIProviderMessage[],
    options?: AIProviderOptions,
  ): Promise<AIProviderResponse & { provider: string; model: string; isFallback: boolean }> {
    try {
      const result = await this.primaryProvider.generate(messages, {
        temperature: options?.temperature ?? this.primaryConfig.temperature,
        maxTokens: options?.maxTokens ?? this.primaryConfig.maxTokens,
        timeout: options?.timeout ?? this.primaryConfig.timeoutMs,
        responseFormat: options?.responseFormat,
      });

      return {
        ...result,
        provider: this.primaryConfig.provider,
        model: this.primaryConfig.name,
        isFallback: false,
      };
    } catch (error) {
      this.logger.error(`Primary AI provider failed, using fallback: ${error instanceof Error ? error.message : 'Unknown error'}`);

      try {
        const fallbackResult = await this.fallbackProvider.generate(messages, options);
        return {
          ...fallbackResult,
          provider: 'fallback',
          model: 'deterministic',
          isFallback: true,
        };
      } catch (fallbackError) {
        this.logger.error(`Fallback provider also failed: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`);
        throw new Error('All AI providers failed');
      }
    }
  }
}
