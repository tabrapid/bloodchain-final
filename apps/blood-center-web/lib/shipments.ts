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
  cancelledAt?: string;
  cancellationReason?: string;
  /**
   * Set when the fulfilling blood centre declined the request.
   *
   * Kept apart from `cancelledAt`/`cancellationReason`, which record the
   * requesting hospital withdrawing its own request -- the hospital reading
   * this back needs to be able to tell the two apart.
   */
  rejectedAt?: string | null;
  rejectedById?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
  items: BloodRequestItem[];
  shipment?: Shipment;
  requestingOrganization: { id: string; name: string };
  fulfillingOrganization?: { id: string; name: string };
  events?: BloodRequestEvent[];
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

export function getBloodRequests(organizationId: string, filters?: { status?: string; type?: string }): Promise<BloodRequest[]> {
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

/**
 * Decline a request outright, with a reason the hospital will see.
 *
 * Before this route existed the only way to refuse was to "approve" every item
 * for zero units, which set REJECTED as a side effect and recorded no reason,
 * no actor and no timestamp.
 */
export function rejectBloodRequest(
  organizationId: string,
  requestId: string,
  reason: string,
): Promise<BloodRequest> {
  return apiRequest(`/organizations/${organizationId}/blood-requests/${requestId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
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

export function getShipments(organizationId: string, filters?: { status?: string; type?: string }): Promise<Shipment[]> {
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