import {
  ApiRequestError,
  apiRequest,
  apiUrl,
  clearTokens,
  getAuthToken,
  getRefreshToken,
  refreshAccessToken,
  setAuthToken,
  setRefreshToken,
} from './api-client';

export { ApiRequestError };

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
    organizationStatus: string;
  }>;
  donorProfile: unknown;
  permissions: string[];
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const response = await fetch(apiUrl('/auth/login'), {
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

/**
 * Change this account's password.
 *
 * The same `POST /auth/change-password` the mobile app calls -- there is one
 * password system, and this adds no second one. The server also revokes every
 * refresh token for the account, so other signed-in devices are signed out.
 */
export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();

  if (refreshToken) {
    try {
      await fetch(apiUrl('/auth/logout'), {
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

  let response = await fetch(apiUrl('/auth/me'), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      response = await fetch(apiUrl('/auth/me'), {
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

export interface RegisterOrganizationInput {
  organizationType: 'HOSPITAL' | 'BLOOD_CENTER';
  organizationName: string;
  address?: string;
  organizationPhone?: string;
  organizationEmail?: string;
  adminEmail: string;
  adminPassword: string;
  adminFirstName: string;
  adminLastName: string;
  adminPhone?: string;
}

export async function registerOrganization(
  input: RegisterOrganizationInput,
): Promise<{ user: { id: string; email: string }; organization: { id: string; name: string; status: string } }> {
  const response = await fetch(apiUrl('/auth/register-organization'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  const json = (await response.json()) as {
    data?: { user: { id: string; email: string }; organization: { id: string; name: string; status: string } };
    statusCode?: number;
    message?: string;
  };

  if (!response.ok) {
    throw new ApiRequestError({
      statusCode: json.statusCode ?? response.status,
      code: 'REGISTER_ORGANIZATION_FAILED',
      message: json.message ?? 'Registration failed',
    });
  }

  return json.data!;
}

/**
 * Account recovery.
 *
 * Both calls go straight to the API's existing endpoints; no reset logic lives
 * here. The one rule this layer has to keep is the server's: a request for an
 * unknown address answers exactly like a request for a real one, so nothing
 * here may branch on whether an account was found.
 */
export interface RecoveryMessage {
  success: boolean;
  message: string;
}

export async function requestPasswordReset(email: string): Promise<RecoveryMessage> {
  const response = await fetch(apiUrl('/auth/forgot-password'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
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
      code: json.code ?? 'PASSWORD_RESET_REQUEST_FAILED',
      message: json.message ?? 'Could not request a password reset.',
    });
  }

  return json.data ?? { success: true, message: '' };
}

export async function resetPassword(token: string, newPassword: string): Promise<RecoveryMessage> {
  const response = await fetch(apiUrl('/auth/reset-password'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, newPassword }),
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
      code: json.code ?? 'PASSWORD_RESET_FAILED',
      message: json.message ?? 'Could not reset the password.',
    });
  }

  return json.data ?? { success: true, message: '' };
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
