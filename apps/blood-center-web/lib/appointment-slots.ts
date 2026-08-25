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

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
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
