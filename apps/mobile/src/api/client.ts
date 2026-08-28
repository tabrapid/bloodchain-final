import {
  deleteAccessToken,
  deleteRefreshToken,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
} from '../auth/storage';
import { apiBaseUrl } from './config';

export interface ApiError {
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

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
}

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!isRefreshing) {
    isRefreshing = true;
    refreshPromise = (async () => {
      try {
        const refreshToken = await getRefreshToken();
        if (!refreshToken) return null;
        const response = await fetch(`${apiBaseUrl}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (!response.ok) return null;
        const json = (await response.json()) as {
          data: { accessToken: string; refreshToken: string };
        };
        await setAccessToken(json.data.accessToken);
        return json.data.accessToken;
      } catch {
        return null;
      } finally {
        isRefreshing = false;
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

interface ResponseEnvelope<T> {
  data: T;
  meta?: unknown;
  statusCode?: number;
  code?: string;
  message?: string;
  details?: unknown;
}

/**
 * The full parsed response body, not just `.data` -- for endpoints where
 * `meta` (e.g. pagination totals) is real data `apiRequest` would otherwise
 * silently discard. Mirrors blood-center-web's `apiRequestEnvelope` (P0-13).
 */
export async function apiRequestEnvelope<T>(
  path: string,
  options: RequestOptions = {},
): Promise<ResponseEnvelope<T>> {
  const url = `${apiBaseUrl}${path}`;
  const headers = new Headers(options.headers);

  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  if (!options.skipAuth) {
    const token = await getAccessToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  let response = await fetch(url, { ...options, headers });

  if (response.status === 401 && !options.skipAuth) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers.set('Authorization', `Bearer ${newToken}`);
      response = await fetch(url, { ...options, headers });
    } else {
      await deleteAccessToken();
      await deleteRefreshToken();
    }
  }

  const json = (await response.json().catch(() => ({}))) as ResponseEnvelope<T>;

  if (!response.ok) {
    throw new ApiRequestError({
      statusCode: json.statusCode ?? response.status,
      code: json.code ?? 'REQUEST_FAILED',
      message: json.message ?? 'Request failed',
      details: json.details,
    });
  }

  return json;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const envelope = await apiRequestEnvelope<T>(path, options);
  return envelope.data;
}
