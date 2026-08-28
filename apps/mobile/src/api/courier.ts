import { apiRequest } from './client';

export interface Shipment {
  id: string;
  shipmentReference: string;
  bloodRequestId: string;
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
  createdAt: string;
  bloodRequest?: {
    id: string;
    requestReference: string;
    priority: string;
  };
  sourceOrganization?: {
    id: string;
    name: string;
    address?: string;
  };
  destinationOrganization?: {
    id: string;
    name: string;
    address?: string;
  };
  courier?: {
    id: string;
    displayName: string;
    phone?: string;
    status: string;
  };
  units?: Array<{
    id: string;
    status: string;
    bloodUnit?: {
      id: string;
      bloodType: string;
      rhFactor: string;
      componentType: string;
    };
  }>;
  locations?: Array<{
    id: string;
    latitude: string;
    longitude: string;
    recordedAt: string;
  }>;
}

export interface CourierProfile {
  id: string;
  displayName: string;
  phone: string | null;
  status: string;
  organizationId: string;
  organizationName: string;
  currentShipmentId: string | null;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface CourierStats {
  total: number;
  completed: number;
  failed: number;
  cancelled: number;
  active: number;
  avgDeliveryTimeMinutes: number | null;
}

export interface ShipmentTracking {
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

export async function getCourierProfile(): Promise<CourierProfile> {
  const response = await apiRequest<CourierProfile>('/courier/profile');
  return response;
}

export async function updateCourierStatus(status: string): Promise<{ id: string; status: string }> {
  const response = await apiRequest<{ id: string; status: string }>('/courier/status', {
    method: 'POST',
    body: JSON.stringify({ status }),
  });
  return response;
}

export async function updateCourierProfile(data: {
  displayName?: string;
  phone?: string;
}): Promise<{ id: string; displayName: string; phone: string | null }> {
  const response = await apiRequest<{ id: string; displayName: string; phone: string | null }>(
    '/courier/profile',
    {
      method: 'PATCH',
      body: JSON.stringify(data),
    }
  );
  return response;
}

export async function getCourierShipments(filters?: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ data: Shipment[]; meta: { total: number; limit: number; offset: number } }> {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.limit) params.set('limit', String(filters.limit));
  if (filters?.offset) params.set('offset', String(filters.offset));
  const query = params.toString();
  const response = await apiRequest<{ data: Shipment[]; meta: { total: number; limit: number; offset: number } }>(
    `/courier/shipments${query ? `?${query}` : ''}`
  );
  return response;
}

export async function getActiveShipment(): Promise<Shipment | null> {
  const response = await apiRequest<Shipment | null>('/courier/shipments/active');
  return response;
}

export async function getCourierStats(startDate?: string, endDate?: string): Promise<CourierStats> {
  const params = new URLSearchParams();
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);
  const query = params.toString();
  const response = await apiRequest<CourierStats>(`/courier/stats${query ? `?${query}` : ''}`);
  return response;
}

export async function acceptShipment(shipmentId: string): Promise<Shipment> {
  const response = await apiRequest<Shipment>(`/courier/shipments/${shipmentId}/accept`, {
    method: 'POST',
  });
  return response;
}

export async function declineShipment(shipmentId: string, reason?: string): Promise<Shipment> {
  const response = await apiRequest<Shipment>(`/courier/shipments/${shipmentId}/decline`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
  return response;
}

export async function startPickup(shipmentId: string): Promise<Shipment> {
  const response = await apiRequest<Shipment>(`/courier/shipments/${shipmentId}/start-pickup`, {
    method: 'POST',
  });
  return response;
}

export async function confirmPickup(shipmentId: string): Promise<Shipment> {
  const response = await apiRequest<Shipment>(`/courier/shipments/${shipmentId}/confirm-pickup`, {
    method: 'POST',
  });
  return response;
}

export async function startDelivery(shipmentId: string): Promise<Shipment> {
  const response = await apiRequest<Shipment>(`/courier/shipments/${shipmentId}/start-delivery`, {
    method: 'POST',
  });
  return response;
}

export async function updateLocation(
  shipmentId: string,
  data: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    heading?: number;
    speed?: number;
  }
): Promise<{ success: boolean }> {
  const response = await apiRequest<{ success: boolean }>(
    `/courier/shipments/${shipmentId}/update-location`,
    {
      method: 'POST',
      body: JSON.stringify(data),
    }
  );
  return response;
}

export async function arriveAtHospital(shipmentId: string): Promise<Shipment> {
  const response = await apiRequest<Shipment>(`/courier/shipments/${shipmentId}/arrive`, {
    method: 'POST',
  });
  return response;
}

export async function failShipment(
  shipmentId: string,
  data: { reason: string; notes?: string }
): Promise<Shipment> {
  const response = await apiRequest<Shipment>(`/courier/shipments/${shipmentId}/fail`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return response;
}

export async function getShipmentTracking(shipmentId: string): Promise<ShipmentTracking> {
  const response = await apiRequest<ShipmentTracking>(`/shipments/${shipmentId}/tracking`);
  return response;
}

export async function getShipmentLocations(shipmentId: string): Promise<
  Array<{
    id: string;
    latitude: number;
    longitude: number;
    accuracy?: number;
    recordedAt: string;
  }>
> {
  const response = await apiRequest<
    Array<{
      id: string;
      latitude: number;
      longitude: number;
      accuracy?: number;
      recordedAt: string;
    }>
  >(`/shipments/${shipmentId}/locations`);
  return response;
}
