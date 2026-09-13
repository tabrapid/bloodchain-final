import { apiRequest } from './client';
import { apiBasePath } from './config';
import {
  setAccessToken,
  setRefreshToken,
  getRefreshToken,
  deleteAccessToken,
  deleteRefreshToken,
} from '../auth/storage';
import type { AuthenticatedUser, TokenPair } from '@bloodchain/types';

/**
 * One account, two ways to name it.
 *
 * Exactly one of `email` and `phone`, matching the API: a donor signs in with
 * the number they know, staff with the address their console sends them to, and
 * both land on the same account with the same password and the same sessions.
 */
export type LoginInput =
  | { email: string; phone?: undefined; password: string }
  | { phone: string; email?: undefined; password: string };

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

/** Why a code is being sent. The server keys its rate limits on this too. */
export type PhoneCodePurpose = 'REGISTRATION' | 'PASSWORD_RESET';

export interface PhoneCodeRequested {
  /** `+998*******67` -- enough to recognise, not enough to read aloud. */
  sentTo: string;
  expiresInSeconds: number;
  resendAvailableInSeconds: number;
}

export interface PhoneVerified {
  /**
   * Proof that this number was verified, signed by the server. Held only for
   * the moments between the code screen and the details screen, and sent back
   * with the registration -- the number lives inside it, so the account that
   * gets created is necessarily for the number that was confirmed.
   */
  verificationToken: string;
  expiresInSeconds: number;
}

export interface PhoneResetIssued {
  /** A standard password-reset token: single use, same expiry as the emailed one. */
  resetToken: string;
  expiresInMinutes: number;
}

export interface RegisterWithPhoneInput {
  verificationToken: string;
  firstName: string;
  lastName: string;
  password: string;
  email?: string;
}

export interface AuthResponse extends TokenPair {
  user: AuthenticatedUser;
}

export interface MeResponse {
  id: string;
  email: string;
  phone?: string | null;
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
): Promise<{ id: string; email: string }> {
  return apiRequest(`${apiBasePath}/auth/register`, {
    method: 'POST',
    body: JSON.stringify(input),
    skipAuth: true,
  });
}

export async function verifyEmail(token: string): Promise<AuthResponse> {
  const data = await apiRequest<AuthResponse>(`${apiBasePath}/auth/verify-email`, {
    method: 'POST',
    body: JSON.stringify({ token }),
    skipAuth: true,
  });
  await setTokens(data);
  return data;
}

export async function resendVerification(email: string): Promise<void> {
  await apiRequest(`${apiBasePath}/auth/resend-verification`, {
    method: 'POST',
    body: JSON.stringify({ email }),
    skipAuth: true,
  });
}

export interface RecoveryMessage {
  success: boolean;
  message: string;
}

/**
 * Asks for a reset link.
 *
 * The server answers identically whether or not the address is registered, and
 * the client must not try to be more helpful than that -- any branch on "did
 * this address exist" would put the enumeration oracle back that the API
 * deliberately does without.
 */
export async function requestPasswordReset(email: string): Promise<RecoveryMessage> {
  return apiRequest<RecoveryMessage>(`${apiBasePath}/auth/forgot-password`, {
    method: 'POST',
    body: JSON.stringify({ email }),
    skipAuth: true,
  });
}

/**
 * Spends the token from the email and sets the new password.
 *
 * No tokens come back: the server has just revoked every session for this user,
 * so the only correct next step is a fresh sign-in.
 */
export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<RecoveryMessage> {
  return apiRequest<RecoveryMessage>(`${apiBasePath}/auth/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
    skipAuth: true,
  });
}

/**
 * Asks for an SMS code.
 *
 * The server answers identically whether or not the number has an account, and
 * this client must not try to be more helpful than that: any branch on "does
 * this number exist" would rebuild the enumeration oracle the API deliberately
 * does without.
 */
export async function requestPhoneCode(
  phone: string,
  purpose: PhoneCodePurpose,
  locale?: string,
): Promise<PhoneCodeRequested> {
  return apiRequest<PhoneCodeRequested>(`${apiBasePath}/auth/phone/request-code`, {
    method: 'POST',
    body: JSON.stringify({ phone, purpose, locale }),
    skipAuth: true,
  });
}

/**
 * Spends the code. Returns a registration ticket, or a password-reset token.
 *
 * Overloaded so the caller gets the shape that purpose actually returns: a
 * screen asking to register should not have to narrow a union that cannot occur.
 */
/* eslint-disable no-redeclare -- TypeScript overload signatures, not duplicates */
export async function verifyPhoneCode(
  phone: string,
  purpose: 'REGISTRATION',
  code: string,
): Promise<PhoneVerified>;
export async function verifyPhoneCode(
  phone: string,
  purpose: 'PASSWORD_RESET',
  code: string,
): Promise<PhoneResetIssued>;
export async function verifyPhoneCode(
  phone: string,
  purpose: PhoneCodePurpose,
  code: string,
): Promise<PhoneVerified | PhoneResetIssued> {
  return apiRequest(`${apiBasePath}/auth/phone/verify-code`, {
    method: 'POST',
    body: JSON.stringify({ phone, purpose, code }),
    skipAuth: true,
  });
}
/* eslint-enable no-redeclare */

/**
 * Finishes phone-first sign-up, and signs in.
 *
 * Tokens come back because the donor has just proved they hold the number and
 * chosen a password ten seconds ago; sending them to a sign-in form to retype
 * it is a step that exists only to be abandoned.
 */
export async function registerWithPhone(input: RegisterWithPhoneInput): Promise<AuthResponse> {
  const data = await apiRequest<AuthResponse>(`${apiBasePath}/auth/register-phone`, {
    method: 'POST',
    body: JSON.stringify(input),
    skipAuth: true,
  });
  await setTokens(data);
  return data;
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

  const data = await apiRequest<{ accessToken: string; refreshToken: string }>(
    `${apiBasePath}/auth/refresh`,
    {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
      skipAuth: true,
    },
  );

  await setTokens(data);
  return data;
}

async function setTokens(
  data: AuthResponse | { accessToken: string; refreshToken: string },
): Promise<void> {
  await Promise.all([setAccessToken(data.accessToken), setRefreshToken(data.refreshToken)]);
}
