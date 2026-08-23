import { apiRequest } from './client';

export enum InsightType {
  TREND_SUMMARY = 'TREND_SUMMARY',
  RESULT_EXPLANATION = 'RESULT_EXPLANATION',
  DATA_CHANGE = 'DATA_CHANGE',
  REFERENCE_RANGE_CONTEXT = 'REFERENCE_RANGE_CONTEXT',
  GENERAL_HEALTH_INFORMATION = 'GENERAL_HEALTH_INFORMATION',
  QUESTION_SUGGESTION = 'QUESTION_SUGGESTION',
  DATA_QUALITY_WARNING = 'DATA_QUALITY_WARNING',
}

export enum SafetyLevel {
  SAFE_INFORMATIONAL = 'SAFE_INFORMATIONAL',
  NEEDS_CONTEXT = 'NEEDS_CONTEXT',
  PROFESSIONAL_REVIEW_SUGGESTED = 'PROFESSIONAL_REVIEW_SUGGESTED',
  EMERGENCY_REDIRECT = 'EMERGENCY_REDIRECT',
  OUT_OF_SCOPE = 'OUT_OF_SCOPE',
}

export interface DataPoint {
  label: string;
  value: string;
  unit?: string;
  date?: string;
}

export interface DataReference {
  resultId: string;
  parameterCode?: string;
  date: string;
  value?: number;
  unit?: string;
}

export interface AiInsight {
  id: string;
  type: InsightType;
  title: string;
  summary: string;
  observations: string[];
  dataPoints?: DataPoint[];
  caveats: string[];
  questionsForProfessional?: string[];
  safetyLevel: SafetyLevel;
  generatedAt: string;
  dataVersion?: string;
  dataReferences?: DataReference[];
}

export interface ChatConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastMessage?: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  insight?: AiInsight;
}

export interface ChatResponse {
  conversation: ChatConversation;
  message: ChatMessage;
}

export interface GenerateInsightRequest {
  type: InsightType;
  resultId?: string;
  parameterCode?: string;
  from?: string;
  to?: string;
  question?: string;
}

export interface ExplainResultRequest {
  resultId: string;
}

export interface AnalyzeTrendRequest {
  parameterCode: string;
  from?: string;
  to?: string;
}

export interface SendChatRequest {
  conversationId?: string;
  message: string;
}

export async function generateInsight(request: GenerateInsightRequest): Promise<AiInsight> {
  const response = await apiRequest<{ data: AiInsight }>('/api/v1/me/ai/insights', {
    method: 'POST',
    body: JSON.stringify(request),
  });
  return response.data;
}

export async function explainResult(request: ExplainResultRequest): Promise<AiInsight> {
  const response = await apiRequest<{ data: AiInsight }>('/api/v1/me/ai/explain-result', {
    method: 'POST',
    body: JSON.stringify(request),
  });
  return response.data;
}

export async function analyzeTrend(request: AnalyzeTrendRequest): Promise<AiInsight> {
  const response = await apiRequest<{ data: AiInsight }>('/api/v1/me/ai/analyze-trend', {
    method: 'POST',
    body: JSON.stringify(request),
  });
  return response.data;
}

export async function sendChatMessage(request: SendChatRequest): Promise<ChatResponse> {
  const response = await apiRequest<{ data: ChatResponse }>('/api/v1/me/ai/chat', {
    method: 'POST',
    body: JSON.stringify(request),
  });
  return response.data;
}
