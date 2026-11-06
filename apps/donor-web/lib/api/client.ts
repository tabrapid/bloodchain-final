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
export interface ResponseEnvelope<T> {
  data: T;
  meta?: unknown;
  statusCode?: number;
  code?: string;
  message?: string;
  details?: unknown;
}
interface Options extends RequestInit {
  skipAuth?: boolean;
}
let refreshing: Promise<boolean> | null = null;

async function request(path: string, options: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    return await fetch(path, {
      ...options,
      credentials: 'same-origin',
      signal: controller.signal,
      cache: 'no-store',
    });
  } catch {
    throw new ApiRequestError({
      statusCode: 0,
      code: 'NETWORK_ERROR',
      message: 'Server bilan aloqa yo‘q. Qayta urinib ko‘ring.',
    });
  } finally {
    clearTimeout(timer);
  }
}
export async function apiRequestEnvelope<T>(
  path: string,
  options: Options = {},
): Promise<ResponseEnvelope<T>> {
  if (!path.startsWith('/api/v1/')) throw new Error('Invalid API path');
  const { skipAuth, ...init } = options;
  const headers = new Headers(options.headers);
  if (init.body) headers.set('Content-Type', 'application/json');
  let response = await request(path, { ...init, headers });
  if (
    response.status === 401 &&
    !skipAuth &&
    path !== '/api/v1/auth/refresh' &&
    path !== '/api/v1/auth/logout'
  ) {
    refreshing ??= request('/api/v1/auth/refresh', { method: 'POST' })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        refreshing = null;
      });
    if (await refreshing) response = await request(path, { ...init, headers });
  }
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && !skipAuth)
      window.dispatchEvent(new Event('donor:session-expired'));
    throw new ApiRequestError({
      statusCode: response.status,
      code: json.code ?? 'REQUEST_FAILED',
      message: Array.isArray(json.message)
        ? json.message.join('. ')
        : (json.message ?? 'So‘rov bajarilmadi.'),
      details: json.details,
    });
  }
  return json;
}
export async function apiRequest<T>(path: string, options: Options = {}): Promise<T> {
  return (await apiRequestEnvelope<T>(path, options)).data;
}
