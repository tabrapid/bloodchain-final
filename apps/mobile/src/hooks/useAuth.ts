import { useEffect, useCallback } from 'react';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import {
  login as loginApi,
  register as registerApi,
  logout as logoutApi,
  me,
  verifyEmail as verifyEmailApi,
  resendVerification as resendVerificationApi,
  requestPasswordReset as requestPasswordResetApi,
  resetPassword as resetPasswordApi,
  type AuthResponse,
} from '../api/auth';
import { getRefreshToken, clearAuthTokens } from '../auth/storage';
import { useAuthStore } from '../stores/auth.store';
import { ApiRequestError } from '../api/client';

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    switch (error.error.statusCode) {
      case 401:
        return 'Email or password is incorrect.';
      case 403:
        return error.error.message || 'Your account is not active.';
      case 429:
        return 'Too many attempts. Please try again later.';
      default:
        return error.error.message || 'Something went wrong. Please try again.';
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}

function toStoreUser(data: { user: AuthResponse['user'] }) {
  return {
    id: data.user.id,
    email: data.user.email,
    firstName: data.user.firstName,
    lastName: data.user.lastName,
    displayName: data.user.displayName,
    avatarUrl: undefined,
    status: data.user.status,
    emailVerified: true,
    phoneVerified: false,
    lastLoginAt: undefined,
    roles: data.user.roles,
    organizations: [],
    donorProfile: null,
    permissions: data.user.permissions,
  };
}

export function useLogin() {
  const setUser = useAuthStore((s) => s.setUser);
  const setLoading = useAuthStore((s) => s.setLoading);

  return useMutation({
    mutationFn: loginApi,
    onSuccess: (data) => {
      setUser(toStoreUser(data));
    },
    onError: () => {
      // Only reset the spinner. Rethrowing here used to be the last statement
      // in this callback, and React Query does not catch a throw from
      // `onError` -- so every failed sign-in also produced an unhandled promise
      // rejection, on top of the error `mutateAsync` already rejects with. The
      // screen has always had the error; this just stopped shouting about it.
      setLoading(false);
    },
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: registerApi,
  });
}

export function useVerifyEmail() {
  const setUser = useAuthStore((s) => s.setUser);

  return useMutation({
    mutationFn: verifyEmailApi,
    onSuccess: (data) => {
      setUser(toStoreUser(data));
    },
  });
}

export function useResendVerification() {
  return useMutation({
    mutationFn: resendVerificationApi,
  });
}

export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: requestPasswordResetApi,
  });
}

/**
 * Completing a reset revokes every refresh token for the account, including
 * one this device may still be holding from before. Clearing local auth on
 * success keeps the app honest about that rather than leaving a token that is
 * already dead and only fails on the next request.
 */
export function useResetPassword() {
  const clearAuth = useAuthStore((s) => s.clearAuth);

  return useMutation({
    mutationFn: ({ token, newPassword }: { token: string; newPassword: string }) =>
      resetPasswordApi(token, newPassword),
    onSuccess: async () => {
      await clearAuthTokens();
      clearAuth();
    },
  });
}

/**
 * True when the server has refused the reset token itself.
 *
 * The API answers 400 for a token that is unknown, expired or already spent,
 * with one message for all three, so that a caller cannot probe which tokens
 * ever existed. The screen cannot tell them apart either, and must not pretend
 * to: it shows one "this link no longer works" state and offers a new link.
 */
export function isRejectedResetToken(error: unknown): boolean {
  return error instanceof ApiRequestError && error.error.statusCode === 400;
}

/**
 * Error copy for the recovery screens.
 *
 * Separate from `getAuthErrorMessage` because two statuses mean something
 * different here: a 429 is a deliberate anti-abuse limit on a long window
 * rather than a mistyped password, and a 400 is the token, not the form.
 */
export function getRecoveryErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.error.statusCode === 0) {
      // Already written for a human, and in development it names the address
      // that failed.
      return error.error.message;
    }
    if (error.error.statusCode === 429) {
      return 'Too many requests. Password reset is limited to a few attempts every 15 minutes — please wait and try again.';
    }
    return error.error.message || 'Something went wrong. Please try again.';
  }
  return getErrorMessage(error);
}

export function useLogout() {
  const clearAuth = useAuthStore((s) => s.clearAuth);

  return useMutation({
    mutationFn: logoutApi,
    onSettled: async () => {
      await clearAuthTokens();
      clearAuth();
      router.replace('/(auth)/login');
    },
  });
}

export function useAuthBootstrap() {
  const setUser = useAuthStore((s) => s.setUser);
  const setLoading = useAuthStore((s) => s.setLoading);
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const checkAuth = useCallback(async () => {
    try {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) {
        setLoading(false);
        return;
      }

      const user = await me();
      setUser(user);
      setAuthenticated(true);
    } catch {
      await clearAuthTokens();
      clearAuth();
    } finally {
      setLoading(false);
    }
  }, [setUser, setLoading, setAuthenticated, clearAuth]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);
}

export function getAuthErrorMessage(error: unknown): string {
  return getErrorMessage(error);
}
