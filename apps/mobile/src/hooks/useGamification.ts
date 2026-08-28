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
  });
}

export function useLevelProgress() {
  return useQuery({
    queryKey: ['gamification', 'progress'],
    queryFn: () => getLevelProgress(),
  });
}

export function useXpHistory(page = 1, limit = 20) {
  return useQuery({
    queryKey: ['gamification', 'xp-history', page, limit],
    queryFn: () => getXpHistory(page, limit),
  });
}

export function useAchievements() {
  return useQuery({
    queryKey: ['gamification', 'achievements'],
    queryFn: () => getAchievements(),
  });
}

export function useBadges() {
  return useQuery({
    queryKey: ['gamification', 'badges'],
    queryFn: () => getBadges(),
  });
}

export function useDonationStats() {
  return useQuery({
    queryKey: ['gamification', 'stats'],
    queryFn: () => getDonationStats(),
  });
}

export function useLeaderboard(timeRange: 'ALL_TIME' | 'THIS_YEAR' | 'THIS_MONTH' = 'ALL_TIME', page = 1, limit = 10) {
  return useQuery({
    queryKey: ['gamification', 'leaderboard', timeRange, page, limit],
    queryFn: () => getLeaderboard(timeRange, page, limit),
  });
}

export function useUserRank(timeRange: 'ALL_TIME' | 'THIS_YEAR' | 'THIS_MONTH' = 'ALL_TIME') {
  return useQuery({
    queryKey: ['gamification', 'rank', timeRange],
    queryFn: () => getUserRank(timeRange),
    retry: false,
  });
}

export function useUpdateLeaderboardVisibility() {
  return useMutation({
    mutationFn: (visible: boolean) => updateLeaderboardVisibility(visible),
  });
}
