import { useQuery } from '@tanstack/react-query';
import {
  discoverOrganizations,
  getOrganization,
  type DiscoverParams,
  type DirectoryOrganization,
  type DiscoverResult,
} from '../api/organizations';

/**
 * Organization discovery for donors.
 *
 * The parameters are part of the query key, so changing a filter is a new
 * query rather than a refetch of the old answer -- which matters most for the
 * radius search, where the previous page of results is not a useful placeholder
 * for a different place.
 */
export function useDiscoverOrganizations(params: DiscoverParams = {}, enabled = true) {
  return useQuery<DiscoverResult>({
    queryKey: ['organizations', 'discover', params],
    queryFn: () => discoverOrganizations(params),
    enabled,
  });
}

export function useOrganization(id?: string) {
  return useQuery<DirectoryOrganization>({
    queryKey: ['organizations', 'detail', id],
    queryFn: () => getOrganization(id!),
    enabled: Boolean(id),
  });
}
