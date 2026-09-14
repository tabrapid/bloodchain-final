import { translate } from '@bloodchain/ui/i18n';

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
      throw new ApiRequestError({ statusCode: 401, code: 'UNAUTHORIZED', message: translate('ops.common.sessionExpired') });
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

/**
 * Account recovery.
 *
 * Unauthenticated by design -- whoever is using this is locked out -- so these
 * go through plain `fetch` rather than `apiRequest`, which attaches a token and
 * tries to refresh one. No reset logic lives here; both calls hand straight to
 * the API's existing endpoints.
 *
 * The one rule this layer must keep is the server's: an unknown address is
 * answered exactly like a registered one, so nothing here may branch on whether
 * an account was found.
 */
export interface RecoveryMessage {
  success: boolean;
  message: string;
}

async function recoveryRequest(path: string, body: unknown, fallbackCode: string): Promise<RecoveryMessage> {
  const response = await fetch(`${API_BASE_URL}${API_BASE_PATH}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const json = (await response.json().catch(() => ({}))) as {
    data?: RecoveryMessage;
    statusCode?: number;
    code?: string;
    message?: string;
  };

  if (!response.ok) {
    throw new ApiRequestError({
      statusCode: json.statusCode ?? response.status,
      code: json.code ?? fallbackCode,
      message: json.message ?? 'Something went wrong. Please try again.',
    });
  }

  return json.data ?? { success: true, message: '' };
}

export function requestPasswordReset(email: string): Promise<RecoveryMessage> {
  return recoveryRequest('/auth/forgot-password', { email }, 'PASSWORD_RESET_REQUEST_FAILED');
}

export function resetPassword(token: string, newPassword: string): Promise<RecoveryMessage> {
  return recoveryRequest('/auth/reset-password', { token, newPassword }, 'PASSWORD_RESET_FAILED');
}

/**
 * True when the server refused the token itself.
 *
 * Unknown, expired and already-spent all come back as one 400 with one message,
 * deliberately, so that a caller cannot probe which tokens ever existed. The UI
 * cannot tell them apart either and must not pretend to: one state, one remedy.
 */
export function isRejectedResetToken(error: unknown): boolean {
  return error instanceof ApiRequestError && error.error.statusCode === 400;
}

/** Error copy for the recovery screens, where a 429 is a policy, not a fault. */
export function recoveryErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.error.statusCode === 429) {
      return 'Too many requests. Password reset is limited to a few attempts every 15 minutes — please wait and try again.';
    }
    return error.error.message || 'Something went wrong. Please try again.';
  }
  return 'Could not reach the server. Check your connection and try again.';
}
