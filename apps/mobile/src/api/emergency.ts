import { apiRequest } from './client';

export interface EmergencyMatch {
  id: string;
  emergencyRequestId: string;
  donorId: string;
  status: string;
  matchedAt: string;
  viewedAt?: string;
  respondedAt?: string;
}

export interface EmergencyResponse {
  id: string;
  emergencyRequestId: string;
  matchId?: string;
  donorId: string;
  status: string;
  acceptedAt?: string;
  enRouteAt?: string;
  arrivedAt?: string;
  donationStartedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
}

export interface EmergencyLocation {
  id: string;
  emergencyResponseId: string;
  latitude: string;
  longitude: string;
  accuracy?: string;
  heading?: string;
  speed?: string;
  recordedAt: string;
}

export interface EmergencyRequest {
  id: string;
  emergencyReference: string;
  hospitalId: string;
  bloodType: string;
  rhFactor: string;
  unitsRequired: number;
  urgencyLevel: string;
  status: string;
  patientReference?: string;
  description?: string;
  requiredBefore?: string;
  donationLocation?: string;
  latitude?: string;
  longitude?: string;
  unitsCollected: number;
  createdAt: string;
  updatedAt: string;
  hospital: {
    id: string;
    name: string;
    address?: string;
  };
  matchId?: string;
  matchStatus?: string;
  canAccept?: boolean;
  responseId?: string;
  responseStatus?: string;
}

export interface DonorEmergenciesResponse {
  data: {
    active: EmergencyRequest[];
    myResponses: EmergencyRequest[];
  };
}

export async function getDonorEmergencies(): Promise<DonorEmergenciesResponse> {
  return apiRequest<DonorEmergenciesResponse>('/donor/emergencies');
}

export async function viewEmergencyMatch(matchId: string): Promise<EmergencyMatch> {
  return apiRequest<EmergencyMatch>(`/donor/emergency-matches/${matchId}/view`, {
    method: 'POST',
  });
}

export async function acceptEmergency(matchId: string): Promise<EmergencyResponse> {
  return apiRequest<EmergencyResponse>(`/donor/emergency-matches/${matchId}/accept`, {
    method: 'POST',
  });
}

export async function declineEmergency(matchId: string): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>(`/donor/emergency-matches/${matchId}/decline`, {
    method: 'POST',
  });
}

export async function startJourney(responseId: string): Promise<EmergencyResponse> {
  return apiRequest<EmergencyResponse>(`/donor/emergency-responses/${responseId}/start-journey`, {
    method: 'POST',
  });
}

export async function updateLocation(
  responseId: string,
  location: { latitude: number; longitude: number; accuracy?: number; heading?: number; speed?: number }
): Promise<EmergencyLocation> {
  return apiRequest<EmergencyLocation>(`/donor/emergency-responses/${responseId}/update-location`, {
    method: 'POST',
    body: JSON.stringify(location),
  });
}

export async function arriveAtHospital(responseId: string): Promise<EmergencyResponse> {
  return apiRequest<EmergencyResponse>(`/donor/emergency-responses/${responseId}/arrive`, {
    method: 'POST',
  });
}

export async function getDonorTracking(responseId: string): Promise<EmergencyResponse> {
  return apiRequest<EmergencyResponse>(`/donor/emergency-responses/${responseId}/tracking`);
}

export async function cancelResponse(
  responseId: string,
  reason?: string
): Promise<EmergencyResponse> {
  return apiRequest<EmergencyResponse>(`/donor/emergency-responses/${responseId}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}
