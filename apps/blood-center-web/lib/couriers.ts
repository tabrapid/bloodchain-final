import { ApiRequestError, apiRequest } from './api-client';

export { ApiRequestError };

export interface CourierRosterEntry {
  id: string;
  displayName: string;
  phone?: string;
  email: string;
  status: 'AVAILABLE' | 'BUSY' | 'OFFLINE' | 'SUSPENDED';
  activeShipments: number;
  completedShipments: number;
  createdAt: string;
}

export function getCourierRoster(organizationId: string): Promise<CourierRosterEntry[]> {
  return apiRequest(`/organizations/${organizationId}/couriers/roster`);
}
