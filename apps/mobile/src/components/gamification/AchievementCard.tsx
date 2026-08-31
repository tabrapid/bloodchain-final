import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  Activity,
  AlertCircle,
  Award,
  CalendarCheck,
  Droplet,
  Droplets,
  Heart,
  Star,
  TrendingUp,
  UserCheck,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';
import { spacing, radius, useTheme, ThemeColors } from '../../theme';
import { AppText } from '../../components/AppText';
import { GlassCard } from '../GlassCard';
import { Achievement } from '../../api/gamification';

interface AchievementCardProps {
  achievement: Achievement;
  showProgress?: boolean;
}

// The backend's real icon keys (apps/api/src/modules/gamification/config/
// gamification.config.ts) are lucide icon names in kebab-case.
export const achievementIconMap: Record<string, LucideIcon> = {
  droplet: Droplet,
  'droplet-plus': Droplets,
  award: Award,
  heart: Heart,
  'alert-circle': AlertCircle,
  users: Users,
  activity: Activity,
  'trending-up': TrendingUp,
  'user-check': UserCheck,
  star: Star,
  zap: Zap,
  'calendar-check': CalendarCheck,
};

export function AchievementCard({ achievement, showProgress = true }: AchievementCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isUnlocked = achievement.status === 'UNLOCKED';
  const isInProgress = achievement.status === 'IN_PROGRESS';
  const Icon = achievementIconMap[achievement.icon] ?? Award;
  const iconColor = isUnlocked ? colors.onMuted.warning : isInProgress ? colors.textMuted : colors.textMuted;

  return (
    <GlassCard style={styles.card}>
      <View
        style={[
          styles.iconContainer,
          isUnlocked && styles.iconContainerUnlocked,
          isInProgress && styles.iconContainerInProgress,
          !isUnlocked && !isInProgress && styles.iconContainerLocked,
        ]}
      >
        <Icon size={22} color={iconColor} strokeWidth={isUnlocked ? 2.25 : 1.75} />
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
      borderWidth: 2,
      borderColor: 'transparent',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing.md,
    },
    // Earned: a gold ring + tinted fill, the same warning-accent treatment
    // used for badges/achievements everywhere else in the app.
    iconContainerUnlocked: {
      backgroundColor: colors.warningMuted,
      borderColor: colors.warning,
    },
    // In progress: a neutral ring so it reads as "active, not yet earned" --
    // distinct from both the gold ring (earned) and the dimmed, ringless
    // locked state below.
    iconContainerInProgress: {
      borderColor: colors.border,
    },
    // Locked: dimmed, no ring at all -- the clearest "not yet available" cue.
    iconContainerLocked: {
      opacity: 0.5,
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
