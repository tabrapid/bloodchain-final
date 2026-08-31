import { useQuery } from '@tanstack/react-query';
import { getDonorEmergencies } from '../api/emergency';

export function useDonorEmergencies() {
  return useQuery({
    queryKey: ['emergency', 'donor'],
    queryFn: getDonorEmergencies,
  });
}
