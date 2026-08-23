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

interface TokenStorage {
  accessToken: string | null;
  refreshToken: string | null;
}

function getTokens(): TokenStorage {
  if (typeof window === 'undefined') return { accessToken: null, refreshToken: null };
  return {
    accessToken: localStorage.getItem('admin_access_token'),
    refreshToken: localStorage.getItem('admin_refresh_token'),
  };
}

function setTokens(access: string, refresh: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('admin_access_token', access);
  localStorage.setItem('admin_refresh_token', refresh);
}

function clearTokens() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('admin_access_token');
  localStorage.removeItem('admin_refresh_token');
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { accessToken, refreshToken } = getTokens();
  const headers = new Headers(options.headers);

  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  let response = await fetch(`${API_BASE_URL}${API_BASE_PATH}${path}`, { ...options, headers });

  if (response.status === 401 && refreshToken) {
    const refreshResponse = await fetch(`${API_BASE_URL}${API_BASE_PATH}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (refreshResponse.ok) {
      const json = await refreshResponse.json() as { data: { accessToken: string; refreshToken: string } };
      setTokens(json.data.accessToken, json.data.refreshToken);
      headers.set('Authorization', `Bearer ${json.data.accessToken}`);
      response = await fetch(`${API_BASE_URL}${API_BASE_PATH}${path}`, { ...options, headers });
    } else {
      clearTokens();
      throw new ApiRequestError({ statusCode: 401, code: 'UNAUTHORIZED', message: 'Session expired' });
    }
  }

  const json = await response.json().catch(() => ({})) as {
    data?: T;
    statusCode?: number;
    code?: string;
    message?: string;
    details?: unknown;
  };

  if (!response.ok) {
    throw new ApiRequestError({
      statusCode: json.statusCode ?? response.status,
      code: json.code ?? 'REQUEST_FAILED',
      message: json.message ?? 'Request failed',
      details: json.details,
    });
  }

  return json.data as T;
}

export async function login(email: string, password: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}${API_BASE_PATH}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const json = await response.json() as {
    data?: AuthResponse;
    statusCode?: number;
    code?: string;
    message?: string;
  };

  if (!response.ok) {
    throw new ApiRequestError({
      statusCode: json.statusCode ?? response.status,
      code: json.code ?? 'LOGIN_FAILED',
      message: json.message ?? 'Login failed',
    });
  }

  setTokens(json.data!.accessToken, json.data!.refreshToken);
}

export async function logout(): Promise<void> {
  const { refreshToken } = getTokens();
  try {
    await apiRequest('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    // Ignore errors on logout
  }
  clearTokens();
}

export function isAuthenticated(): boolean {
  const { accessToken } = getTokens();
  return !!accessToken;
}

export async function me(): Promise<AuthUser> {
  return apiRequest<AuthUser>('/auth/me');
}
