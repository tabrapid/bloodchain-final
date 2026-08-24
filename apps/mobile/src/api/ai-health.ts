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

export enum FeedbackType {
  HELPFUL = 'HELPFUL',
  NOT_HELPFUL = 'NOT_HELPFUL',
  REPORT_ISSUE = 'REPORT_ISSUE',
}

export interface SubmitFeedbackRequest {
  insightId: string;
  type: FeedbackType;
  reason?: string;
}

export interface FeedbackResponse {
  id: string;
  userId: string;
  insightId: string;
  type: FeedbackType;
  reason?: string | null;
  createdAt: string;
}

export interface AIConversationSummary {
  id: string;
  title: string | null;
  contextType: string | null;
  lastMessageAt: string | null;
  messageCount: number;
  createdAt: string;
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

export async function submitFeedback(request: SubmitFeedbackRequest): Promise<FeedbackResponse> {
  const response = await apiRequest<{ data: FeedbackResponse }>('/api/v1/me/ai/feedback', {
    method: 'POST',
    body: JSON.stringify(request),
  });
  return response.data;
}

export async function getInsightHistory(options?: {
  type?: InsightType;
  limit?: number;
  offset?: number;
}): Promise<{ insights: AiInsight[]; total: number }> {
  const params = new URLSearchParams();
  if (options?.type) params.set('type', options.type);
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.offset) params.set('offset', String(options.offset));

  const response = await apiRequest<{ data: { insights: AiInsight[]; total: number } }>(
    `/api/v1/me/ai/history${params.toString() ? `?${params.toString()}` : ''}`,
  );
  return response.data;
}

export async function getInsight(id: string): Promise<AiInsight> {
  const response = await apiRequest<{ data: AiInsight }>(`/api/v1/me/ai/history/${id}`);
  return response.data;
}

export async function deleteInsight(id: string): Promise<void> {
  await apiRequest(`/api/v1/me/ai/history/${id}`, { method: 'DELETE' });
}

export async function getConversations(options?: {
  limit?: number;
  offset?: number;
}): Promise<AIConversationSummary[]> {
  const params = new URLSearchParams();
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.offset) params.set('offset', String(options.offset));

  const response = await apiRequest<{ data: AIConversationSummary[] }>(
    `/api/v1/me/ai/conversations${params.toString() ? `?${params.toString()}` : ''}`,
  );
  return response.data;
}

export async function getConversationDetail(id: string): Promise<{
  id: string;
  title: string | null;
  contextType: string | null;
  contextId: string | null;
  messages: Array<{
    id: string;
    role: string;
    content: string;
    safetyLevel: string | null;
    createdAt: string;
  }>;
}> {
  const response = await apiRequest<{ data: any }>(`/api/v1/me/ai/conversations/${id}`);
  return response.data;
}

export async function deleteConversation(id: string): Promise<void> {
  await apiRequest(`/api/v1/me/ai/conversations/${id}`, { method: 'DELETE' });
}
