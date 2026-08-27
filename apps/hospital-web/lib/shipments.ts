import { ApiRequestError, apiRequest } from './api-client';

export { ApiRequestError };

export interface BloodRequestEvent {
  id: string;
  eventType: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
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
  createdAt: string;
  items: BloodRequestItem[];
  shipment?: Shipment;
  requestingOrganization?: { id: string; name: string };
  fulfillingOrganization?: { id: string; name: string };
  events?: BloodRequestEvent[];
}

export interface BloodRequestItem {
  id: string;
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
  bloodUnitId: string;
  status: string;
  bloodUnit?: {
    id: string;
    bloodType: string;
    rhFactor: string;
    componentType: string;
  };
}

export interface ShipmentLocation {
  id: string;
  latitude: string;
  longitude: string;
  accuracy?: string;
  recordedAt: string;
}

export interface TrackingInfo {
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
}

export interface TimelineEvent {
  id: string;
  type: string;
  timestamp: string;
  actor: string;
  organization?: string;
  metadata?: Record<string, unknown>;
}

export interface TimelineResponse {
  shipmentId: string;
  reference: string;
  status: string;
  timeline: TimelineEvent[];
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

export function getBloodRequests(
  organizationId: string,
  filters?: { status?: string },
): Promise<{ data: BloodRequest[] }> {
  const searchParams = new URLSearchParams();
  searchParams.set('type', 'requesting');
  if (filters?.status) searchParams.set('status', filters.status);
  return apiRequest(`/organizations/${organizationId}/blood-requests?${searchParams.toString()}`);
}

export function getBloodRequest(organizationId: string, requestId: string): Promise<BloodRequest> {
  return apiRequest(`/organizations/${organizationId}/blood-requests/${requestId}`);
}

export function createBloodRequest(
  organizationId: string,
  params: CreateBloodRequestParams,
): Promise<BloodRequest> {
  return apiRequest(`/organizations/${organizationId}/blood-requests`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export function getIncomingShipments(organizationId: string, filters?: { status?: string }): Promise<{ data: Shipment[] }> {
  const searchParams = new URLSearchParams();
  searchParams.set('type', 'destination');
  if (filters?.status) searchParams.set('status', filters.status);
  const query = searchParams.toString();
  return apiRequest(`/organizations/${organizationId}/shipments${query ? `?${query}` : ''}`);
}

export function getShipment(organizationId: string, shipmentId: string): Promise<Shipment> {
  return apiRequest(`/organizations/${organizationId}/shipments/${shipmentId}`);
}

export function getShipmentTracking(shipmentId: string): Promise<TrackingInfo> {
  return apiRequest(`/shipments/${shipmentId}/tracking`);
}

export function getShipmentTimeline(shipmentId: string): Promise<TimelineResponse> {
  return apiRequest(`/shipments/${shipmentId}/timeline`);
}

export function getShipmentLocations(shipmentId: string): Promise<ShipmentLocation[]> {
  return apiRequest(`/shipments/${shipmentId}/locations`);
}

export function confirmDelivery(
  organizationId: string,
  shipmentId: string,
  data: {
    unitsReceived: number;
    condition?: string;
    notes?: string;
    discrepancyReason?: string;
  }
): Promise<Shipment> {
  return apiRequest(`/organizations/${organizationId}/shipments/${shipmentId}/confirm-delivery`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
