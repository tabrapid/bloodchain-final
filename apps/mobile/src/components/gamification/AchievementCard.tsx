import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { spacing, radius, useTheme, ThemeColors } from '../../theme';
import { AppText } from '../../components/AppText';
import { GlassCard } from '../GlassCard';
import { Achievement } from '../../api/gamification';

interface AchievementCardProps {
  achievement: Achievement;
  showProgress?: boolean;
}

export const achievementIconMap: Record<string, string> = {
  droplet: 'D',
  'droplet-plus': 'D+',
  award: 'A',
  heart: 'H',
  'alert-circle': '!',
  users: 'U',
  activity: 'AC',
  'trending-up': 'TU',
  'user-check': 'UC',
  star: 'S',
  zap: 'Z',
  'calendar-check': 'CC',
};

export function AchievementCard({ achievement, showProgress = true }: AchievementCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isUnlocked = achievement.status === 'UNLOCKED';
  const isInProgress = achievement.status === 'IN_PROGRESS';

  return (
    <GlassCard style={styles.card}>
      <View style={styles.iconContainer}>
        <AppText style={styles.iconText} variant="title">
          {achievementIconMap[achievement.icon] || '?'}
        </AppText>
      </View>
      <View style={styles.content}>
        <View style={styles.header}>
          <AppText variant="heading" numberOfLines={1}>
            {achievement.name}
          </AppText>
          {isUnlocked && (
            <View style={styles.unlockedBadge}>
              <AppText variant="caption" style={{ color: colors.onMuted.success }}>
                UNLOCKED
              </AppText>
            </View>
          )}
        </View>
        <AppText variant="bodySmall" muted numberOfLines={2}>
          {achievement.description}
        </AppText>
        {showProgress && isInProgress && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${(achievement.progress / achievement.target) * 100}%` },
                ]}
              />
            </View>
            <AppText variant="caption" muted>
              {achievement.progress}/{achievement.target}
            </AppText>
          </View>
        )}
        <View style={styles.footer}>
          <View style={styles.rarityBadge}>
            <AppText variant="caption" muted>
              {achievement.rarity}
            </AppText>
          </View>
          <AppText variant="caption" style={{ color: colors.primary }}>
            +{achievement.xpReward} XP
          </AppText>
        </View>
      </View>
    </GlassCard>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      marginBottom: spacing.sm,
    },
    iconContainer: {
      width: 48,
      height: 48,
      borderRadius: radius.sm,
      backgroundColor: colors.surfaceHighlight,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing.md,
    },
    iconText: {
      color: colors.primary,
      fontSize: 20,
      fontWeight: '700',
    },
    content: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.xs,
    },
    unlockedBadge: {
      backgroundColor: colors.successMuted,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radius.sm,
    },
    progressContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.sm,
    },
    progressBar: {
      flex: 1,
      height: 4,
      backgroundColor: colors.surfaceHighlight,
      borderRadius: 2,
      marginRight: spacing.sm,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: colors.secondary,
      borderRadius: 2,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: spacing.sm,
    },
    rarityBadge: {
      backgroundColor: colors.surfaceHighlight,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radius.sm,
    },
  });
}
