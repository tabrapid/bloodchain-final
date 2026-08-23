import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, spacing, radius } from '../../theme';
import { AppText } from '../../components/AppText';
import { Badge } from '../../api/gamification';

interface BadgeDisplayProps {
  badge: Badge;
  size?: 'small' | 'medium' | 'large';
}

const rarityColors = {
  COMMON: colors.textMuted,
  RARE: '#3B82F6',
  EPIC: '#8B5CF6',
  LEGENDARY: '#F59E0B',
};

const iconMap: Record<string, string> = {
  droplet: 'D',
  award: 'A',
  heart: 'H',
  'alert-circle': '!',
  activity: 'AC',
  star: 'S',
  shield: 'SH',
};

export function BadgeDisplay({ badge, size = 'medium' }: BadgeDisplayProps) {
  const isEarned = !!badge.earnedAt;
  const iconSize = size === 'small' ? 24 : size === 'large' ? 48 : 36;
  const containerSize = iconSize + 16;

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.badgeCircle,
          {
            width: containerSize,
            height: containerSize,
            borderRadius: containerSize / 2,
            backgroundColor: isEarned ? colors.surfaceHighlight : colors.surface,
          },
        ]}
      >
        <AppText
          style={[
            styles.icon,
            {
              fontSize: iconSize * 0.5,
              color: isEarned ? rarityColors[badge.rarity] : colors.border,
            },
          ]}
        >
          {iconMap[badge.icon] || '?'}
        </AppText>
      </View>
      <AppText
        variant="bodySmall"
        muted={!isEarned}
        numberOfLines={1}
        style={styles.name}
      >
        {badge.name}
      </AppText>
      {isEarned && (
        <AppText variant="caption" muted>
          Earned
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: 80,
    marginRight: spacing.md,
  },
  badgeCircle: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    marginBottom: spacing.xs,
  },
  icon: {
    fontWeight: '700',
  },
  name: {
    textAlign: 'center',
    marginBottom: 2,
  },
});
