import { ApiRequestError, apiRequest } from './api-client';

export { ApiRequestError };

export enum DateRangeType {
  TODAY = 'TODAY',
  YESTERDAY = 'YESTERDAY',
  LAST_7_DAYS = 'LAST_7_DAYS',
  LAST_30_DAYS = 'LAST_30_DAYS',
  LAST_90_DAYS = 'LAST_90_DAYS',
  THIS_MONTH = 'THIS_MONTH',
  LAST_MONTH = 'LAST_MONTH',
  THIS_YEAR = 'THIS_YEAR',
  CUSTOM = 'CUSTOM',
}

export interface AnalyticsFilter {
  range?: DateRangeType;
  startDate?: string;
  endDate?: string;
  timezone?: string;
  bloodType?: string;
  rhFactor?: string;
  componentType?: string;
  status?: string;
  urgencyLevel?: string;
}

export interface KpiDto {
  value: number;
  previousValue: number | null;
  changePercent: number | null;
  trend: 'up' | 'down' | 'stable' | 'new';
  label: string;
}

export interface BloodGroupCountDto {
  bloodGroup: string;
  rhFactor: string;
  fullName: string;
  count: number;
  percent: number;
}

export interface TimeSeriesDataPointDto {
  date: string;
  value: number;
}

export interface StatusCountDto {
  status: string;
  count: number;
  percent: number;
}

export interface OverviewAnalytics {
  inventory: {
    totalUnits: number;
    availableUnits: number;
    reservedUnits: number;
    quarantinedUnits: number;
    lowStockGroups: string[];
    criticalGroups: string[];
    lastUpdated: string;
  };
  donations: {
    total: KpiDto;
    completed: KpiDto;
    cancelled: KpiDto;
    byBloodGroup: BloodGroupCountDto[];
  };
  emergencies: {
    total: KpiDto;
    active: KpiDto;
    completed: KpiDto;
    avgResponseTime: number | null;
    acceptanceRate: number | null;
  };
  appointments: {
    total: KpiDto;
    completed: KpiDto;
    cancelled: KpiDto;
    noShow: KpiDto;
    completionRate: number | null;
  };
  requests: {
    total: KpiDto;
    pending: KpiDto;
    fulfilled: KpiDto;
    fulfillmentRate: number | null;
  };
  alerts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export interface InventoryAnalytics {
  byBloodGroup: BloodGroupCountDto[];
  byComponent: Array<{ componentType: string; count: number; available: number; reserved: number }>;
  byStatus: StatusCountDto[];
  timeSeries: TimeSeriesDataPointDto[];
  summary: {
    totalUnits: number;
    availableUnits: number;
    reservedUnits: number;
    quarantinedUnits: number;
    expiredUnits: number;
    lowStockThreshold: number;
    criticalThreshold: number;
  };
}

export interface DonationAnalytics {
  byBloodGroup: BloodGroupCountDto[];
  byStatus: StatusCountDto[];
  byAppointmentType: Array<{ type: string; count: number }>;
  timeSeries: TimeSeriesDataPointDto[];
  summary: {
    total: number;
    completed: number;
    cancelled: number;
    noShows: number;
    completionRate: number | null;
  };
}

export interface EmergencyAnalytics {
  byStatus: StatusCountDto[];
  byUrgency: Array<{ urgencyLevel: string; count: number }>;
  byBloodGroup: BloodGroupCountDto[];
  timeSeries: TimeSeriesDataPointDto[];
  summary: {
    total: number;
    active: number;
    completed: number;
    cancelled: number;
    expired: number;
    avgResponseTimeMinutes: number | null;
    acceptanceRate: number | null;
  };
}

export interface AppointmentAnalytics {
  byStatus: StatusCountDto[];
  byType: Array<{ appointmentType: string; count: number }>;
  byBloodType: BloodGroupCountDto[];
  timeSeries: TimeSeriesDataPointDto[];
  summary: {
    total: number;
    completed: number;
    cancelled: number;
    noShows: number;
    completionRate: number | null;
  };
}

export interface RequestAnalytics {
  byStatus: StatusCountDto[];
  byBloodGroup: BloodGroupCountDto[];
  byUrgency: Array<{ urgencyLevel: string; count: number }>;
  timeSeries: TimeSeriesDataPointDto[];
  summary: {
    total: number;
    pending: number;
    fulfilled: number;
    partial: number;
    cancelled: number;
    fulfillmentRate: number | null;
  };
}

export interface ActivityItem {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface AlertItem {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  message: string;
  createdAt: string;
  acknowledged: boolean;
}

export async function getOverviewAnalytics(
  organizationId: string,
  filters?: AnalyticsFilter
): Promise<OverviewAnalytics> {
  const params = new URLSearchParams();
  if (filters?.range) params.append('range', filters.range);
  if (filters?.startDate) params.append('startDate', filters.startDate);
  if (filters?.endDate) params.append('endDate', filters.endDate);
  if (filters?.timezone) params.append('timezone', filters.timezone);
  if (filters?.bloodType) params.append('bloodType', filters.bloodType);
  if (filters?.rhFactor) params.append('rhFactor', filters.rhFactor);

  const queryString = params.toString();
  const endpoint = `/organizations/${organizationId}/analytics/overview${queryString ? `?${queryString}` : ''}`;

  return apiRequest<OverviewAnalytics>(endpoint);
}

export async function getInventoryAnalytics(
  organizationId: string,
  filters?: AnalyticsFilter
): Promise<InventoryAnalytics> {
  const params = new URLSearchParams();
  if (filters?.range) params.append('range', filters.range);
  if (filters?.startDate) params.append('startDate', filters.startDate);
  if (filters?.endDate) params.append('endDate', filters.endDate);
  if (filters?.componentType) params.append('componentType', filters.componentType);
  if (filters?.status) params.append('status', filters.status);

  const queryString = params.toString();
  const endpoint = `/organizations/${organizationId}/analytics/inventory${queryString ? `?${queryString}` : ''}`;

  return apiRequest<InventoryAnalytics>(endpoint);
}

export async function getDonationAnalytics(
  organizationId: string,
  filters?: AnalyticsFilter
): Promise<DonationAnalytics> {
  const params = new URLSearchParams();
  if (filters?.range) params.append('range', filters.range);
  if (filters?.startDate) params.append('startDate', filters.startDate);
  if (filters?.endDate) params.append('endDate', filters.endDate);
  if (filters?.bloodType) params.append('bloodType', filters.bloodType);
  if (filters?.rhFactor) params.append('rhFactor', filters.rhFactor);

  const queryString = params.toString();
  const endpoint = `/organizations/${organizationId}/analytics/donations${queryString ? `?${queryString}` : ''}`;

  return apiRequest<DonationAnalytics>(endpoint);
}

export async function getEmergencyAnalytics(
  organizationId: string,
  filters?: AnalyticsFilter
): Promise<EmergencyAnalytics> {
  const params = new URLSearchParams();
  if (filters?.range) params.append('range', filters.range);
  if (filters?.startDate) params.append('startDate', filters.startDate);
  if (filters?.endDate) params.append('endDate', filters.endDate);
  if (filters?.urgencyLevel) params.append('urgencyLevel', filters.urgencyLevel);

  const queryString = params.toString();
  const endpoint = `/organizations/${organizationId}/analytics/emergencies${queryString ? `?${queryString}` : ''}`;

  return apiRequest<EmergencyAnalytics>(endpoint);
}

export async function getAppointmentAnalytics(
  organizationId: string,
  filters?: AnalyticsFilter
): Promise<AppointmentAnalytics> {
  const params = new URLSearchParams();
  if (filters?.range) params.append('range', filters.range);
  if (filters?.startDate) params.append('startDate', filters.startDate);
  if (filters?.endDate) params.append('endDate', filters.endDate);

  const queryString = params.toString();
  const endpoint = `/organizations/${organizationId}/analytics/appointments${queryString ? `?${queryString}` : ''}`;

  return apiRequest<AppointmentAnalytics>(endpoint);
}

export async function getRequestAnalytics(
  organizationId: string,
  filters?: AnalyticsFilter
): Promise<RequestAnalytics> {
  const params = new URLSearchParams();
  if (filters?.range) params.append('range', filters.range);
  if (filters?.startDate) params.append('startDate', filters.startDate);
  if (filters?.endDate) params.append('endDate', filters.endDate);
  if (filters?.urgencyLevel) params.append('urgencyLevel', filters.urgencyLevel);

  const queryString = params.toString();
  const endpoint = `/organizations/${organizationId}/analytics/requests${queryString ? `?${queryString}` : ''}`;

  return apiRequest<RequestAnalytics>(endpoint);
}

export async function getActivityFeed(
  organizationId: string,
  limit = 20,
  offset = 0
): Promise<ActivityItem[]> {
  const params = new URLSearchParams();
  params.append('limit', limit.toString());
  params.append('offset', offset.toString());

  const endpoint = `/organizations/${organizationId}/analytics/activity?${params.toString()}`;
  return apiRequest<ActivityItem[]>(endpoint);
}

export async function getAlerts(organizationId: string): Promise<AlertItem[]> {
  const endpoint = `/organizations/${organizationId}/analytics/alerts`;
  return apiRequest<AlertItem[]>(endpoint);
}
