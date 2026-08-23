import { apiRequest } from './client';

export interface CommunityPost {
  id: string;
  type: 'CAMPAIGN' | 'EDUCATION' | 'MILESTONE' | 'ACHIEVEMENT' | 'COMMUNITY_UPDATE' | 'ANNOUNCEMENT' | 'IMPACT';
  title: string;
  body: string;
  imageUrl?: string;
  status: 'DRAFT' | 'PUBLISHED' | 'HIDDEN' | 'REMOVED';
  publishedAt: string;
  createdAt: string;
  author?: {
    id: string;
    displayName?: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
  };
  organization?: {
    id: string;
    name: string;
  };
  campaign?: {
    id: string;
    title: string;
  };
  achievement?: {
    id: string;
    name: string;
    icon: string;
  };
  metadata?: any;
}

export interface FeedResponse {
  items: CommunityPost[];
  total: number;
  page: number;
  limit: number;
}

export interface ImpactStats {
  donations: number;
  appointments: number;
  campaignParticipations: number;
  challengeCompletions: number;
  educationCompletions: number;
  xp: number;
  level: number;
  reputation: number;
}

export interface CommunityStats {
  posts: number;
  campaigns: number;
  challenges: number;
  participants: number;
  activeCampaigns: number;
  activeChallenges: number;
}

export interface ContentReport {
  id: string;
  postId: string;
  reporterId: string;
  reason: string;
  description?: string;
  status: string;
  createdAt: string;
}

export async function getFeed(params?: {
  page?: number;
  limit?: number;
  type?: string;
}): Promise<FeedResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.type) searchParams.set('type', params.type);
  
  const query = searchParams.toString();
  return apiRequest<FeedResponse>(`/community/feed${query ? `?${query}` : ''}`);
}

export async function getPost(postId: string): Promise<CommunityPost> {
  return apiRequest<CommunityPost>(`/community/posts/${postId}`);
}

export async function reportContent(
  postId: string,
  reason: string,
  description?: string
): Promise<ContentReport> {
  return apiRequest<ContentReport>(`/community/posts/${postId}/report`, {
    method: 'POST',
    body: JSON.stringify({ reason, description }),
  });
}

export async function getImpactStats(): Promise<ImpactStats> {
  return apiRequest<ImpactStats>('/community/impact');
}

export async function getCommunityStats(): Promise<CommunityStats> {
  return apiRequest<CommunityStats>('/community/stats');
}
