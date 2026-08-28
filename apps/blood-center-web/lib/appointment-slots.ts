import { ApiRequestError, apiRequest } from './api-client';

export { ApiRequestError };

export type AppointmentType = 'BLOOD_DONATION' | 'BLOOD_TEST' | 'CONSULTATION';
export type SlotStatus = 'AVAILABLE' | 'FULL' | 'BLOCKED' | 'CANCELLED' | 'EXPIRED';

export interface AppointmentSlot {
  id: string;
  organizationId: string;
  appointmentType: AppointmentType;
  startAt: string;
  endAt: string;
  capacity: number;
  bookedCount: number;
  status: SlotStatus;
  createdAt: string;
  updatedAt: string;
}

export function getSlots(
  organizationId: string,
  filters?: { appointmentType?: AppointmentType; startDate?: string; endDate?: string },
): Promise<{ data: AppointmentSlot[] }> {
  const searchParams = new URLSearchParams();
  if (filters?.appointmentType) searchParams.set('appointmentType', filters.appointmentType);
  if (filters?.startDate) searchParams.set('startDate', filters.startDate);
  if (filters?.endDate) searchParams.set('endDate', filters.endDate);
  const query = searchParams.toString();
  return apiRequest(`/appointments/organizations/${organizationId}/slots${query ? `?${query}` : ''}`);
}

export function createSlot(
  organizationId: string,
  params: { appointmentType: AppointmentType; startAt: string; endAt: string; capacity?: number },
): Promise<{ data: AppointmentSlot }> {
  return apiRequest(`/appointments/organizations/${organizationId}/slots`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export function updateSlot(
  organizationId: string,
  slotId: string,
  params: { startAt?: string; endAt?: string; capacity?: number; status?: SlotStatus },
): Promise<{ data: AppointmentSlot }> {
  return apiRequest(`/appointments/organizations/${organizationId}/slots/${slotId}`, {
    method: 'PATCH',
    body: JSON.stringify(params),
  });
}

export function blockSlot(organizationId: string, slotId: string): Promise<{ data: AppointmentSlot }> {
  return apiRequest(`/appointments/organizations/${organizationId}/slots/${slotId}/block`, {
    method: 'POST',
  });
}
