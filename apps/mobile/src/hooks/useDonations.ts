import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getMyDonations,
  getMyDonationStatistics,
  getDonation,
  type Donation,
  type DonationStatistics,
  type GetDonationsParams,
} from '../api/donations';

export function useMyDonations(params?: GetDonationsParams) {
  return useQuery<{ data: Donation[]; meta?: { page: number; limit: number; total: number; totalPages: number } }>({
    queryKey: ['my-donations', params],
    queryFn: () => getMyDonations(params),
  });
}

export function useDonationStatistics() {
  return useQuery<{ data: DonationStatistics }>({
    queryKey: ['donation-statistics'],
    queryFn: getMyDonationStatistics,
  });
}

export function useDonation(id: string) {
  return useQuery<{ data: Donation }>({
    queryKey: ['donation', id],
    queryFn: () => getDonation(id),
    enabled: !!id,
  });
}