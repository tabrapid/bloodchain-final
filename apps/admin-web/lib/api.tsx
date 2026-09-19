import { apiRequest } from './client';

export interface PlatformStats {
  users: { total: number; active: number; verifiedDonors: number };
  organizations: { hospitals: number; bloodCenters: number; pending: number; suspended: number };
  couriers: number;
  bloodRequests: { active: number; critical: number };
  emergencies: { active: number };
  shipments: { active: number };
  todayActivity: { donations: number; appointments: number; bloodTests: number };
  alerts: { lowStock: number; criticalStock: number };
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  phone?: string;
  status: string;
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt?: string;
  roles: Array<{
    membershipId: string;
    role: string;
    organization: { id: string; name: string; type: string };
  }>;
  bloodType?: string;
  rhFactor?: string;
  donorStatus?: string;
}

export interface Role {
  id: string;
  code: string;
  name: string;
  permissions: string[];
}

export interface Permission {
  id: string;
  code: string;
  name: string;
}

export interface Organization {
  id: string;
  name: string;
  type: string;
  status: string;
  email?: string;
  phone?: string;
  address?: string;
  createdAt: string;
  staffCount: number;
}

export interface Courier {
  id: string;
  displayName: string;
  phone?: string;
  status: string;
  createdAt: string;
  lastLoginAt?: string;
  organization: { id: string; name: string; type: string };
  totalShipments: number;
}

export interface Shipment {
  id: string;
  shipmentReference: string;
  status: string;
  createdAt: string;
  pickedUpAt?: string;
  deliveredAt?: string;
  bloodRequest?: { id: string; requestReference: string; priority: string };
  source?: { id: string; name: string };
  destination?: { id: string; name: string };
  courier?: { id: string; displayName: string; phone?: string };
  unitsCount: number;
}

export interface BloodRequest {
  id: string;
  requestReference: string;
  status: string;
  priority: string;
  createdAt: string;
  expectedDeliveryDate?: string;
  requestingOrganization: { id: string; name: string };
  fulfillingOrganization?: { id: string; name: string };
  itemsCount: number;
}

export interface Emergency {
  id: string;
  bloodType: string;
  rhFactor: string;
  unitsRequired: number;
  unitsCollected: number;
  status: string;
  createdAt: string;
  requiredBefore?: string;
  hospital: { id: string; name: string; address?: string };
  responseCount: number;
}

export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: string;
  actor?: { id: string; name: string; email: string };
  organization?: { id: string; name: string };
}

export interface ContentReport {
  id: string;
  reason: string;
  description?: string;
  status: string;
  createdAt: string;
  reviewedAt?: string;
  resolution?: string;
  post: { id: string; type: string; title: string; body: string; status: string };
  reporter: { id: string; firstName: string; lastName: string; email: string };
  reviewer?: { id: string; firstName: string; lastName: string; email: string };
}

export interface ContentReportDetail extends ContentReport {
  post: ContentReport['post'] & {
    imageUrl?: string;
    author?: { id: string; firstName: string; lastName: string; email: string };
  };
  otherReportsOnPost: Array<{ id: string; reason: string; status: string; createdAt: string }>;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export async function getDashboard(startDate?: string, endDate?: string): Promise<PlatformStats> {
  const params = new URLSearchParams();
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);
  const query = params.toString();
  return apiRequest<PaginatedResponse<never> & PlatformStats>(`/admin/dashboard${query ? `?${query}` : ''}`);
}

export async function getActivityFeed(limit = 50, offset = 0): Promise<any[]> {
  return apiRequest<any[]>(`/admin/activity?limit=${limit}&offset=${offset}`);
}

export async function listUsers(params: {
  page?: number;
  limit?: number;
  role?: string;
  status?: string;
  search?: string;
}): Promise<PaginatedResponse<User>> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.role) searchParams.set('role', params.role);
  if (params.status) searchParams.set('status', params.status);
  if (params.search) searchParams.set('search', params.search);
  const query = searchParams.toString();
  return apiRequest<PaginatedResponse<User>>(`/admin/users${query ? `?${query}` : ''}`);
}

export async function getUser(id: string): Promise<User> {
  return apiRequest<User>(`/admin/users/${id}`);
}

export async function suspendUser(id: string, reason?: string): Promise<{ id: string; status: string }> {
  return apiRequest<{ id: string; status: string }>(`/admin/users/${id}/suspend`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function restoreUser(id: string): Promise<{ id: string; status: string }> {
  return apiRequest<{ id: string; status: string }>(`/admin/users/${id}/restore`, {
    method: 'POST',
  });
}

export async function listRoles(): Promise<Role[]> {
  return apiRequest<Role[]>('/admin/roles');
}

export async function listPermissions(): Promise<Permission[]> {
  return apiRequest<Permission[]>('/admin/permissions');
}

export async function updateRolePermissions(roleId: string, permissionCodes: string[]): Promise<Role> {
  return apiRequest<Role>(`/admin/roles/${roleId}/permissions`, {
    method: 'PATCH',
    body: JSON.stringify({ permissionCodes }),
  });
}

export async function updateMembershipRole(
  membershipId: string,
  roleId: string,
): Promise<{ id: string; userId: string; organizationId: string; role: string }> {
  return apiRequest(`/admin/memberships/${membershipId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ roleId }),
  });
}

export async function listOrganizations(params: {
  page?: number;
  limit?: number;
  type?: string;
  status?: string;
  search?: string;
}): Promise<PaginatedResponse<Organization>> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.type) searchParams.set('type', params.type);
  if (params.status) searchParams.set('status', params.status);
  if (params.search) searchParams.set('search', params.search);
  const query = searchParams.toString();
  return apiRequest<PaginatedResponse<Organization>>(`/admin/organizations${query ? `?${query}` : ''}`);
}

export async function getOrganization(id: string): Promise<any> {
  return apiRequest<any>(`/admin/organizations/${id}`);
}

export async function verifyOrganization(id: string, notes?: string): Promise<{ id: string; status: string }> {
  return apiRequest<{ id: string; status: string }>(`/admin/organizations/${id}/verify`, {
    method: 'POST',
    body: JSON.stringify({ notes }),
  });
}

export async function rejectOrganization(id: string, reason: string): Promise<{ id: string; status: string }> {
  return apiRequest<{ id: string; status: string }>(`/admin/organizations/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function suspendOrganization(id: string, reason?: string): Promise<{ id: string; status: string }> {
  return apiRequest<{ id: string; status: string }>(`/admin/organizations/${id}/suspend`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function restoreOrganization(id: string): Promise<{ id: string; status: string }> {
  return apiRequest<{ id: string; status: string }>(`/admin/organizations/${id}/restore`, {
    method: 'POST',
  });
}

/**
 * Geography and the organization directory.
 *
 * Deliberately not under `/admin`: the directory is the same data donors see,
 * and a second admin-only copy of it would drift from the one that is actually
 * on the booking screen.
 *
 * `verifyOrganization` above is a different thing with a similar name -- it
 * approves a PENDING_APPROVAL *registration*. This is the directory's trust
 * badge on an organization that is already active.
 */
export type GeoDataSource = 'OFFICIAL_REFERENCE' | 'DEMO';

export interface Region {
  id: string;
  code: string;
  nameUz: string;
  nameRu: string;
  nameEn: string;
  centerEn?: string | null;
  source: GeoDataSource;
  districtCount: number;
}

export interface District {
  id: string;
  code: string;
  regionId: string;
  nameUz: string;
  nameRu: string;
  nameEn: string;
  source: GeoDataSource;
}

export interface GeographyCoverage {
  regions: { total: number; official: number; demo: number };
  districts: { total: number; official: number; demo: number };
  districtsAuthoritative: boolean;
  regionStandard: string;
}

export interface DirectoryPlace {
  id: string;
  code: string;
  nameUz: string;
  nameRu: string;
  nameEn: string;
  source: GeoDataSource;
}

export interface DirectoryOrganization {
  id: string;
  type: string;
  name: string;
  address: string | null;
  directionsNote: string | null;
  publicPhone: string | null;
  latitude: string | number | null;
  longitude: string | number | null;
  status: string;
  acceptsDonations: boolean;
  providesLaboratory: boolean;
  verifiedAt: string | null;
  isVerified: boolean;
  isDemo: boolean;
  region: DirectoryPlace | null;
  district: DirectoryPlace | null;
  services: Array<{ service: string; note: string | null }>;
  hours: Array<{ dayOfWeek: number; opensAt: string | null; closesAt: string | null; isClosed: boolean }>;
}

export async function listRegions(): Promise<Region[]> {
  return apiRequest<Region[]>('/geography/regions');
}

export async function listDistricts(regionId?: string): Promise<District[]> {
  const query = regionId ? `?regionId=${encodeURIComponent(regionId)}` : '';
  return apiRequest<District[]>(`/geography/districts${query}`);
}

export async function getGeographyCoverage(): Promise<GeographyCoverage> {
  return apiRequest<GeographyCoverage>('/geography/coverage');
}

export async function getDirectoryEntry(id: string): Promise<DirectoryOrganization> {
  return apiRequest<DirectoryOrganization>(`/organizations/${encodeURIComponent(id)}`);
}

export async function setDirectoryVerification(
  id: string,
  verified: boolean,
): Promise<DirectoryOrganization> {
  return apiRequest<DirectoryOrganization>(
    `/organizations/${encodeURIComponent(id)}/verification`,
    { method: 'PATCH', body: JSON.stringify({ verified }) },
  );
}

/**
 * The name to show, in the locale the portal is running in. Place names are
 * data in three columns, not catalogue keys: neither the Uzbek nor the Russian
 * name is a translation of the other.
 */
export function geoName(
  place: { nameUz: string; nameRu: string; nameEn: string },
  locale: string,
): string {
  if (locale.startsWith('uz')) return place.nameUz || place.nameEn;
  if (locale.startsWith('ru')) return place.nameRu || place.nameEn;
  return place.nameEn;
}

export async function listCouriers(params: {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}): Promise<PaginatedResponse<Courier>> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.status) searchParams.set('status', params.status);
  if (params.search) searchParams.set('search', params.search);
  const query = searchParams.toString();
  return apiRequest<PaginatedResponse<Courier>>(`/admin/couriers${query ? `?${query}` : ''}`);
}

export async function getCourier(id: string): Promise<any> {
  return apiRequest<any>(`/admin/couriers/${id}`);
}

export async function suspendCourier(id: string, reason?: string): Promise<{ id: string; status: string }> {
  return apiRequest<{ id: string; status: string }>(`/admin/couriers/${id}/suspend`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function restoreCourier(id: string): Promise<{ id: string; status: string }> {
  return apiRequest<{ id: string; status: string }>(`/admin/couriers/${id}/restore`, {
    method: 'POST',
  });
}

export async function search(query: string, type?: string): Promise<PaginatedResponse<any>> {
  const params = new URLSearchParams();
  if (query) params.set('query', query);
  if (type) params.set('type', type);
  return apiRequest<PaginatedResponse<any>>(`/admin/search?${params.toString()}`);
}

export async function listAuditLogs(params: {
  page?: number;
  limit?: number;
  action?: string;
  entityType?: string;
}): Promise<PaginatedResponse<AuditLog>> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.action) searchParams.set('action', params.action);
  if (params.entityType) searchParams.set('entityType', params.entityType);
  const query = searchParams.toString();
  return apiRequest<PaginatedResponse<AuditLog>>(`/admin/audit-logs${query ? `?${query}` : ''}`);
}

export async function listShipments(params: {
  page?: number;
  limit?: number;
  status?: string;
}): Promise<PaginatedResponse<Shipment>> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.status) searchParams.set('status', params.status);
  const query = searchParams.toString();
  return apiRequest<PaginatedResponse<Shipment>>(`/admin/shipments${query ? `?${query}` : ''}`);
}

export async function getShipment(id: string): Promise<any> {
  return apiRequest<any>(`/admin/shipments/${id}`);
}

export async function listBloodRequests(params: {
  page?: number;
  limit?: number;
  status?: string;
  priority?: string;
}): Promise<PaginatedResponse<BloodRequest>> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.status) searchParams.set('status', params.status);
  if (params.priority) searchParams.set('priority', params.priority);
  const query = searchParams.toString();
  return apiRequest<PaginatedResponse<BloodRequest>>(`/admin/blood-requests${query ? `?${query}` : ''}`);
}

export async function listEmergencies(params: {
  page?: number;
  limit?: number;
  status?: string;
}): Promise<PaginatedResponse<Emergency>> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.status) searchParams.set('status', params.status);
  const query = searchParams.toString();
  return apiRequest<PaginatedResponse<Emergency>>(`/admin/emergencies${query ? `?${query}` : ''}`);
}

export async function listContentReports(params: {
  page?: number;
  limit?: number;
  status?: string;
  reason?: string;
}): Promise<PaginatedResponse<ContentReport>> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.status) searchParams.set('status', params.status);
  if (params.reason) searchParams.set('reason', params.reason);
  const query = searchParams.toString();
  return apiRequest<PaginatedResponse<ContentReport>>(`/admin/content-reports${query ? `?${query}` : ''}`);
}

export async function getContentReport(id: string): Promise<ContentReportDetail> {
  return apiRequest<ContentReportDetail>(`/admin/content-reports/${id}`);
}

export async function resolveContentReport(
  id: string,
  action: 'DISMISS' | 'HIDE' | 'REMOVE',
  resolution?: string,
): Promise<ContentReport> {
  return apiRequest<ContentReport>(`/admin/content-reports/${id}/resolve`, {
    method: 'POST',
    body: JSON.stringify({ action, resolution }),
  });
}

export async function getInventoryOverview(): Promise<any> {
  return apiRequest<any>('/admin/inventory/overview');
}

/**
 * Aggregate stock at every active blood centre, grouped by centre and group.
 *
 * `GET /blood-availability` has existed since the inventory module shipped and
 * no client called it. It deliberately exposes only type, component and
 * quantity -- never unit identifiers or storage locations -- because this is
 * an operational view for the people who route requests between organisations,
 * not a public stock ticker.
 */
export interface BloodAvailabilityRow {
  organization: { id: string; name: string };
  bloodType: string;
  rhFactor: string;
  componentType: string;
  totalUnits: number;
  totalVolumeMl: number;
}

export async function getBloodAvailability(
  filters: { bloodType?: string; rhFactor?: string; componentType?: string } = {},
): Promise<BloodAvailabilityRow[]> {
  const searchParams = new URLSearchParams();
  if (filters.bloodType) searchParams.set('bloodType', filters.bloodType);
  if (filters.rhFactor) searchParams.set('rhFactor', filters.rhFactor);
  if (filters.componentType) searchParams.set('componentType', filters.componentType);
  const query = searchParams.toString();
  return apiRequest<BloodAvailabilityRow[]>(`/blood-availability${query ? `?${query}` : ''}`);
}

export async function listAlerts(params: {
  page?: number;
  limit?: number;
  acknowledged?: string;
}): Promise<PaginatedResponse<any>> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.acknowledged) searchParams.set('acknowledged', params.acknowledged);
  const query = searchParams.toString();
  return apiRequest<PaginatedResponse<any>>(`/admin/alerts${query ? `?${query}` : ''}`);
}

export async function acknowledgeAlert(id: string, notes?: string): Promise<any> {
  return apiRequest<any>(`/admin/alerts/${id}/acknowledge`, {
    method: 'POST',
    body: JSON.stringify({ notes }),
  });
}

export interface SystemHealth {
  status: string;
  database: string;
  version: string;
  timestamp: string;
  pending: { organizations: number; couriers: number };
  alerts: number;
  recentErrors: number;
}

export async function getSystemHealth(): Promise<SystemHealth> {
  return apiRequest<SystemHealth>('/admin/health');
}

export interface PlatformSettings {
  id: string;
  sessionTimeoutMinutes: number;
  aiHealthInsightsEnabled: boolean;
  sosEmergencyEnabled: boolean;
  gamificationEnabled: boolean;
  pushNotificationsEnabled: boolean;
  maintenanceMode: boolean;
  updatedAt: string;
  updatedById: string | null;
}

export type PlatformSettingsPatch = Partial<
  Omit<PlatformSettings, 'id' | 'updatedAt' | 'updatedById'>
>;

export async function getPlatformSettings(): Promise<PlatformSettings> {
  return apiRequest<PlatformSettings>('/admin/settings');
}

export async function updatePlatformSettings(patch: PlatformSettingsPatch): Promise<PlatformSettings> {
  return apiRequest<PlatformSettings>('/admin/settings', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}
