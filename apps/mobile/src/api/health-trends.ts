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
  const response = await apiRequest<{ data: TrendSummary }>(
    `/api/v1/me/health-trends${query ? `?${query}` : ''}`,
  );
  return response.data;
}

export async function getAvailableParameters(): Promise<AvailableParameter[]> {
  const response = await apiRequest<{ data: AvailableParameter[] }>(
    '/api/v1/me/health-trends/parameters',
  );
  return response.data;
}

export async function getParameterTrend(
  parameter: string,
  options?: { range?: string; from?: string; to?: string; category?: string; laboratory?: string },
): Promise<TrendData | null> {
  const params = new URLSearchParams({ parameter, ...options });
  const response = await apiRequest<{ data: TrendData | null }>(
    `/api/v1/me/health-trends/${parameter}?${params.toString()}`,
  );
  return response.data;
}

export async function getParameterStatistics(parameter: string): Promise<ParameterStatistics | null> {
  const response = await apiRequest<{ data: ParameterStatistics | null }>(
    `/api/v1/me/health-trends/${parameter}/statistics`,
  );
  return response.data;
}

export async function getParameterHistory(
  parameter: string,
  limit = 20,
  offset = 0,
): Promise<TrendHistoryResponse | null> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  const response = await apiRequest<{ data: TrendHistoryResponse | null }>(
    `/api/v1/me/health-trends/${parameter}/history?${params.toString()}`,
  );
  return response.data;
}
