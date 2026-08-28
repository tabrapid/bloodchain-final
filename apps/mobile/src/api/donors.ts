import { apiRequest } from './client';
import { apiBasePath } from './config';

export interface DonorProfile {
  id: string;
  userId: string;
  bloodType?: string;
  rhFactor?: string;
  bloodTypeVerifiedAt?: string;
  bloodTypeSource?: string;
  city?: string;
  district?: string;
  latitude?: number;
  longitude?: number;
  donorStatus: string;
  verificationStatus: string;
  dateOfBirth?: string;
  consentLocation: boolean;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    displayName?: string;
    avatarUrl?: string;
    dateOfBirth?: string;
  };
}

export interface ProfileCompletion {
  percentage: number;
  completed: string[];
  missing: string[];
}

export interface UpdateDonorProfileInput {
  bloodType?: string;
  rhFactor?: string;
  city?: string;
  district?: string;
  donorStatus?: string;
  dateOfBirth?: string;
  consentLocation?: boolean;
  latitude?: number;
  longitude?: number;
}

export async function getDonorProfile(): Promise<DonorProfile> {
  return apiRequest(`${apiBasePath}/donors/profile`);
}

export async function updateDonorProfile(
  input: UpdateDonorProfileInput,
): Promise<DonorProfile> {
  return apiRequest(`${apiBasePath}/donors/profile`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function getProfileCompletion(): Promise<{ data: ProfileCompletion }> {
  return apiRequest(`${apiBasePath}/donors/profile/completion`);
}