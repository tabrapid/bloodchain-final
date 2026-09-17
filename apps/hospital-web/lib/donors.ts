import { ApiRequestError, apiRequest, apiRequestEnvelope } from './api-client';

export { ApiRequestError };

export type BloodType = 'A' | 'B' | 'AB' | 'O';
export type RhFactor = 'POSITIVE' | 'NEGATIVE' | 'UNKNOWN';
export type DonorStatus = 'ACTIVE' | 'INACTIVE' | 'DEFERRED';
export type VerificationStatus = 'UNVERIFIED' | 'VERIFIED' | 'REQUIRES_REVIEW';

export type VerificationSource = 'BLOOD_CENTER' | 'HOSPITAL' | 'LABORATORY' | 'OTHER_AUTHORIZED_SOURCE';

export interface Donor {
  id: string;
  userId: string;
  bloodType: BloodType | null;
  rhFactor: RhFactor | null;
  city: string | null;
  district: string | null;
  donorStatus: DonorStatus;
  verificationStatus: VerificationStatus;
  /**
   * Provenance of the blood group above. All four are written by the server
   * when staff verify; a donor can never set them. When `bloodTypeVerifiedAt`
   * is null the group on the profile is the donor's own answer and nothing
   * more, which is why the table labels it as self-reported.
   */
  bloodTypeVerifiedAt: string | null;
  bloodTypeVerifiedBy: string | null;
  bloodTypeSource: VerificationSource | null;
  bloodTypeNote: string | null;
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
  verificationStatus?: VerificationStatus;
  city?: string;
  /** Matches the donor's first name, last name or email, case-insensitively. */
  search?: string;
}

export interface VerifyBloodTypeInput {
  bloodType: BloodType;
  rhFactor: RhFactor;
  source: VerificationSource;
  note?: string;
}

/**
 * Record a staff verification of a donor's blood group.
 *
 * Who verified it, when, and from what source are all decided server-side from
 * the caller's token — this request cannot claim any of them. The endpoint
 * requires the `donor.verify` permission and refuses a donor verifying
 * themselves.
 */
export async function verifyBloodType(
  donorUserId: string,
  input: VerifyBloodTypeInput,
): Promise<Donor> {
  return apiRequest<Donor>(`/donors/${donorUserId}/verify-blood-type`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function listDonors(params: ListDonorsParams = {}): Promise<PaginatedResponse<Donor>> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.bloodType) searchParams.set('bloodType', params.bloodType);
  if (params.donorStatus) searchParams.set('donorStatus', params.donorStatus);
  if (params.verificationStatus) searchParams.set('verificationStatus', params.verificationStatus);
  if (params.city) searchParams.set('city', params.city);
  if (params.search) searchParams.set('search', params.search);

  const query = searchParams.toString();
  // `/donors` (unlike inventory/appointment-slots) carries no
  // WrapResponseInterceptor either -- its `{ data, meta }` is the whole
  // response body, so this needs the envelope form for the same reason
  // inventory.ts's list endpoints do.
  const envelope = await apiRequestEnvelope<Donor[]>(`/donors${query ? `?${query}` : ''}`);
  return { data: envelope.data ?? [], meta: envelope.meta as PaginatedResponse<Donor>['meta'] };
}
