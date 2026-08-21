import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getDonorProfile,
  getProfileCompletion,
  updateDonorProfile,
  type UpdateDonorProfileInput,
} from '../api/donors';
import type { DonorProfile, ProfileCompletion } from '../api/donors';

export function useDonorProfile() {
  return useQuery<{ data: DonorProfile }>({
    queryKey: ['donor-profile'],
    queryFn: getDonorProfile,
  });
}

export function useProfileCompletion() {
  return useQuery<{ data: ProfileCompletion }>({
    queryKey: ['profile-completion'],
    queryFn: getProfileCompletion,
  });
}

export function useUpdateDonorProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateDonorProfileInput) => updateDonorProfile(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['donor-profile'] });
      queryClient.invalidateQueries({ queryKey: ['profile-completion'] });
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
    },
  });
}