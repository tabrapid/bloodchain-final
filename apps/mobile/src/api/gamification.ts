import { apiRequest } from './client';
import { apiBasePath } from './config';

export interface GamificationProfile {
  level: number;
  totalXp: number;
  xpToNextLevel: number;
  progress: number;
  reputationScore: number;
  donationCount: number;
  emergencyResponseCount: number;
  bloodTestCount: number;
  rank?: number;
  nextEligibleDonationDate?: string;
}

export interface LevelProgress {
  currentLevel: number;
  currentLevelName: string;
  currentXp: number;
  xpForNextLevel: number;
  xpToNextLevel: number;
  progress: number;
  nextLevelName: string;
  isMaxLevel: boolean;
}

export interface XpTransaction {
  id: string;
  amount: number;
  type: string;
  description: string;
  createdAt: string;
}

export interface XpHistory {
  transactions: XpTransaction[];
  total: number;
  page: number;
  limit: number;
}

export interface Achievement {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
  xpReward: number;
  progress: number;
  target: number;
  status: 'LOCKED' | 'IN_PROGRESS' | 'UNLOCKED';
  unlockedAt?: string;
}

export interface AchievementList {
  unlocked: Achievement[];
  inProgress: Achievement[];
  locked: Achievement[];
}

export interface Badge {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
  earnedAt?: string;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  level: number;
  xp: number;
  donationCount: number;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  timeRange: string;
  total: number;
  page: number;
  limit: number;
}

export interface UserRank {
  rank: number;
  total: number;
  level: number;
  xp: number;
}

export interface DonationStats {
  totalDonations: number;
  successfulEmergencyResponses: number;
  bloodTestsCompleted: number;
  totalBloodVolume?: number;
}

export async function getGamificationProfile(): Promise<GamificationProfile> {
  return apiRequest(`${apiBasePath}/me/gamification`);
}

export async function getLevelProgress(): Promise<LevelProgress> {
  return apiRequest(`${apiBasePath}/me/gamification/progress`);
}

export async function getXpHistory(page = 1, limit = 20): Promise<XpHistory> {
  return apiRequest(`${apiBasePath}/me/gamification/xp?page=${page}&limit=${limit}`);
}

export async function getAchievements(): Promise<AchievementList> {
  return apiRequest(`${apiBasePath}/me/gamification/achievements`);
}

export async function getBadges(): Promise<Badge[]> {
  return apiRequest(`${apiBasePath}/me/gamification/badges`);
}

export async function getDonationStats(): Promise<DonationStats> {
  return apiRequest(`${apiBasePath}/me/gamification/stats`);
}

export async function updateLeaderboardVisibility(visible: boolean): Promise<{ success: boolean }> {
  return apiRequest(`${apiBasePath}/me/gamification/leaderboard-visibility`, {
    method: 'POST',
    body: JSON.stringify({ visible }),
  });
}

export async function getLeaderboard(
  timeRange: 'ALL_TIME' | 'THIS_YEAR' | 'THIS_MONTH' = 'ALL_TIME',
  page = 1,
  limit = 10,
): Promise<LeaderboardResponse> {
  return apiRequest(`${apiBasePath}/leaderboard?timeRange=${timeRange}&page=${page}&limit=${limit}`);
}

export async function getUserRank(
  timeRange: 'ALL_TIME' | 'THIS_YEAR' | 'THIS_MONTH' = 'ALL_TIME',
): Promise<UserRank> {
  return apiRequest(`${apiBasePath}/leaderboard/me?timeRange=${timeRange}`);
}
