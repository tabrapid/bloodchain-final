import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { deleteAccount, getUserProfile, updateUserProfile, type UpdateUserProfileInput } from '../api/users';
import { clearAuthTokens } from '../auth/storage';
import { useAuthStore } from '../stores/auth.store';
import type { UserProfile } from '../api/users';

export function useUserProfile() {
  return useQuery<UserProfile>({
    queryKey: ['user-profile'],
    queryFn: getUserProfile,
  });
}

export function useUpdateUserProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateUserProfileInput) => updateUserProfile(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      queryClient.invalidateQueries({ queryKey: ['profile-completion'] });
    },
  });
}
/**
 * Closes the account, then leaves.
 *
 * On success the local session is cleared and the app goes to sign-in: the
 * server has already revoked every token, so there is nothing to keep. On
 * failure nothing local changes -- the account still exists and the donor is
 * told so on the screen that asked.
 */
export function useDeleteAccount() {
  const queryClient = useQueryClient();
  const clearAuth = useAuthStore((s) => s.clearAuth);

  return useMutation({
    mutationFn: deleteAccount,
    onSuccess: async () => {
      await clearAuthTokens();
      clearAuth();
      queryClient.clear();
      router.replace('/(auth)/login');
    },
  });
}
