import { apiRequest } from './client';
import { apiBasePath } from './config';

export interface Organization {
  id: string;
  type: string;
  name: string;
  address?: string;
}

export interface Donation {
  id: string;
  donationReference: string;
  donationType: string;
  status: string;
  bloodType?: string;
  rhFactor?: string;
  volumeMl?: number;
  collectionStartedAt?: string;
  collectionCompletedAt?: string;
  nextDonationDate?: string;
  cancellationReason?: string;
  cancelledAt?: string;
  abortedReason?: string;
  abortedAt?: string;
  rejectedReason?: string;
  rejectedAt?: string;
  completedAt?: string;
  createdAt: string;
  organization: Organization;
  appointment?: {
    id: string;
    referenceNumber: string;
  };
}

export interface DonationStatistics {
  totalDonations: number;
  totalVolumeMl: number;
  lastDonationAt?: string;
  nextDonationDate?: string;
  completedCount: number;
  cancelledCount: number;
  abortedCount: number;
}

export interface GetDonationsParams {
  status?: string;
  upcoming?: boolean;
  past?: boolean;
  date?: string;
  organizationId?: string;
  page?: number;
  limit?: number;
}

export async function getMyDonations(params?: GetDonationsParams): Promise<{
  data: Donation[];
  meta?: { page: number; limit: number; total: number; totalPages: number };
}> {
  const queryParams = new URLSearchParams();
  if (params?.status) queryParams.set('status', params.status);
  if (params?.upcoming) queryParams.set('upcoming', 'true');
  if (params?.past) queryParams.set('past', 'true');
  if (params?.date) queryParams.set('date', params.date);
  if (params?.organizationId) queryParams.set('organizationId', params.organizationId);
  if (params?.page) queryParams.set('page', String(params.page));
  if (params?.limit) queryParams.set('limit', String(params.limit));

  const query = queryParams.toString();
  return apiRequest(`${apiBasePath}/donations/me${query ? `?${query}` : ''}`);
}

export async function getMyDonationStatistics(): Promise<{ data: DonationStatistics }> {
  return apiRequest(`${apiBasePath}/donations/me/statistics`);
}

export async function getDonation(id: string): Promise<{ data: Donation }> {
  return apiRequest(`${apiBasePath}/donations/${id}`);
}