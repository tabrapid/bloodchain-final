const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const API_BASE_PATH = '/api/v1';

interface ApiError {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
}

export class ApiRequestError extends Error {
  constructor(public readonly error: ApiError) {
    super(error.message);
  }
}

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('donor_access_token');
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getAuthToken();
  if (!token) {
    throw new ApiRequestError({ statusCode: 401, code: 'NO_TOKEN', message: 'Not authenticated' });
  }

  const response = await fetch(`${API_BASE_URL}${API_BASE_PATH}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  const json = (await response.json()) as { data?: T; statusCode?: number; message?: string };

  if (!response.ok) {
    throw new ApiRequestError({
      statusCode: json.statusCode ?? response.status,
      code: 'API_ERROR',
      message: json.message ?? 'Request failed',
    });
  }

  return json.data as T;
}

export interface BloodRequest {
  id: string;
  requestReference: string;
  requestingOrganizationId: string;
  fulfillingOrganizationId?: string;
  priority: string;
  status: string;
  notes?: string;
  deliveryAddress?: string;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  deliveryPhone?: string;
  expectedDeliveryDate?: string;
  deliveredAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
  items: BloodRequestItem[];
  shipment?: Shipment;
  requestingOrganization: { id: string; name: string };
  fulfillingOrganization?: { id: string; name: string };
}

export interface BloodRequestItem {
  id: string;
  bloodRequestId: string;
  bloodType: string;
  rhFactor: string;
  componentType: string;
  unitsRequested: number;
  unitsApproved: number;
  unitsFulfilled: number;
}

export interface Shipment {
  id: string;
  shipmentReference: string;
  bloodRequestId: string;
  sourceOrganizationId: string;
  destinationOrganizationId: string;
  courierId?: string;
  status: string;
  pickupAddress?: string;
  destinationAddress?: string;
  assignedAt?: string;
  acceptedAt?: string;
  pickupStartedAt?: string;
  pickedUpAt?: string;
  inTransitAt?: string;
  arrivedAt?: string;
  deliveredAt?: string;
  failedAt?: string;
  createdAt: string;
  courier?: { id: string; displayName: string; phone?: string; status: string };
  units: ShipmentUnit[];
  locations: ShipmentLocation[];
}

export interface ShipmentUnit {
  id: string;
  shipmentId: string;
  bloodUnitId: string;
  reservationId: string;
  pickedUpAt?: string;
  deliveredAt?: string;
  status: string;
  bloodUnit?: {
    id: string;
    unitReference: string;
    bloodType: string;
    rhFactor: string;
    volumeMl: number;
    componentType: string;
  };
}

export interface ShipmentLocation {
  id: string;
  shipmentId: string;
  courierId: string;
  latitude: string;
  longitude: string;
  accuracy?: string;
  heading?: string;
  speed?: string;
  recordedAt: string;
}

export interface Courier {
  id: string;
  displayName: string;
  phone?: string;
  status: string;
  activeShipments: number;
}

export interface CreateBloodRequestParams {
  items: Array<{
    bloodType: string;
    rhFactor: string;
    componentType?: string;
    unitsRequested: number;
  }>;
  priority?: string;
  notes?: string;
  deliveryAddress?: string;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  deliveryPhone?: string;
  expectedDeliveryDate?: string;
}

export function getBloodRequests(organizationId: string, filters?: { status?: string; type?: string }): Promise<{ data: BloodRequest[] }> {
  const searchParams = new URLSearchParams();
  if (filters?.status) searchParams.set('status', filters.status);
  if (filters?.type) searchParams.set('type', filters.type);
  const query = searchParams.toString();
  return apiRequest(`/organizations/${organizationId}/blood-requests${query ? `?${query}` : ''}`);
}

export function getBloodRequest(organizationId: string, requestId: string): Promise<BloodRequest> {
  return apiRequest(`/organizations/${organizationId}/blood-requests/${requestId}`);
}

export function createBloodRequest(organizationId: string, params: CreateBloodRequestParams): Promise<BloodRequest> {
  return apiRequest(`/organizations/${organizationId}/blood-requests`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export function approveBloodRequest(
  organizationId: string,
  requestId: string,
  params: { items: Array<{ itemId: string; unitsApproved: number }>; notes?: string }
): Promise<BloodRequest> {
  return apiRequest(`/organizations/${organizationId}/blood-requests/${requestId}/approve`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export function markReadyForPickup(organizationId: string, requestId: string): Promise<BloodRequest> {
  return apiRequest(`/organizations/${organizationId}/blood-requests/${requestId}/ready-for-pickup`, {
    method: 'POST',
  });
}

export function createShipment(
  organizationId: string,
  requestId: string,
  params?: { pickupAddress?: string }
): Promise<Shipment> {
  return apiRequest(`/organizations/${organizationId}/blood-requests/${requestId}/shipments`, {
    method: 'POST',
    body: JSON.stringify(params || {}),
  });
}

export function getShipments(organizationId: string, filters?: { status?: string; type?: string }): Promise<{ data: Shipment[] }> {
  const searchParams = new URLSearchParams();
  if (filters?.status) searchParams.set('status', filters.status);
  if (filters?.type) searchParams.set('type', filters.type);
  const query = searchParams.toString();
  return apiRequest(`/organizations/${organizationId}/shipments${query ? `?${query}` : ''}`);
}

export function getShipment(organizationId: string, shipmentId: string): Promise<Shipment> {
  return apiRequest(`/organizations/${organizationId}/shipments/${shipmentId}`);
}

export function getAvailableCouriers(organizationId: string): Promise<Courier[]> {
  return apiRequest(`/organizations/${organizationId}/couriers`);
}

export function assignCourier(organizationId: string, shipmentId: string, courierId: string): Promise<Shipment> {
  return apiRequest(`/organizations/${organizationId}/shipments/${shipmentId}/assign`, {
    method: 'POST',
    body: JSON.stringify({ courierId }),
  });
}

export function getShipmentLocations(shipmentId: string): Promise<ShipmentLocation[]> {
  return apiRequest(`/shipments/${shipmentId}/locations`);
}

export function getShipmentTimeline(shipmentId: string): Promise<{
  shipmentId: string;
  reference: string;
  status: string;
  timeline: Array<{
    id: string;
    type: string;
    timestamp: string;
    actor: string;
    organization?: string;
    metadata?: Record<string, unknown>;
  }>;
}> {
  return apiRequest(`/shipments/${shipmentId}/timeline`);
}

export function getShipmentTracking(shipmentId: string): Promise<{
  shipmentId: string;
  reference: string;
  status: string;
  priority: string;
  bloodGroup: string;
  units: number;
  source: {
    id: string;
    name: string;
    address?: string;
    coordinates: { latitude: number; longitude: number } | null;
  };
  destination: {
    id: string;
    name: string;
    address?: string;
    coordinates: { latitude: number; longitude: number } | null;
  };
  courier: { id: string; name: string; phone?: string | null } | null;
  currentLocation: { latitude: number; longitude: number; recordedAt: string } | null;
  eta: {
    distanceKm: number;
    etaMinutes: number;
    calculatedAt: string;
    note: string;
  } | null;
  lastUpdated: string;
  timestamps: {
    createdAt: string;
    assignedAt?: string;
    acceptedAt?: string;
    pickedUpAt?: string;
    inTransitAt?: string;
    arrivedAt?: string;
    deliveredAt?: string;
    estimatedArrivalAt?: string;
  };
}> {
  return apiRequest(`/shipments/${shipmentId}/tracking`);
}

export function cancelShipment(
  organizationId: string,
  shipmentId: string,
  reason?: string
): Promise<Shipment> {
  return apiRequest(`/organizations/${organizationId}/shipments/${shipmentId}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export function reassignShipment(
  organizationId: string,
  shipmentId: string,
  courierId: string
): Promise<Shipment> {
  return apiRequest(`/organizations/${organizationId}/shipments/${shipmentId}/reassign`, {
    method: 'POST',
    body: JSON.stringify({ courierId }),
  });
}

export function confirmDeliveryFull(
  organizationId: string,
  shipmentId: string,
  data: {
    unitsReceived: number;
    condition?: string;
    notes?: string;
    discrepancyReason?: string;
  }
): Promise<Shipment & { deliveryDetails: { unitsDelivered: number; totalUnits: number; discrepancy: { unitsMissing: number; reason: string } | null } }> {
  return apiRequest(`/organizations/${organizationId}/shipments/${shipmentId}/confirm-delivery`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}