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

export async function getInventoryOverview(): Promise<any> {
  return apiRequest<any>('/admin/inventory/overview');
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

export async function getSystemHealth(): Promise<any> {
  return apiRequest<any>('/admin/health');
}
