/**
 * The single request helper for this app.
 *
 * Before P3-2 this file did not exist and every `lib/*.ts` module carried its
 * own copy — nine across the two dashboards — each with its own `ApiRequestError`
 * class. Two consequences, both invisible to the type checker:
 *
 * 1. **No token refresh.** Only `auth.ts`'s `me()` ever called
 *    `refreshAccessToken`. Access tokens live 15 minutes, so every dashboard
 *    action after that failed with a raw 401 until the user reloaded the page —
 *    which called `me()`, silently refreshed, and made the problem look
 *    intermittent. admin-web and the mobile app both refresh-and-retry; these
 *    two did not.
 * 2. **`instanceof` across modules was false.** A separate class per file means
 *    `err instanceof ApiRequestError` only matches errors thrown by the module
 *    the class was imported from, so a page catching errors from two modules
 *    silently fell through to its generic fallback message.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const API_BASE_PATH = '/api/v1';

export interface ApiError {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
}

export class ApiRequestError extends Error {
  constructor(public readonly error: ApiError) {
    super(error.message);
    this.name = 'ApiRequestError';
  }
}

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('donor_access_token');
}

export function setAuthToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('donor_access_token', token);
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('donor_refresh_token');
}

export function setRefreshToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('donor_refresh_token', token);
}

export function clearTokens(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('donor_access_token');
  localStorage.removeItem('donor_refresh_token');
}

export function apiUrl(endpoint: string): string {
  return `${API_BASE_URL}${API_BASE_PATH}${endpoint}`;
}

/** Exchange the stored refresh token for a new pair. Returns null on failure. */
export async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    const response = await fetch(apiUrl('/auth/refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) return null;

    const json = (await response.json()) as {
      data: { accessToken: string; refreshToken: string };
    };
    setAuthToken(json.data.accessToken);
    setRefreshToken(json.data.refreshToken);
    return json.data.accessToken;
  } catch {
    return null;
  }
}

interface Envelope<T> {
  data?: T;
  meta?: unknown;
  statusCode?: number;
  code?: string;
  message?: string;
  details?: unknown;
}

/**
 * Does the actual fetch, auth header, 401-refresh-and-retry, and error
 * mapping. Returns the whole parsed body rather than unwrapping it, so
 * callers can get at `meta` (pagination totals) as well as `data`.
 *
 * `apiRequest` below is `apiRequestEnvelope(...).then(e => e.data)` and stays
 * the default for the ~30 call sites here that only want the payload.
 * `apiRequestEnvelope` itself exists for endpoints whose response also
 * carries `meta` — e.g. `inventory.ts`'s paginated list endpoints, none of
 * which sit behind `WrapResponseInterceptor`, so their `{ data, meta }` is
 * the *entire* response body rather than something nested one level deeper
 * under `data` the way admin-web's endpoints are (see P0-12).
 */
export async function apiRequestEnvelope<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<Envelope<T>> {
  const token = getAuthToken();
  if (!token) {
    throw new ApiRequestError({ statusCode: 401, code: 'NO_TOKEN', message: 'Not authenticated' });
  }

  const send = (bearer: string) =>
    fetch(apiUrl(endpoint), {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bearer}`,
        ...options.headers,
      },
    });

  let response = await send(token);

  // Retry once behind a fresh access token. A failed refresh clears the
  // session rather than leaving a dead token in storage.
  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      clearTokens();
      throw new ApiRequestError({
        statusCode: 401,
        code: 'SESSION_EXPIRED',
        message: 'Session expired',
      });
    }
    response = await send(refreshed);
  }

  const json = (await response.json().catch(() => ({}))) as Envelope<T>;

  if (!response.ok) {
    throw new ApiRequestError({
      statusCode: json.statusCode ?? response.status,
      code: json.code ?? 'API_ERROR',
      message: json.message ?? 'Request failed',
      details: json.details,
    });
  }

  return json;
}

export async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  // Every route answers `{ data: ... }` — see P0-10, where seven controllers
  // did not and every call against them silently produced undefined.
  const { data } = await apiRequestEnvelope<T>(endpoint, options);
  return data as T;
}
