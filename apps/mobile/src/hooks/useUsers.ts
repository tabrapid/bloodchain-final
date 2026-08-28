import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getUserProfile, updateUserProfile, type UpdateUserProfileInput } from '../api/users';
import type { UserProfile } from '../api/users';

export function useUserProfile() {
  return useQuery<{ data: UserProfile }>({
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