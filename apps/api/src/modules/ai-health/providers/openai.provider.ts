import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIProvider, AIProviderMessage, AIProviderOptions, AIProviderResponse } from './ai-provider.interface';

@Injectable()
export class OpenAIProvider implements AIProvider {
  private readonly logger = new Logger(OpenAIProvider.name);
  readonly name = 'openai';

  constructor(
    private readonly configService: ConfigService,
  ) {}

  async generate(messages: AIProviderMessage[], options?: AIProviderOptions): Promise<AIProviderResponse> {
    const apiKey = this.configService.get<string>('AI_API_KEY');
    const model = this.configService.get<string>('AI_MODEL', 'gpt-4o-mini');
    const baseUrl = this.configService.get<string>('AI_BASE_URL', 'https://api.openai.com/v1');

    if (!apiKey) {
      throw new Error('AI_API_KEY is not configured');
    }

    const timeout = options?.timeout || 30000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: options?.temperature ?? 0.3,
          max_tokens: options?.maxTokens ?? 1000,
          response_format: options?.responseFormat === 'json' ? { type: 'json_object' } : undefined,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`OpenAI API error: ${response.status} - ${errorText}`);
        throw new Error(`AI provider returned status ${response.status}`);
      }

      const data = await response.json() as {
        choices: Array<{
          message: { content: string };
          finish_reason: string;
        }>;
        usage: {
          prompt_tokens: number;
          completion_tokens: number;
          total_tokens: number;
        };
      };

      const choice = data.choices[0];
      if (!choice) {
        throw new Error('No response choices from AI provider');
      }

      return {
        content: choice.message.content,
        finishReason: choice.finish_reason,
        usage: data.usage ? {
          prompt_tokens: data.usage.prompt_tokens,
          completion_tokens: data.usage.completion_tokens,
          total_tokens: data.usage.total_tokens,
        } : undefined,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('AI request timed out');
      }
      throw error;
    }
  }
}
