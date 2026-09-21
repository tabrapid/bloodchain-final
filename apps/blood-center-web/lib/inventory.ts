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
  reservedForOrganizationId?: string | null;
  reason?: string | null;
  expiresAt?: string | null;
  releasedAt?: string | null;
  createdAt: string;
  bloodUnit?: {
    id: string;
    unitReference: string;
    bloodType: string;
    rhFactor: string;
    volumeMl: number;
  } | null;
  reservedByUser?: { firstName: string; lastName: string } | null;
  reservedForOrganization?: { id: string; name: string } | null;
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
export interface ReserveUnitParams {
  /** The hospital the unit is being held for, when there is one. */
  reservedForOrganizationId?: string;
  reason?: string;
  /** ISO timestamp. The hourly maintenance cron auto-releases past this. */
  expiresAt?: string;
}

/**
 * Hold one unit for someone.
 *
 * The route has existed since the inventory module shipped and no client
 * called it, so a blood centre could see RESERVED units in its own list and
 * had no way to create or release one -- the status was reachable only through
 * the seed. The server does the reservation in a transaction with a
 * conditional update on the unit still being AVAILABLE, so two people clicking
 * at once cannot both win; nothing here needs to guard against that.
 */
export function reserveUnit(
  organizationId: string,
  unitId: string,
  params: ReserveUnitParams = {},
): Promise<{ id: string; status: string; reservationId: string }> {
  return apiRequest(`/organizations/${organizationId}/inventory/units/${unitId}/reserve`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/** Give a held unit back to the available pool. */
export function releaseReservation(
  organizationId: string,
  reservationId: string,
  reason?: string,
): Promise<{ id: string; status: string; unitReference: string }> {
  return apiRequest(
    `/organizations/${organizationId}/inventory/reservations/${reservationId}/release`,
    { method: 'POST', body: JSON.stringify({ reason }) },
  );
}

// --- clinical release ------------------------------------------------------

export interface ClinicalReleasePolicySummary {
  id: string;
  version: number;
  kind: 'PRODUCTION' | 'DEVELOPMENT_ONLY';
  status: string;
  title: string;
  /**
   * The single field this console keys "not a clinical clearance" off.
   *
   * Never derived in a component from `kind`: the server decides what counts as
   * a development policy, and a second implementation of that rule in the UI is
   * one that can drift away from the one the gate uses.
   */
  developmentOnly: boolean;
  organizationId: string | null;
  sourceReference: string | null;
  approvedAt: string | null;
  effectiveFrom: string | null;
  effectiveUntil: string | null;
  requirementCount: number;
  requirements: { code: string; description: string; componentType: string | null }[];
}

export interface ClinicalReleasePolicyStatus {
  /** False when nothing usable is in force here. The gate refuses everything. */
  configured: boolean;
  reasonCode: string | null;
  message: string | null;
  policy: ClinicalReleasePolicySummary | null;
}

export interface UnitAwaitingRelease {
  id: string;
  unitReference: string;
  componentType: string;
  bloodType: string;
  rhFactor: string;
  status: string;
  collectedAt: string;
  donationReference: string;
  bloodGroupProvenance: string;
  expiryKnown: boolean;
  /**
   * What the release path would answer for this unit right now, produced by
   * the gate itself rather than derived here. Null means it would permit it.
   */
  blockedReasonCode: string | null;
  blockedMessage: string | null;
  unmetRequirements: string[];
}

export function getClinicalReleasePolicy(
  organizationId: string,
): Promise<ClinicalReleasePolicyStatus> {
  return apiRequest(`/organizations/${organizationId}/inventory/clinical-release/policy`);
}

export function getUnitsAwaitingRelease(
  organizationId: string,
): Promise<{ policy: ClinicalReleasePolicyStatus; units: UnitAwaitingRelease[] }> {
  return apiRequest(`/organizations/${organizationId}/inventory/clinical-release/awaiting`);
}

export interface ReleaseDecisionRecord {
  id: string;
  outcome: 'RELEASED' | 'REFUSED';
  reasonCode: string;
  policyVersion: number | null;
  policyKind: 'PRODUCTION' | 'DEVELOPMENT_ONLY' | null;
  unmetRequirements: string[];
  decidedAt: string;
  decider?: { id: string; firstName: string; lastName: string } | null;
}

export interface UnitTraceability {
  unit: { id: string; unitReference: string; componentType: string; status: string; volumeMl: number; collectedAt: string };
  bloodGroup: { bloodType: string; rhFactor: string; provenance: string; provenanceNote: string | null; typedFromUnit: boolean };
  expiry: { expiresAt: string | null; provenance: string; known: boolean };
  donor: { id: string; firstName: string; lastName: string };
  donation: { id: string; donationReference: string; status: string };
  clinicalRelease: { released: boolean; releasedAt: string | null; decisions: ReleaseDecisionRecord[] };
  disposition: {
    type: string;
    occurredAt: string;
    recipient: { reference: string | null; identityPolicy: string };
  } | null;
}

export function getUnitTraceability(
  organizationId: string,
  unitId: string,
): Promise<UnitTraceability> {
  return apiRequest(`/organizations/${organizationId}/inventory/units/${unitId}/traceability`);
}

// --- low-stock thresholds --------------------------------------------------

export interface StockThreshold {
  id: string;
  scopeKey: string;
  bloodType: string | null;
  rhFactor: string | null;
  componentType: string | null;
  lowStockThreshold: number;
  createdAt: string;
  updatedAt: string;
}

export interface StockThresholdSettings {
  /** False when nothing is configured: no shortage can be detected here. */
  configured: boolean;
  productionFallbackAvailable: boolean;
  developmentFallback: number | null;
  thresholds: StockThreshold[];
}

export function getStockThresholds(organizationId: string): Promise<StockThresholdSettings> {
  return apiRequest(`/organizations/${organizationId}/inventory/thresholds`);
}

export function setStockThreshold(
  organizationId: string,
  params: {
    bloodType?: string;
    rhFactor?: string;
    componentType?: string;
    lowStockThreshold: number;
  },
): Promise<StockThreshold> {
  return apiRequest(`/organizations/${organizationId}/inventory/thresholds`, {
    method: 'PUT',
    body: JSON.stringify(params),
  });
}

export function deleteStockThreshold(
  organizationId: string,
  thresholdId: string,
): Promise<{ id: string; deleted: boolean }> {
  return apiRequest(`/organizations/${organizationId}/inventory/thresholds/${thresholdId}`, {
    method: 'DELETE',
  });
}
