import React, { useMemo } from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { spacing, radius, useTheme, ThemeColors } from '../../theme';
import { AppText } from '../../components/AppText';
import { LeaderboardEntry } from '../../api/gamification';

interface LeaderboardItemProps {
  entry: LeaderboardEntry;
  isCurrentUser?: boolean;
}

export function LeaderboardItem({ entry, isCurrentUser = false }: LeaderboardItemProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const showRankNumber = entry.rank <= 3;

  return (
    <View
      style={[
        styles.container,
        isCurrentUser && styles.currentUserContainer,
      ]}
    >
      <View style={styles.rankContainer}>
        {showRankNumber ? (
          <AppText variant="heading" style={{ color: colors.warning }}>
            #{entry.rank}
          </AppText>
        ) : (
          <AppText variant="heading" muted={!isCurrentUser} style={isCurrentUser ? { color: colors.primary } : undefined}>
            #{entry.rank}
          </AppText>
        )}
      </View>

      <View style={styles.avatarContainer}>
        {entry.avatarUrl ? (
          <Image source={{ uri: entry.avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <AppText variant="body" muted>
              {entry.displayName.charAt(0).toUpperCase()}
            </AppText>
          </View>
        )}
      </View>

      <View style={styles.infoContainer}>
        <AppText variant="body" numberOfLines={1}>
          {entry.displayName}
        </AppText>
        <View style={styles.statsRow}>
          <View style={styles.levelBadge}>
            <AppText variant="caption" style={{ color: colors.primary }}>
              Lv.{entry.level}
            </AppText>
          </View>
          <AppText variant="caption" muted>
            {entry.donationCount} donations
          </AppText>
        </View>
      </View>

      <View style={styles.xpContainer}>
        <AppText variant="heading" style={isCurrentUser ? { color: colors.primary } : undefined}>
          {entry.xp.toLocaleString()}
        </AppText>
        <AppText variant="caption" muted>
          XP
        </AppText>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceSolid,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    currentUserContainer: {
      borderColor: colors.primary,
      backgroundColor: 'rgba(216, 83, 96, 0.08)',
    },
    rankContainer: {
      width: 40,
      alignItems: 'center',
    },
    avatarContainer: {
      marginRight: spacing.md,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
    },
    avatarPlaceholder: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surfaceHighlight,
      justifyContent: 'center',
      alignItems: 'center',
    },
    infoContainer: {
      flex: 1,
    },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.xs,
    },
    levelBadge: {
      backgroundColor: colors.primaryMuted,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radius.sm,
      marginRight: spacing.sm,
    },
    xpContainer: {
      alignItems: 'flex-end',
    },
  });
}
