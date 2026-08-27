import {
  ApiRequestError,
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
