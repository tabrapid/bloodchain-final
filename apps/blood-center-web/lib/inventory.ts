import { ApiRequestError, apiRequest, apiRequestEnvelope } from './api-client';

export { ApiRequestError };

export interface InventorySummary {
  totalUnits: number;
  availableUnits: number;
  quarantinedUnits: number;
  expiredUnits: number;
  reservedUnits: number;
  byBloodType: Record<string, number>;
  byStatus: Record<string, number>;
}

export interface InventoryUnit {
  id: string;
  unitReference: string;
  bloodType: string;
  rhFactor: string;
  componentType: string;
  volumeMl: number;
  status: string;
  location?: { id: string; name: string; code: string; type: string };
  collectedAt: string;
  expiresAt?: string;
  donationReference?: string;
  createdAt: string;
}

export interface InventoryLocation {
  id: string;
  name: string;
  code: string;
  type: string;
  active: boolean;
}

export interface InventoryMovement {
  id: string;
  bloodUnitId: string;
  type: string;
  fromLocationId?: string;
  toLocationId?: string;
  reason?: string;
  actorId: string;
  createdAt: string;
  fromLocation?: { id: string; name: string; code: string };
  toLocation?: { id: string; name: string; code: string };
}

export interface InventoryReservation {
  id: string;
  bloodUnitId: string;
  status: string;
  reservedForOrganizationId: string;
  expiresAt: string;
  createdAt: string;
  bloodUnit?: InventoryUnit;
}

export interface InventoryAlert {
  id: string;
  type: string;
  bloodType?: string;
  rhFactor?: string;
  message: string;
  threshold?: number;
  acknowledged: boolean;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface GetInventoryParams {
  bloodType?: string;
  rhFactor?: string;
  componentType?: string;
  status?: string;
  locationId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface MoveUnitParams {
  toLocationId: string;
  reason?: string;
}

export interface CreateLocationParams {
  name: string;
  code: string;
  type?: string;
}

export interface UpdateLocationParams {
  name?: string;
  code?: string;
  type?: string;
  active?: boolean;
}

export function getInventorySummary(organizationId: string): Promise<InventorySummary> {
  return apiRequest(`/organizations/${organizationId}/inventory/summary`);
}

export async function getInventory(
  organizationId: string,
  params: GetInventoryParams = {},
): Promise<PaginatedResponse<InventoryUnit>> {
  const searchParams = new URLSearchParams();
  if (params.bloodType) searchParams.set('bloodType', params.bloodType);
  if (params.rhFactor) searchParams.set('rhFactor', params.rhFactor);
  if (params.componentType) searchParams.set('componentType', params.componentType);
  if (params.status) searchParams.set('status', params.status);
  if (params.locationId) searchParams.set('locationId', params.locationId);
  if (params.search) searchParams.set('search', params.search);
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));

  const query = searchParams.toString();
  // Not apiRequest: InventoryController carries no WrapResponseInterceptor,
  // so its service's own `{ data, meta }` return *is* the whole response
  // body — apiRequest's `.data`-only unwrap would silently discard `meta`
  // (the pagination totals this page's "N of M units" and page controls
  // need), the way it already discarded `data` itself before P0-12.
  const envelope = await apiRequestEnvelope<InventoryUnit[]>(
    `/organizations/${organizationId}/inventory${query ? `?${query}` : ''}`,
  );
  return { data: envelope.data ?? [], meta: envelope.meta as PaginatedResponse<InventoryUnit>['meta'] };
}

export function getUnit(organizationId: string, unitId: string): Promise<InventoryUnit> {
  return apiRequest(`/organizations/${organizationId}/inventory/units/${unitId}`);
}

export function moveUnit(
  organizationId: string,
  unitId: string,
  params: MoveUnitParams,
): Promise<InventoryUnit> {
  return apiRequest(`/organizations/${organizationId}/inventory/units/${unitId}/move`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export function quarantineUnit(
  organizationId: string,
  unitId: string,
  reason: string,
): Promise<InventoryUnit> {
  return apiRequest(`/organizations/${organizationId}/inventory/units/${unitId}/quarantine`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export function discardUnit(
  organizationId: string,
  unitId: string,
  reason: string,
): Promise<InventoryUnit> {
  return apiRequest(`/organizations/${organizationId}/inventory/units/${unitId}/discard`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export function releaseUnit(
  organizationId: string,
  unitId: string,
  locationId: string,
): Promise<InventoryUnit> {
  return apiRequest(`/organizations/${organizationId}/inventory/units/${unitId}/release`, {
    method: 'POST',
    body: JSON.stringify({ locationId }),
  });
}

export function issueUnit(
  organizationId: string,
  unitId: string,
  reason: string,
): Promise<InventoryUnit> {
  return apiRequest(`/organizations/${organizationId}/inventory/units/${unitId}/issue`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export interface AdjustUnitParams {
  reason: string;
  volumeMl?: number;
  componentType?: string;
  expiresAt?: string;
}

export function adjustUnit(
  organizationId: string,
  unitId: string,
  params: AdjustUnitParams,
): Promise<InventoryUnit> {
  return apiRequest(`/organizations/${organizationId}/inventory/units/${unitId}/adjust`, {
    method: 'PATCH',
    body: JSON.stringify(params),
  });
}

export function getLocations(organizationId: string): Promise<InventoryLocation[]> {
  return apiRequest(`/organizations/${organizationId}/inventory/locations`);
}

export function createLocation(
  organizationId: string,
  params: CreateLocationParams,
): Promise<InventoryLocation> {
  return apiRequest(`/organizations/${organizationId}/inventory/locations`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export function updateLocation(
  organizationId: string,
  locationId: string,
  params: UpdateLocationParams,
): Promise<InventoryLocation> {
  return apiRequest(`/organizations/${organizationId}/inventory/locations/${locationId}`, {
    method: 'PATCH',
    body: JSON.stringify(params),
  });
}

export async function getMovements(
  organizationId: string,
  params: { bloodUnitId?: string; page?: number; limit?: number } = {},
): Promise<PaginatedResponse<InventoryMovement>> {
  const searchParams = new URLSearchParams();
  if (params.bloodUnitId) searchParams.set('bloodUnitId', params.bloodUnitId);
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));

  const query = searchParams.toString();
  // See getInventory above: not apiRequest, for the same reason.
  const envelope = await apiRequestEnvelope<InventoryMovement[]>(
    `/organizations/${organizationId}/inventory/movements${query ? `?${query}` : ''}`,
  );
  return { data: envelope.data ?? [], meta: envelope.meta as PaginatedResponse<InventoryMovement>['meta'] };
}

export async function getReservations(
  organizationId: string,
  params: { status?: string; page?: number; limit?: number } = {},
): Promise<PaginatedResponse<InventoryReservation>> {
  const searchParams = new URLSearchParams();
  if (params.status) searchParams.set('status', params.status);
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));

  const query = searchParams.toString();
  // See getInventory above: not apiRequest, for the same reason.
  const envelope = await apiRequestEnvelope<InventoryReservation[]>(
    `/organizations/${organizationId}/inventory/reservations${query ? `?${query}` : ''}`,
  );
  return { data: envelope.data ?? [], meta: envelope.meta as PaginatedResponse<InventoryReservation>['meta'] };
}

export function getAlerts(organizationId: string): Promise<InventoryAlert[]> {
  return apiRequest(`/organizations/${organizationId}/inventory/alerts`);
}

export function acknowledgeAlert(organizationId: string, alertId: string): Promise<InventoryAlert> {
  return apiRequest(`/organizations/${organizationId}/inventory/alerts/${alertId}/acknowledge`, {
    method: 'POST',
  });
}