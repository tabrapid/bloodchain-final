import { apiRequest } from './client';

export interface Campaign {
  id: string;
  organizationId: string;
  title: string;
  description: string;
  imageUrl?: string;
  startDate: string;
  endDate: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  bloodGroupsNeeded: string[];
  targetParticipants?: number;
  status: 'DRAFT' | 'PUBLISHED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
  organization?: {
    id: string;
    name: string;
  };
  participantCount?: number;
  joinedAt?: string;
  participantStatus?: string;
}

export interface CampaignListResponse {
  items: Campaign[];
  total: number;
  page: number;
  limit: number;
}

export interface CampaignParticipant {
  id: string;
  campaignId: string;
  userId: string;
  status: string;
  joinedAt: string;
  completedAt?: string;
}

export async function getCampaigns(params?: {
  page?: number;
  limit?: number;
  status?: string;
  organizationId?: string;
}): Promise<CampaignListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.status) searchParams.set('status', params.status);
  if (params?.organizationId) searchParams.set('organizationId', params.organizationId);
  
  const query = searchParams.toString();
  return apiRequest<CampaignListResponse>(`/campaigns${query ? `?${query}` : ''}`);
}

export async function getCampaign(campaignId: string): Promise<Campaign> {
  return apiRequest<Campaign>(`/campaigns/${campaignId}`);
}

export async function joinCampaign(campaignId: string): Promise<CampaignParticipant> {
  return apiRequest<CampaignParticipant>(`/campaigns/${campaignId}/join`, {
    method: 'POST',
  });
}

export async function leaveCampaign(campaignId: string): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>(`/campaigns/${campaignId}/leave`, {
    method: 'DELETE',
  });
}

export async function getMyCampaigns(params?: {
  page?: number;
  limit?: number;
}): Promise<CampaignListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  
  const query = searchParams.toString();
  return apiRequest<CampaignListResponse>(`/campaigns/my/campaigns${query ? `?${query}` : ''}`);
}
