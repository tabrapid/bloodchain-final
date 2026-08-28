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

/**
 * What every `get*Trends` backend method actually returns — a day-bucketed
 * series plus its own total, not a bare array (see P0-14).
 */
export interface TrendsDto {
  data: TimeSeriesDataPointDto[];
  period: string;
  total: number;
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
  trends: TrendsDto;
  summary: {
    totalUnits: number;
    availableUnits: number;
    reservedUnits: number;
    quarantinedUnits: number;
    expiredUnits: number;
    lowStockGroups: string[];
    criticalGroups: string[];
  };
}

export interface DonationAnalytics {
  byBloodGroup: BloodGroupCountDto[];
  byStatus: StatusCountDto[];
  trends: TrendsDto;
  summary: {
    total: number;
    completed: number;
    cancelled: number;
    noShows: number;
    completionRate: number | null;
    totalVolumeMl: number;
    avgVolumeMl: number;
  };
}

export interface LaboratoryAnalytics {
  byStatus: StatusCountDto[];
  trends: TrendsDto;
  summary: {
    totalTests: number;
    pendingTests: number;
    completedTests: number;
    avgProcessingTimeHours: number | null;
  };
}

export interface ShipmentAnalytics {
  byStatus: StatusCountDto[];
  trends: TrendsDto;
  summary: {
    total: number;
    active: number;
    delivered: number;
    delayed: number;
    failed: number;
    avgDeliveryTimeHours: number | null;
    avgPickupTimeHours: number | null;
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
  priority: 'CRITICAL' | 'HIGH';
  title: string;
  message: string;
  sourceType: string;
  sourceId: string;
  status: 'OPEN' | 'ACKNOWLEDGED';
  createdAt: string;
}

/**
 * `getAlerts` always queries `acknowledged: false`, so `alerts` is already
 * every open alert; `critical`/`high`/`medium`/`low`/`total` are its own
 * pre-computed counts (`medium`/`low` are hardcoded 0 today — there is no
 * inventory alert type mapped to either priority yet).
 */
export interface AlertsResponse {
  alerts: AlertItem[];
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
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

export async function getLaboratoryAnalytics(
  organizationId: string,
  filters?: AnalyticsFilter
): Promise<LaboratoryAnalytics> {
  const params = new URLSearchParams();
  if (filters?.range) params.append('range', filters.range);
  if (filters?.startDate) params.append('startDate', filters.startDate);
  if (filters?.endDate) params.append('endDate', filters.endDate);
  if (filters?.bloodType) params.append('bloodType', filters.bloodType);

  const queryString = params.toString();
  const endpoint = `/organizations/${organizationId}/analytics/laboratory${queryString ? `?${queryString}` : ''}`;

  return apiRequest<LaboratoryAnalytics>(endpoint);
}

export async function getShipmentAnalytics(
  organizationId: string,
  filters?: AnalyticsFilter
): Promise<ShipmentAnalytics> {
  const params = new URLSearchParams();
  if (filters?.range) params.append('range', filters.range);
  if (filters?.startDate) params.append('startDate', filters.startDate);
  if (filters?.endDate) params.append('endDate', filters.endDate);

  const queryString = params.toString();
  const endpoint = `/organizations/${organizationId}/analytics/shipments${queryString ? `?${queryString}` : ''}`;

  return apiRequest<ShipmentAnalytics>(endpoint);
}

export interface ActivityFeedResponse {
  items: ActivityItem[];
  total: number;
}

export async function getActivityFeed(
  organizationId: string,
  limit = 20,
  offset = 0
): Promise<ActivityFeedResponse> {
  const params = new URLSearchParams();
  params.append('limit', limit.toString());
  params.append('offset', offset.toString());

  const endpoint = `/organizations/${organizationId}/analytics/activity?${params.toString()}`;
  return apiRequest<ActivityFeedResponse>(endpoint);
}

export async function getAlerts(organizationId: string): Promise<AlertsResponse> {
  const endpoint = `/organizations/${organizationId}/analytics/alerts`;
  return apiRequest<AlertsResponse>(endpoint);
}
