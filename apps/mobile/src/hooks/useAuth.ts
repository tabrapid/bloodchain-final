import { useEffect, useCallback } from 'react';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { login as loginApi, register as registerApi, logout as logoutApi, me } from '../api/auth';
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

export function useLogin() {
  const setUser = useAuthStore((s) => s.setUser);
  const setLoading = useAuthStore((s) => s.setLoading);

  return useMutation({
    mutationFn: loginApi,
    onSuccess: (data) => {
      setUser({
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
      });
    },
    onError: (error: unknown) => {
      setLoading(false);
      throw error;
    },
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: registerApi,
  });
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
