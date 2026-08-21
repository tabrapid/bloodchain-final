import { apiRequest } from './client';
import { apiBasePath } from './config';
import {
  setAccessToken,
  setRefreshToken,
  getRefreshToken,
  deleteAccessToken,
  deleteRefreshToken,
} from '../auth/storage';
import type { AuthenticatedUser, TokenPair } from '@donor/types';

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput extends LoginInput {
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface AuthResponse extends TokenPair {
  user: AuthenticatedUser;
}

export interface MeResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  avatarUrl?: string;
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
  donorProfile: {
    id: string;
    bloodType?: string;
    rhFactor?: string;
    city?: string;
    donorStatus: string;
    verificationStatus: string;
    dateOfBirth?: string;
  } | null;
  permissions: string[];
}

export async function login(input: LoginInput): Promise<AuthResponse> {
  const data = await apiRequest<AuthResponse>(`${apiBasePath}/auth/login`, {
    method: 'POST',
    body: JSON.stringify(input),
    skipAuth: true,
  });
  await setTokens(data);
  return data;
}

export async function register(
  input: RegisterInput,
): Promise<{ data: { id: string; email: string } }> {
  return apiRequest(`${apiBasePath}/auth/register`, {
    method: 'POST',
    body: JSON.stringify(input),
    skipAuth: true,
  });
}

export async function me(): Promise<MeResponse> {
  return apiRequest<MeResponse>(`${apiBasePath}/auth/me`);
}

export async function logout(): Promise<void> {
  const refreshToken = await getRefreshToken();
  if (refreshToken) {
    try {
      await apiRequest(`${apiBasePath}/auth/logout`, {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // Ignore logout errors - we'll clear tokens anyway
    }
  }
  await deleteAccessToken();
  await deleteRefreshToken();
}

export async function refreshTokens(): Promise<{ accessToken: string; refreshToken: string }> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) throw new Error('No refresh token');

  const data = await apiRequest<{ data: { accessToken: string; refreshToken: string } }>(
    `${apiBasePath}/auth/refresh`,
    {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
      skipAuth: true,
    },
  );

  await setTokens(data.data);
  return data.data;
}

async function setTokens(
  data: AuthResponse | { accessToken: string; refreshToken: string },
): Promise<void> {
  await Promise.all([setAccessToken(data.accessToken), setRefreshToken(data.refreshToken)]);
}
