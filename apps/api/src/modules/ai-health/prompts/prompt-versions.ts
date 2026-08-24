export const AI_PROMPT_VERSIONS = {
  healthTestAnalysis: 'health-test-analysis-v1',
  healthTrendAnalysis: 'health-trend-analysis-v1',
  healthSummary: 'health-summary-v1',
  healthChat: 'health-chat-v1',
  donationInsight: 'donation-insight-v1',
  appointmentInsight: 'appointment-insight-v1',
  generalInfo: 'general-info-v1',
  questionSuggestion: 'question-suggestion-v1',
} as const;

export type PromptVersionKey = keyof typeof AI_PROMPT_VERSIONS;
export type PromptVersion = (typeof AI_PROMPT_VERSIONS)[PromptVersionKey];

export function getPromptVersion(key: PromptVersionKey): PromptVersion {
  return AI_PROMPT_VERSIONS[key];
}
