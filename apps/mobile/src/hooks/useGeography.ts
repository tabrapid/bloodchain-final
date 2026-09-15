import { useQuery } from '@tanstack/react-query';
import {
  getDistricts,
  getGeographyCoverage,
  getRegions,
  type District,
  type GeographyCoverage,
  type Region,
} from '../api/geography';

/**
 * Administrative geography changes about once a decade, so it is cached for the
 * session rather than refetched behind every picker.
 */
const STATIC_DATA = {
  staleTime: 24 * 60 * 60 * 1000,
  gcTime: 24 * 60 * 60 * 1000,
} as const;

export function useRegions() {
  return useQuery<Region[]>({
    queryKey: ['geography', 'regions'],
    queryFn: getRegions,
    ...STATIC_DATA,
  });
}

export function useDistricts(regionId?: string) {
  return useQuery<District[]>({
    queryKey: ['geography', 'districts', regionId ?? 'all'],
    queryFn: () => getDistricts(regionId),
    // Without a region this is every district in the country, which no picker
    // asks for; the query only runs once a region has been chosen.
    enabled: Boolean(regionId),
    ...STATIC_DATA,
  });
}

export function useGeographyCoverage() {
  return useQuery<GeographyCoverage>({
    queryKey: ['geography', 'coverage'],
    queryFn: getGeographyCoverage,
    ...STATIC_DATA,
  });
}
