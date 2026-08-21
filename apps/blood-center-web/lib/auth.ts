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

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  status: string;
  roles: string[];
  permissions: string[];
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface MeResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  status: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  lastLoginAt?: string;
  roles: string[];
  organizations: Array<{
    membershipId: string;
    organizationId: string;
    name: string;
    type: string;
    role: string;
    status: string;
  }>;
  donorProfile: unknown;
  permissions: string[];
}

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('donor_access_token');
}

function setAuthToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('donor_access_token', token);
}

function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('donor_refresh_token');
}

function setRefreshToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('donor_refresh_token', token);
}

function clearTokens(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('donor_access_token');
  localStorage.removeItem('donor_refresh_token');
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    const response = await fetch(`${API_BASE_URL}${API_BASE_PATH}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) return null;

    const json = (await response.json()) as { data: { accessToken: string; refreshToken: string } };
    setAuthToken(json.data.accessToken);
    setRefreshToken(json.data.refreshToken);
    return json.data.accessToken;
  } catch {
    return null;
  }
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}${API_BASE_PATH}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const json = (await response.json()) as {
    data?: AuthResponse;
    statusCode?: number;
    message?: string;
  };

  if (!response.ok) {
    throw new ApiRequestError({
      statusCode: json.statusCode ?? response.status,
      code: 'LOGIN_FAILED',
      message: json.message ?? 'Login failed',
    });
  }

  const data = json.data!;
  setAuthToken(data.accessToken);
  setRefreshToken(data.refreshToken);
  return data;
}

export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();

  if (refreshToken) {
    try {
      await fetch(`${API_BASE_URL}${API_BASE_PATH}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // Ignore errors
    }
  }

  clearTokens();
}

export async function me(): Promise<MeResponse> {
  const token = getAuthToken();
  if (!token)
    throw new ApiRequestError({ statusCode: 401, code: 'NO_TOKEN', message: 'Not authenticated' });

  let response = await fetch(`${API_BASE_URL}${API_BASE_PATH}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      response = await fetch(`${API_BASE_URL}${API_BASE_PATH}/auth/me`, {
        headers: { Authorization: `Bearer ${newToken}` },
      });
    } else {
      clearTokens();
      throw new ApiRequestError({
        statusCode: 401,
        code: 'SESSION_EXPIRED',
        message: 'Session expired',
      });
    }
  }

  const json = (await response.json()) as {
    data?: MeResponse;
    statusCode?: number;
    message?: string;
  };

  if (!response.ok) {
    throw new ApiRequestError({
      statusCode: json.statusCode ?? response.status,
      code: 'FETCH_FAILED',
      message: json.message ?? 'Failed to fetch user',
    });
  }

  return json.data!;
}

export function isAuthenticated(): boolean {
  return !!getAuthToken();
}
