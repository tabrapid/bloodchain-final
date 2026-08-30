import React from 'react';
import { View, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { useBadges } from '../../../../src/hooks/useGamification';
import { Screen } from '../../../../src/components/Screen';
import { GlassCard, ScreenHeader } from '../../../../src/components';
import { AppText } from '../../../../src/components/AppText';
import { BadgeDisplay } from '../../../../src/components/gamification/BadgeDisplay';
import { spacing, radius, useTheme, ThemeColors } from '../../../../src/theme';

export default function BadgesScreen() {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const { data: badges, isLoading, refetch } = useBadges();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, []);

  const earnedBadges = badges?.filter((b) => b.earnedAt) || [];
  const unearnedBadges = badges?.filter((b) => !b.earnedAt) || [];

  if (isLoading && !badges) {
    return (
      <Screen>
        <ScreenHeader title="Badges" />
        <View style={styles.loadingContainer}>
          <AppText variant="body" muted>Loading...</AppText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <ScreenHeader
        title="Badges"
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
                Earned
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
                Not Yet Earned
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
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.lg,
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
      marginBottom: spacing.md,
    },
    bottomPadding: {
      height: spacing.xl,
    },
  });
}
