import React from 'react';
import { View, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { useBadges } from '../../../../src/hooks/useGamification';
import { Screen } from '../../../../src/components/Screen';
import { ErrorState, ScreenHeader } from '../../../../src/components';
import { AppText } from '../../../../src/components/AppText';
import { BadgeDisplay } from '../../../../src/components/gamification/BadgeDisplay';
import { layout, spacing, radius, useTheme, ThemeColors } from '../../../../src/theme';
import { useTranslation } from '../../../../src/i18n';

export default function BadgesScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const { data: badges, isLoading, isError, refetch } = useBadges();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const earnedBadges = badges?.filter((b) => b.earnedAt) || [];
  const unearnedBadges = badges?.filter((b) => !b.earnedAt) || [];

  if (isLoading && !badges) {
    return (
      <Screen>
        <ScreenHeader title={t('gamification.badges')} />
        <View style={styles.loadingContainer}>
          <AppText variant="body" muted>{t('common.loading')}</AppText>
        </View>
      </Screen>
    );
  }

  // A network failure used to render as an empty screen, which reads as
  // "you have none" -- a different and wrong answer.
  if (isError && !badges) {
    return (
      <Screen>
        <ScreenHeader title={t('gamification.badges')} />
        <ErrorState onRetry={() => void refetch()} />
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <ScreenHeader
        title={t('gamification.badges')}
        subtitle={`${earnedBadges.length} of ${badges?.length || 0} earned`}
      />
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >

        {earnedBadges.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <AppText variant="heading" style={{ color: colors.success }}>
                {t('gamification.earned')}
              </AppText>
              <View style={styles.countBadge}>
                <AppText variant="caption" style={{ color: colors.onMuted.success }}>
                  {earnedBadges.length}
                </AppText>
              </View>
            </View>

            <View style={styles.badgesGrid}>
              {earnedBadges.map((badge) => (
                <View key={badge.id} style={styles.badgeItem}>
                  <BadgeDisplay badge={badge} size="large" />
                </View>
              ))}
            </View>
          </View>
        )}

        {unearnedBadges.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <AppText variant="heading" muted>
                {t('gamification.notYetEarned')}
              </AppText>
              <View style={[styles.countBadge, styles.lockedBadge]}>
                <AppText variant="caption" muted>
                  {unearnedBadges.length}
                </AppText>
              </View>
            </View>

            <View style={styles.badgesGrid}>
              {unearnedBadges.map((badge) => (
                <View key={badge.id} style={styles.badgeItem}>
                  <BadgeDisplay badge={badge} size="large" />
                </View>
              ))}
            </View>
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
    lockedBadge: {
      backgroundColor: colors.surfaceHighlight,
    },
    badgesGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginHorizontal: -spacing.sm,
    },
    badgeItem: {
      marginHorizontal: spacing.xs,
      marginBottom: layout.cardGap,
    },
    bottomPadding: {
      height: spacing.xl,
    },
  });
}
