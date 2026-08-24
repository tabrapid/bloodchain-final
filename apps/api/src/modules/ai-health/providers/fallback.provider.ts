import { AIProvider, AIProviderMessage, AIProviderOptions, AIProviderResponse } from './ai-provider.interface';

export class AIFallbackProvider implements AIProvider {
  readonly name = 'fallback';

  async generate(_messages: AIProviderMessage[], _options?: AIProviderOptions): Promise<AIProviderResponse> {
    return {
      content: JSON.stringify({
        title: 'AI service unavailable',
        summary: 'AI analysis is temporarily unavailable. Please try again later.',
        observations: ['The AI service is currently experiencing issues.'],
        caveats: [
          'This is an automated fallback message.',
          'AI-generated informational content. Not a medical diagnosis.',
        ],
        questionsForProfessional: [],
        safetyLevel: 'NEEDS_CONTEXT',
        type: 'GENERAL_HEALTH_INFORMATION',
      }),
      finishReason: 'stop',
    };
  }
}
