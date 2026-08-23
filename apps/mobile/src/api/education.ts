import { apiRequest } from './client';

export interface EducationalContent {
  id: string;
  type: 'ARTICLE' | 'QUIZ' | 'VIDEO';
  title: string;
  description: string;
  body: string;
  imageUrl?: string;
  category: string;
  difficulty: string;
  xpReward: number;
  estimatedMinutes?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EducationalContentListResponse {
  items: EducationalContent[];
  total: number;
  page: number;
  limit: number;
}

export interface EducationProgress {
  id: string;
  userId: string;
  contentId: string;
  status: 'STARTED' | 'COMPLETED';
  startedAt: string;
  completedAt?: string;
  xpAwarded: number;
  content?: EducationalContent;
}

export interface EducationProgressListResponse {
  items: EducationProgress[];
  total: number;
  page: number;
  limit: number;
}

export interface EducationStats {
  totalStarted: number;
  totalCompleted: number;
  totalXpEarned: number;
}

export async function getEducationalContent(params?: {
  page?: number;
  limit?: number;
  type?: string;
  category?: string;
}): Promise<EducationalContentListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.type) searchParams.set('type', params.type);
  if (params?.category) searchParams.set('category', params.category);
  
  const query = searchParams.toString();
  return apiRequest<EducationalContentListResponse>(`/education${query ? `?${query}` : ''}`);
}

export async function getEducationalContentById(contentId: string): Promise<EducationalContent> {
  return apiRequest<EducationalContent>(`/education/${contentId}`);
}

export async function startContent(contentId: string): Promise<EducationProgress> {
  return apiRequest<EducationProgress>(`/education/${contentId}/start`, {
    method: 'POST',
  });
}

export async function completeContent(contentId: string): Promise<EducationProgress> {
  return apiRequest<EducationProgress>(`/education/${contentId}/complete`, {
    method: 'POST',
  });
}

export async function getMyEducationProgress(params?: {
  page?: number;
  limit?: number;
}): Promise<EducationProgressListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  
  const query = searchParams.toString();
  return apiRequest<EducationProgressListResponse>(`/education/my/progress${query ? `?${query}` : ''}`);
}

export async function getMyEducationStats(): Promise<EducationStats> {
  return apiRequest<EducationStats>('/education/my/stats');
}
