import { ApiRequestError, apiRequestEnvelope } from './api-client';

export { ApiRequestError };

export type BloodType = 'A' | 'B' | 'AB' | 'O';
export type RhFactor = 'POSITIVE' | 'NEGATIVE' | 'UNKNOWN';
export type DonorStatus = 'ACTIVE' | 'INACTIVE' | 'DEFERRED';
export type VerificationStatus = 'UNVERIFIED' | 'VERIFIED' | 'REQUIRES_REVIEW';

export interface Donor {
  id: string;
  userId: string;
  bloodType: BloodType | null;
  rhFactor: RhFactor | null;
  city: string | null;
  district: string | null;
  donorStatus: DonorStatus;
  verificationStatus: VerificationStatus;
  createdAt: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ListDonorsParams {
  page?: number;
  limit?: number;
  bloodType?: BloodType;
  donorStatus?: DonorStatus;
  city?: string;
}

export async function listDonors(params: ListDonorsParams = {}): Promise<PaginatedResponse<Donor>> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.bloodType) searchParams.set('bloodType', params.bloodType);
  if (params.donorStatus) searchParams.set('donorStatus', params.donorStatus);
  if (params.city) searchParams.set('city', params.city);

  const query = searchParams.toString();
  // `/donors` (unlike inventory/appointment-slots) carries no
  // WrapResponseInterceptor either -- its `{ data, meta }` is the whole
  // response body, so this needs the envelope form for the same reason
  // inventory.ts's list endpoints do.
  const envelope = await apiRequestEnvelope<Donor[]>(`/donors${query ? `?${query}` : ''}`);
  return { data: envelope.data ?? [], meta: envelope.meta as PaginatedResponse<Donor>['meta'] };
}
