export const USER_ROLES = [
  'DONOR',
  'HOSPITAL_ADMIN',
  'HOSPITAL_STAFF',
  'BLOOD_CENTER_ADMIN',
  'BLOOD_CENTER_STAFF',
  'COURIER',
  'SUPER_ADMIN',
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const ORGANIZATION_TYPES = ['HOSPITAL', 'BLOOD_CENTER'] as const;
export type OrganizationType = (typeof ORGANIZATION_TYPES)[number];

export const ORGANIZATION_STATUSES = [
  'ACTIVE',
  'SUSPENDED',
  'PENDING_APPROVAL',
  'DEACTIVATED',
] as const;
export type OrganizationStatus = (typeof ORGANIZATION_STATUSES)[number];

export const USER_STATUSES = [
  'ACTIVE',
  'SUSPENDED',
  'DEACTIVATED',
  'PENDING_VERIFICATION',
] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const BLOOD_TYPES = ['A', 'B', 'AB', 'O'] as const;
export type BloodType = (typeof BLOOD_TYPES)[number];

export const RH_FACTORS = ['POSITIVE', 'NEGATIVE', 'UNKNOWN'] as const;
export type RhFactor = (typeof RH_FACTORS)[number];

export const DONOR_STATUSES = ['ACTIVE', 'INACTIVE', 'DEFERRED'] as const;
export type DonorStatus = (typeof DONOR_STATUSES)[number];

export const VERIFICATION_STATUSES = ['UNVERIFIED', 'VERIFIED', 'REQUIRES_REVIEW'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const APPOINTMENT_TYPES = ['BLOOD_DONATION', 'BLOOD_TEST', 'CONSULTATION'] as const;
export type AppointmentType = (typeof APPOINTMENT_TYPES)[number];

export const APPOINTMENT_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
  'RESCHEDULED',
  'EXPIRED',
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const SLOT_STATUSES = ['AVAILABLE', 'FULL', 'BLOCKED', 'CANCELLED', 'EXPIRED'] as const;
export type SlotStatus = (typeof SLOT_STATUSES)[number];

export const DONATION_TYPES = ['WHOLE_BLOOD', 'PLASMA', 'PLATELETS', 'OTHER'] as const;
export type DonationType = (typeof DONATION_TYPES)[number];

export const DONATION_STATUSES = [
  'SCHEDULED',
  'CHECKED_IN',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'ABORTED',
  'NO_SHOW',
  'REJECTED',
] as const;
export type DonationStatus = (typeof DONATION_STATUSES)[number];

export const BLOOD_UNIT_STATUSES = ['COLLECTED', 'AVAILABLE', 'RESERVED', 'USED', 'EXPIRED', 'DISCARDED'] as const;
export type BloodUnitStatus = (typeof BLOOD_UNIT_STATUSES)[number];

export interface ApiError {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  data: T;
  meta?: PaginationMeta;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  status: UserStatus;
  roles: UserRole[];
  permissions: string[];
}

export interface DonorProfileSummary {
  id: string;
  bloodType?: BloodType;
  rhFactor?: RhFactor;
  city?: string;
  donorStatus: DonorStatus;
  verificationStatus: VerificationStatus;
  dateOfBirth?: string;
}

export interface UserOrganization {
  membershipId: string;
  organizationId: string;
  name: string;
  type: OrganizationType;
  role: UserRole;
  status: string;
}
