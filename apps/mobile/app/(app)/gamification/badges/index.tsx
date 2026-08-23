import React from 'react';
import { View, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { useBadges } from '../../../../src/hooks/useGamification';
import { Screen } from '../../../../src/components/Screen';
import { GlassCard } from '../../../../src/components';
import { AppText } from '../../../../src/components/AppText';
import { BadgeDisplay } from '../../../../src/components/gamification/BadgeDisplay';
import { colors, spacing } from '../../../../src/theme';

export default function BadgesScreen() {
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
        <View style={styles.loadingContainer}>
          <AppText variant="body" muted>Loading...</AppText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <AppText variant="display">
            Badges
          </AppText>
          <AppText variant="body" muted>
            {earnedBadges.length} of {badges?.length || 0} earned
          </AppText>
        </View>

        {earnedBadges.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <AppText variant="heading" style={{ color: colors.success }}>
                Earned
              </AppText>
              <View style={styles.countBadge}>
                <AppText variant="caption" style={{ color: colors.success }}>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
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
    backgroundColor: 'rgba(99, 194, 155, 0.15)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 10,
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
