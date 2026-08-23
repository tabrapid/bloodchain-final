export interface AIProviderMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIProviderUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface AIProviderResponse {
  content: string;
  finishReason?: string;
  usage?: AIProviderUsage;
}

export interface AIProvider {
  name: string;
  generate(messages: AIProviderMessage[], options?: AIProviderOptions): Promise<AIProviderResponse>;
}

export interface AIProviderOptions {
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  responseFormat?: 'json' | 'text';
}
