import { apiRequest } from './client';
import { apiBasePath } from './config';

export interface Organization {
  id: string;
  type: string;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
}

export interface AppointmentSlot {
  id: string;
  organizationId: string;
  organization: Organization;
  appointmentType: string;
  startAt: string;
  endAt: string;
  capacity: number;
  availableSpots: number;
  status: string;
}

export interface Appointment {
  id: string;
  referenceNumber: string;
  appointmentType: string;
  status: string;
  scheduledStart: string;
  scheduledEnd: string;
  notes?: string;
  cancellationReason?: string;
  cancelledAt?: string;
  completedAt?: string;
  organization: Organization;
}

export interface BookAppointmentInput {
  slotId: string;
  appointmentType: string;
  notes?: string;
}

export interface CancelAppointmentInput {
  reason?: string;
}

export interface RescheduleAppointmentInput {
  newSlotId: string;
}

export async function getAvailability(params?: {
  organizationId?: string;
  appointmentType?: string;
  date?: string;
  startDate?: string;
  endDate?: string;
}): Promise<AppointmentSlot[]> {
  const queryParams = new URLSearchParams();
  if (params?.organizationId) queryParams.set('organizationId', params.organizationId);
  if (params?.appointmentType) queryParams.set('appointmentType', params.appointmentType);
  if (params?.date) queryParams.set('date', params.date);
  if (params?.startDate) queryParams.set('startDate', params.startDate);
  if (params?.endDate) queryParams.set('endDate', params.endDate);

  const query = queryParams.toString();
  return apiRequest(`${apiBasePath}/appointments/availability${query ? `?${query}` : ''}`);
}

export async function getOrganizations(params?: {
  type?: string;
}): Promise<Organization[]> {
  const queryParams = new URLSearchParams();
  if (params?.type) queryParams.set('type', params.type);
  const query = queryParams.toString();
  return apiRequest(`${apiBasePath}/organizations/discover${query ? `?${query}` : ''}`);
}

export async function getMyAppointments(params?: {
  status?: string;
  appointmentType?: string;
  upcoming?: boolean;
  past?: boolean;
  date?: string;
}): Promise<Appointment[]> {
  const queryParams = new URLSearchParams();
  if (params?.status) queryParams.set('status', params.status);
  if (params?.appointmentType) queryParams.set('appointmentType', params.appointmentType);
  if (params?.upcoming) queryParams.set('upcoming', 'true');
  if (params?.past) queryParams.set('past', 'true');
  if (params?.date) queryParams.set('date', params.date);

  const query = queryParams.toString();
  return apiRequest(`${apiBasePath}/appointments/me${query ? `?${query}` : ''}`);
}

export async function getNextAppointment(): Promise<Appointment | null> {
  return apiRequest(`${apiBasePath}/appointments/me/next`);
}

export async function getAppointment(id: string): Promise<Appointment> {
  return apiRequest(`${apiBasePath}/appointments/${id}`);
}

export async function bookAppointment(input: BookAppointmentInput): Promise<Appointment> {
  return apiRequest(`${apiBasePath}/appointments`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function cancelAppointment(id: string, input?: CancelAppointmentInput): Promise<{ id: string; status: string }> {
  return apiRequest(`${apiBasePath}/appointments/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify(input || {}),
  });
}

export async function rescheduleAppointment(id: string, input: RescheduleAppointmentInput): Promise<Appointment> {
  return apiRequest(`${apiBasePath}/appointments/${id}/reschedule`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}