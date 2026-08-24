export interface AIModelConfig {
  name: string;
  provider: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  isPrimary: boolean;
  enabled: boolean;
}

export const DEFAULT_MODEL_CONFIGS: AIModelConfig[] = [
  {
    name: 'gpt-4o-mini',
    provider: 'openai',
    temperature: 0.3,
    maxTokens: 1000,
    timeoutMs: 30000,
    isPrimary: true,
    enabled: true,
  },
  {
    name: 'gpt-4o',
    provider: 'openai',
    temperature: 0.2,
    maxTokens: 1500,
    timeoutMs: 45000,
    isPrimary: false,
    enabled: false,
  },
];
