import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Shield } from 'lucide-react-native';
import { spacing, useTheme, ThemeColors } from '../../theme';
import { AppText } from '../../components/AppText';
import { Badge } from '../../api/gamification';
import { achievementIconMap } from './AchievementCard';
import { useTranslation } from '../../i18n';

interface BadgeDisplayProps {
  badge: Badge;
  size?: 'small' | 'medium' | 'large';
}

const rarityColorKey = {
  COMMON: 'textMuted',
  RARE: '#3B82F6',
  EPIC: '#8B5CF6',
  LEGENDARY: '#F59E0B',
} as const;

const badgeIconMap: Record<string, (typeof achievementIconMap)[string]> = {
  ...achievementIconMap,
  shield: Shield,
};

export function BadgeDisplay({ badge, size = 'medium' }: BadgeDisplayProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isEarned = !!badge.earnedAt;
  const iconSize = size === 'small' ? 20 : size === 'large' ? 32 : 26;
  const containerSize = iconSize + 24;
  const rarityKey = rarityColorKey[badge.rarity];
  const rarityColor = rarityKey === 'textMuted' ? colors.textMuted : rarityKey;
  const Icon = badgeIconMap[badge.icon] ?? Shield;

  return (
    <View style={[styles.container, !isEarned && styles.containerUnearned]}>
      <View
        style={[
          styles.badgeCircle,
          {
            width: containerSize,
            height: containerSize,
            borderRadius: containerSize / 2,
            backgroundColor: isEarned ? colors.surfaceHighlight : colors.surface,
            borderColor: isEarned ? rarityColor : colors.border,
          },
        ]}
      >
        <Icon size={iconSize} color={isEarned ? rarityColor : colors.textMuted} strokeWidth={isEarned ? 2.25 : 1.75} />
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
          {t('gamification.earned')}
        </AppText>
      )}
    </View>
  );
}

function createStyles(_colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      alignItems: 'center',
      width: 80,
      marginRight: spacing.md,
    },
    containerUnearned: {
      opacity: 0.5,
    },
    badgeCircle: {
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      marginBottom: spacing.xs,
    },
    name: {
      textAlign: 'center',
      marginBottom: 2,
    },
  });
}
