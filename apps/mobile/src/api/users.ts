import { apiRequest } from './client';
import { apiBasePath } from './config';

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  avatarUrl?: string;
  phone?: string;
  dateOfBirth?: string;
  status: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  lastLoginAt?: string;
  donorProfile: {
    id: string;
    bloodType?: string;
    rhFactor?: string;
    bloodTypeVerifiedAt?: string;
    bloodTypeSource?: string;
    city?: string;
    district?: string;
    donorStatus: string;
    verificationStatus: string;
    dateOfBirth?: string;
    consentLocation: boolean;
  } | null;
  notificationPreference: {
    id: string;
    emergencyRequests: boolean;
    appointments: boolean;
    donationReminders: boolean;
    healthResults: boolean;
    system: boolean;
    promotional: boolean;
  } | null;
}

export interface UpdateUserProfileInput {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  phone?: string;
  city?: string;
  dateOfBirth?: string;
}

export async function getUserProfile(): Promise<{ data: UserProfile }> {
  return apiRequest(`${apiBasePath}/users/me`);
}

export async function updateUserProfile(
  input: UpdateUserProfileInput,
): Promise<{ data: UserProfile }> {
  return apiRequest(`${apiBasePath}/users/me`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}