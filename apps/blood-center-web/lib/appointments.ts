import { ApiRequestError, apiRequest } from './api-client';

import type { AppointmentType } from './appointment-slots';

export { ApiRequestError };

export type AppointmentStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'RESULT_PENDING'
  | 'RESULT_READY'
  | 'RESULT_PUBLISHED'
  | 'CANCELLED'
  | 'NO_SHOW'
  | 'RESCHEDULED'
  | 'EXPIRED';

/**
 * A booked appointment, as the desk sees it.
 *
 * Until now the portals could only read *slots* -- the capacity staff publish
 * -- so a console could say "3 of 5 booked" and could not say who, when they
 * were expected, or what they had booked. `testType` is present on blood tests
 * and is the panel the donor picked in the mobile laboratory wizard.
 */
export interface OrganizationAppointment {
  id: string;
  referenceNumber: string;
  appointmentType: AppointmentType;
  status: AppointmentStatus;
  scheduledStart: string;
  scheduledEnd: string;
  notes?: string | null;
  cancellationReason?: string | null;
  donor: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string | null;
    donorProfile?: {
      bloodType?: string | null;
      rhFactor?: string | null;
      verificationStatus?: string | null;
    } | null;
  };
  testType?: { id: string; code: string; name: string } | null;
  slot?: { id: string; capacity: number; bookedCount: number } | null;
}

export interface AppointmentFilters {
  status?: AppointmentStatus;
  appointmentType?: AppointmentType;
  date?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  limit?: number;
}

export function getOrganizationAppointments(
  organizationId: string,
  filters: AppointmentFilters = {},
): Promise<OrganizationAppointment[]> {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.appointmentType) params.set('appointmentType', filters.appointmentType);
  if (filters.date) params.set('date', filters.date);
  if (filters.startDate) params.set('startDate', filters.startDate);
  if (filters.endDate) params.set('endDate', filters.endDate);
  if (filters.search) params.set('search', filters.search);
  if (filters.limit !== undefined) params.set('limit', String(filters.limit));

  const query = params.toString();
  return apiRequest(`/appointments/organizations/${organizationId}${query ? `?${query}` : ''}`);
}

export function confirmAppointment(appointmentId: string): Promise<{ id: string; status: AppointmentStatus }> {
  return apiRequest(`/appointments/${appointmentId}/confirm`, { method: 'POST' });
}

export function completeAppointment(appointmentId: string): Promise<{ id: string; status: AppointmentStatus }> {
  return apiRequest(`/appointments/${appointmentId}/complete`, { method: 'POST' });
}

export function markNoShow(
  appointmentId: string,
  reason?: string,
): Promise<{ id: string; status: AppointmentStatus }> {
  return apiRequest(`/appointments/${appointmentId}/no-show`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export function cancelAppointmentAsStaff(
  appointmentId: string,
  reason?: string,
): Promise<{ id: string; status: AppointmentStatus }> {
  return apiRequest(`/appointments/${appointmentId}/staff-cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}
