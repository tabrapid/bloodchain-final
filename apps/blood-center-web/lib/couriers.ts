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

export function getCourierRoster(organizationId: string): Promise<{ data: CourierRosterEntry[] }> {
  return apiRequest(`/organizations/${organizationId}/couriers/roster`);
}
