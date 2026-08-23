import { apiRequest } from './client';

export interface Challenge {
  id: string;
  title: string;
  description: string;
  type: 'DONATION_MILESTONE' | 'CAMPAIGN_PARTICIPATION' | 'EDUCATION' | 'COMMUNITY' | 'APPOINTMENT_COMPLETION' | 'CONSISTENCY';
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED';
  visibility: 'PUBLIC' | 'ORGANIZATION' | 'PRIVATE';
  organizationId?: string;
  startDate?: string;
  endDate?: string;
  goal: number;
  xpReward: number;
  badgeId?: string;
  createdAt: string;
  updatedAt: string;
  organization?: {
    id: string;
    name: string;
  };
  badge?: {
    id: string;
    name: string;
    icon: string;
  };
  participantCount?: number;
  userProgress?: number;
  completedAt?: string;
  joinedAt?: string;
}

export interface ChallengeListResponse {
  items: Challenge[];
  total: number;
  page: number;
  limit: number;
}

export interface ChallengeParticipant {
  id: string;
  challengeId: string;
  userId: string;
  progress: number;
  completedAt?: string;
  joinedAt: string;
}

export async function getChallenges(params?: {
  page?: number;
  limit?: number;
  type?: string;
  status?: string;
  visibility?: string;
}): Promise<ChallengeListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.type) searchParams.set('type', params.type);
  if (params?.status) searchParams.set('status', params.status);
  if (params?.visibility) searchParams.set('visibility', params.visibility);
  
  const query = searchParams.toString();
  return apiRequest<ChallengeListResponse>(`/challenges${query ? `?${query}` : ''}`);
}

export async function getActiveChallenges(): Promise<Challenge[]> {
  return apiRequest<Challenge[]>('/challenges/active');
}

export async function getChallenge(challengeId: string): Promise<Challenge> {
  return apiRequest<Challenge>(`/challenges/${challengeId}`);
}

export async function joinChallenge(challengeId: string): Promise<ChallengeParticipant> {
  return apiRequest<ChallengeParticipant>(`/challenges/${challengeId}/join`, {
    method: 'POST',
  });
}

export async function updateChallengeProgress(
  challengeId: string,
  progress: number
): Promise<ChallengeParticipant> {
  return apiRequest<ChallengeParticipant>(`/challenges/${challengeId}/progress`, {
    method: 'PUT',
    body: JSON.stringify({ progress }),
  });
}

export async function getMyChallenges(params?: {
  page?: number;
  limit?: number;
}): Promise<ChallengeListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  
  const query = searchParams.toString();
  return apiRequest<ChallengeListResponse>(`/challenges/my/challenges${query ? `?${query}` : ''}`);
}
