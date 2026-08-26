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

export interface EmergencyRequest {
  id: string;
  emergencyReference: string;
  hospitalId: string;
  bloodType: string;
  rhFactor: string;
  componentType: string;
  unitsRequired: number;
  urgencyLevel: string;
  status: string;
  patientReference?: string;
  description?: string;
  requiredBefore?: string;
  donationLocation?: string;
  latitude?: string;
  longitude?: string;
  unitsCollected: number;
  createdAt: string;
  updatedAt: string;
  hospital: {
    id: string;
    name: string;
  };
  matches: Array<{
    id: string;
    status: string;
  }>;
  responses: Array<{
    id: string;
    status: string;
    donor: {
      firstName: string;
      lastName: string;
    };
  }>;
}

export interface CreateEmergencyDto {
  bloodType: string;
  rhFactor: string;
  componentType?: string;
  unitsRequired: number;
  urgencyLevel?: string;
  patientReference?: string;
  description?: string;
  requiredBefore?: string;
  donationLocation?: string;
  latitude?: number;
  longitude?: number;
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  if (!token) {
    throw new ApiRequestError({
      statusCode: 401,
      code: 'NO_TOKEN',
      message: 'Not authenticated',
    });
  }

  const response = await fetch(`${API_BASE_URL}${API_BASE_PATH}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  const json = (await response.json()) as {
    data?: T;
    statusCode?: number;
    message?: string;
  };

  if (!response.ok) {
    throw new ApiRequestError({
      statusCode: json.statusCode ?? response.status,
      code: 'API_ERROR',
      message: json.message ?? 'API request failed',
    });
  }

  return json.data as T;
}

export async function getEmergencies(organizationId: string, filters?: {
  status?: string;
  urgencyLevel?: string;
}): Promise<EmergencyRequest[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.urgencyLevel) params.append('urgencyLevel', filters.urgencyLevel);

  const queryString = params.toString();
  const endpoint = `/organizations/${organizationId}/emergencies${queryString ? `?${queryString}` : ''}`;

  const response = await apiRequest<{ data: EmergencyRequest[] }>(endpoint);
  return response.data;
}

export async function getEmergency(
  organizationId: string,
  emergencyId: string
): Promise<EmergencyRequest> {
  return apiRequest<EmergencyRequest>(
    `/organizations/${organizationId}/emergencies/${emergencyId}`
  );
}

export async function createEmergency(
  organizationId: string,
  data: CreateEmergencyDto
): Promise<EmergencyRequest> {
  return apiRequest<EmergencyRequest>(
    `/organizations/${organizationId}/emergencies`,
    {
      method: 'POST',
      body: JSON.stringify(data),
    }
  );
}

export async function activateEmergency(
  organizationId: string,
  emergencyId: string
): Promise<EmergencyRequest> {
  return apiRequest<EmergencyRequest>(
    `/organizations/${organizationId}/emergencies/${emergencyId}/activate`,
    { method: 'POST' }
  );
}

export async function cancelEmergency(
  organizationId: string,
  emergencyId: string,
  reason?: string
): Promise<EmergencyRequest> {
  return apiRequest<EmergencyRequest>(
    `/organizations/${organizationId}/emergencies/${emergencyId}/cancel`,
    {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }
  );
}

export async function confirmArrival(
  organizationId: string,
  responseId: string
): Promise<unknown> {
  return apiRequest(
    `/organizations/${organizationId}/emergency-responses/${responseId}/confirm-arrival`,
    { method: 'POST' }
  );
}

export async function completeEmergencyDonation(
  organizationId: string,
  responseId: string,
  data?: { bloodType?: string; rhFactor?: string; componentType?: string; volumeMl?: number }
): Promise<unknown> {
  return apiRequest(
    `/organizations/${organizationId}/emergency-responses/${responseId}/complete`,
    { method: 'POST', body: JSON.stringify(data ?? {}) }
  );
}

export async function getEmergencyTracking(
  organizationId: string,
  emergencyId: string
): Promise<EmergencyRequest> {
  return apiRequest<EmergencyRequest>(
    `/organizations/${organizationId}/emergencies/${emergencyId}/tracking`
  );
}