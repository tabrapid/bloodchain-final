import React from 'react';
import { View, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { useAchievements } from '../../../../src/hooks/useGamification';
import { Screen } from '../../../../src/components/Screen';
import { ScreenHeader } from '../../../../src/components';
import { AppText } from '../../../../src/components/AppText';
import { AchievementCard } from '../../../../src/components/gamification/AchievementCard';
import { layout, spacing, radius, useTheme, ThemeColors } from '../../../../src/theme';
import { useTranslation } from '../../../../src/i18n';

export default function AchievementsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const { data: achievements, isLoading, refetch } = useAchievements();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  if (isLoading && !achievements) {
    return (
      <Screen>
        <ScreenHeader title={t('gamification.achievements')} />
        <View style={styles.loadingContainer}>
          <AppText variant="body" muted>{t('common.loading')}</AppText>
        </View>
      </Screen>
    );
  }

  const unlockedCount = achievements?.unlocked.length || 0;
  const inProgressCount = achievements?.inProgress.length || 0;
  const lockedCount = achievements?.locked.length || 0;

  return (
    <Screen scroll={false}>
      <ScreenHeader
        title={t('gamification.achievements')}
        subtitle={`${unlockedCount} of ${unlockedCount + inProgressCount + lockedCount} unlocked`}
      />
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >

        {achievements && achievements.unlocked.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <AppText variant="heading" style={{ color: colors.success }}>
                {t('gamification.unlocked')}
              </AppText>
              <View style={styles.countBadge}>
                <AppText variant="caption" style={{ color: colors.onMuted.success }}>
                  {unlockedCount}
                </AppText>
              </View>
            </View>

            {achievements.unlocked.map((achievement) => (
              <AchievementCard key={achievement.id} achievement={achievement} showProgress={false} />
            ))}
          </View>
        )}

        {achievements && achievements.inProgress.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <AppText variant="heading" style={{ color: colors.warning }}>
                {t('gamification.inProgress')}
              </AppText>
              <View style={[styles.countBadge, styles.inProgressBadge]}>
                <AppText variant="caption" style={{ color: colors.onMuted.warning }}>
                  {inProgressCount}
                </AppText>
              </View>
            </View>

            {achievements.inProgress.map((achievement) => (
              <AchievementCard key={achievement.id} achievement={achievement} showProgress={true} />
            ))}
          </View>
        )}

        {achievements && achievements.locked.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <AppText variant="heading" muted>
                {t('gamification.locked')}
              </AppText>
              <View style={[styles.countBadge, styles.lockedBadge]}>
                <AppText variant="caption" muted>
                  {lockedCount}
                </AppText>
              </View>
            </View>

            {achievements.locked.map((achievement) => (
              <AchievementCard key={achievement.id} achievement={achievement} showProgress={false} />
            ))}
          </View>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    section: {
      marginBottom: layout.cardGap,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    countBadge: {
      backgroundColor: colors.successMuted,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radius.sm,
      marginLeft: spacing.sm,
    },
    inProgressBadge: {
      backgroundColor: colors.warningMuted,
    },
    lockedBadge: {
      backgroundColor: colors.surfaceHighlight,
    },
    bottomPadding: {
      height: spacing.xl,
    },
  });
}
