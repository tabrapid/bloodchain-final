import { useQuery, useMutation } from '@tanstack/react-query';
import {
  getGamificationProfile,
  getLevelProgress,
  getXpHistory,
  getAchievements,
  getBadges,
  getDonationStats,
  updateLeaderboardVisibility,
  getLeaderboard,
  getUserRank,
} from '../api/gamification';

export function useGamificationProfile() {
  return useQuery({
    queryKey: ['gamification', 'profile'],
    queryFn: () => getGamificationProfile(),
    select: (data) => data.data,
  });
}

export function useLevelProgress() {
  return useQuery({
    queryKey: ['gamification', 'progress'],
    queryFn: () => getLevelProgress(),
    select: (data) => data.data,
  });
}

export function useXpHistory(page = 1, limit = 20) {
  return useQuery({
    queryKey: ['gamification', 'xp-history', page, limit],
    queryFn: () => getXpHistory(page, limit),
    select: (data) => data.data,
  });
}

export function useAchievements() {
  return useQuery({
    queryKey: ['gamification', 'achievements'],
    queryFn: () => getAchievements(),
    select: (data) => data.data,
  });
}

export function useBadges() {
  return useQuery({
    queryKey: ['gamification', 'badges'],
    queryFn: () => getBadges(),
    select: (data) => data.data,
  });
}

export function useDonationStats() {
  return useQuery({
    queryKey: ['gamification', 'stats'],
    queryFn: () => getDonationStats(),
    select: (data) => data.data,
  });
}

export function useLeaderboard(timeRange: 'ALL_TIME' | 'THIS_YEAR' | 'THIS_MONTH' = 'ALL_TIME', page = 1, limit = 10) {
  return useQuery({
    queryKey: ['gamification', 'leaderboard', timeRange, page, limit],
    queryFn: () => getLeaderboard(timeRange, page, limit),
    select: (data) => data.data,
  });
}

export function useUserRank(timeRange: 'ALL_TIME' | 'THIS_YEAR' | 'THIS_MONTH' = 'ALL_TIME') {
  return useQuery({
    queryKey: ['gamification', 'rank', timeRange],
    queryFn: () => getUserRank(timeRange),
    select: (data) => data.data,
    retry: false,
  });
}

export function useUpdateLeaderboardVisibility() {
  return useMutation({
    mutationFn: (visible: boolean) => updateLeaderboardVisibility(visible),
  });
}
