import { apiRequest } from './client';

export interface TrendPoint {
  date: string;
  value: number;
  unit?: string;
  referenceMin?: number;
  referenceMax?: number;
  laboratoryId?: string;
  laboratoryName?: string;
  resultId?: string;
  flag?: string;
}

export interface TrendData {
  parameterCode: string;
  parameterName: string;
  unit?: string;
  category?: string;
  latestValue: number;
  latestValueDate?: string;
  latestValueLaboratory?: string;
  previousValue?: number;
  previousValueDate?: string;
  absoluteChange?: number;
  percentageChange?: number;
  referenceMin?: number;
  referenceMax?: number;
  trend: 'INCREASING' | 'DECREASING' | 'STABLE' | 'INSUFFICIENT_DATA';
  points: TrendPoint[];
  hasReferenceRange: boolean;
}

export interface ParameterStatistics {
  parameterCode: string;
  parameterName: string;
  unit?: string;
  measurementCount: number;
  latest?: number;
  latestDate?: string;
  minimum?: number;
  minimumDate?: string;
  maximum?: number;
  maximumDate?: string;
  average?: number;
  firstValue?: number;
  firstDate?: string;
  latestLaboratory?: string;
}

export interface AvailableParameter {
  code: string;
  name: string;
  unit?: string;
  category: string;
  measurementCount: number;
  latestValue?: number;
  latestValueDate?: string;
  hasReferenceRange?: boolean;
}

export interface TrendHistoryItem {
  date: string;
  value: number;
  unit?: string;
  laboratoryId?: string;
  laboratoryName?: string;
  resultId?: string;
  testTypeName?: string;
  referenceMin?: number;
  referenceMax?: number;
  flag?: string;
}

export interface TrendHistoryResponse {
  parameterCode: string;
  parameterName: string;
  unit?: string;
  hasReferenceRange: boolean;
  referenceMin?: number;
  referenceMax?: number;
  history: TrendHistoryItem[];
  total: number;
}

export interface TrendSummary {
  totalTests: number;
  totalParameters?: number;
  lastTestDate?: string;
  lastTestLaboratory?: string;
  nextUpcomingAppointment?: string;
  availableParameters: AvailableParameter[];
  recentTrend?: TrendData;
}

export async function getTrendSummary(range?: string): Promise<TrendSummary> {
  const params = new URLSearchParams();
  if (range) {
    params.set('range', range);
  }
  const query = params.toString();
  return apiRequest<TrendSummary>(
    `/api/v1/me/health-trends${query ? `?${query}` : ''}`,
  );
}

export async function getAvailableParameters(): Promise<AvailableParameter[]> {
  return apiRequest<AvailableParameter[]>('/api/v1/me/health-trends/parameters');
}

export async function getParameterTrend(
  parameter: string,
  options?: { range?: string; from?: string; to?: string; category?: string; laboratory?: string },
): Promise<TrendData | null> {
  const params = new URLSearchParams({ parameter, ...options });
  return apiRequest<TrendData | null>(
    `/api/v1/me/health-trends/${parameter}?${params.toString()}`,
  );
}

export async function getParameterStatistics(parameter: string): Promise<ParameterStatistics | null> {
  return apiRequest<ParameterStatistics | null>(
    `/api/v1/me/health-trends/${parameter}/statistics`,
  );
}

export async function getParameterHistory(
  parameter: string,
  limit = 20,
  offset = 0,
): Promise<TrendHistoryResponse | null> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  return apiRequest<TrendHistoryResponse | null>(
    `/api/v1/me/health-trends/${parameter}/history?${params.toString()}`,
  );
}
