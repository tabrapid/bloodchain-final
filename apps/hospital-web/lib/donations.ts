import { ApiRequestError, apiRequest } from './api-client';

export { ApiRequestError };

/**
 * The staff side of a blood donation: from a booked appointment to a completed
 * donation with a recorded volume.
 *
 * The API has carried this workflow all along -- check-in creates the donation
 * record, an assessment approves or defers the donor, collection is started and
 * then completed with the volume actually drawn -- but no console screen called
 * any of it. A donor could book from the phone and nobody could receive them.
 */
export interface DonationAppointmentDonor {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  bloodType?: string | null;
  rhFactor?: string | null;
}

export interface DonationAppointment {
  id: string;
  referenceNumber: string;
  appointmentType: string;
  status: string;
  scheduledStart: string;
  scheduledEnd?: string;
  donor: DonationAppointmentDonor;
  /** The donation record check-in created, once it exists. */
  donation?: { id: string; status: string; donationReference: string } | null;
}

export interface Donation {
  id: string;
  donationReference: string;
  donationType: string;
  status: string;
  bloodType?: string | null;
  rhFactor?: string | null;
  volumeMl?: number | null;
  collectionStartedAt?: string | null;
  collectionCompletedAt?: string | null;
  completedAt?: string | null;
  nextDonationDate?: string | null;
  createdAt?: string;
  donor?: DonationAppointmentDonor;
  appointment?: { id: string; referenceNumber: string } | null;
  /**
   * An approved assessment leaves the donation on CHECKED_IN, so status alone
   * cannot distinguish a donor who is waiting to be seen from one who has been
   * cleared. This is how the console tells them apart.
   */
  assessment?: { id: string; decision: string; assessedAt: string } | null;
}

export function getTodayAppointments(organizationId: string): Promise<DonationAppointment[]> {
  return apiRequest(`/organizations/${organizationId}/donations/today-appointments`);
}

export function getDonations(
  organizationId: string,
  params: { status?: string; search?: string } = {},
): Promise<Donation[]> {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.search) query.set('search', params.search);
  const suffix = query.toString() ? `?${query}` : '';
  return apiRequest(`/organizations/${organizationId}/donations${suffix}`);
}

export function checkInDonor(organizationId: string, appointmentId: string): Promise<Donation> {
  return apiRequest(`/organizations/${organizationId}/donations/check-in/${appointmentId}`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function recordAssessment(
  organizationId: string,
  donationId: string,
  body: { decision: 'APPROVED_FOR_DONATION' | 'DEFERRED' | 'NOT_COMPLETED'; reasonCategory?: string; notes?: string },
): Promise<Donation> {
  return apiRequest(`/organizations/${organizationId}/donations/${donationId}/assessment`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function startCollection(organizationId: string, donationId: string): Promise<Donation> {
  return apiRequest(`/organizations/${organizationId}/donations/${donationId}/start`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function completeDonation(
  organizationId: string,
  donationId: string,
  body: {
    volumeMl: number;
    bloodType?: string;
    rhFactor?: string;
    collectionStartedAt?: string;
    collectionCompletedAt?: string;
    nextDonationDate?: string;
    notes?: string;
  },
): Promise<Donation> {
  return apiRequest(`/organizations/${organizationId}/donations/${donationId}/complete`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function abortDonation(
  organizationId: string,
  donationId: string,
  body: { reason: string },
): Promise<Donation> {
  return apiRequest(`/organizations/${organizationId}/donations/${donationId}/abort`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
