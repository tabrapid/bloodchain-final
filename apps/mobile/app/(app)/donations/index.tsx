import { useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { Droplet, Calendar, Building2, ChevronRight } from 'lucide-react-native';
import { AppText, Card, EmptyState, GlassCard, Screen, ScreenHeader } from '../../../src/components';
import { useMyDonations, useDonationStatistics } from '../../../src/hooks/useDonations';
import { type Donation } from '../../../src/api/donations';
import { spacing, radius, useTheme, ThemeColors } from '../../../src/theme';

export default function DonationsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [filter, setFilter] = useState<'all' | 'completed' | 'cancelled'>('all');

  const { data, isLoading, refetch, isRefetching } = useMyDonations(
    filter === 'all' ? { past: true } : filter === 'completed' ? { status: 'COMPLETED', past: true } : { status: 'CANCELLED', past: true }
  );
  const { data: stats } = useDonationStatistics();

  const donations: Donation[] = data?.data || [];

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return { bg: colors.successMuted, text: colors.onMuted.success };
      case 'CANCELLED':
      case 'ABORTED':
      case 'REJECTED':
        return { bg: colors.dangerMuted, text: colors.onMuted.danger };
      case 'IN_PROGRESS':
        return { bg: colors.warningMuted, text: colors.onMuted.warning };
      default:
        return { bg: colors.surfaceElevated, text: colors.textMuted };
    }
  };

  const renderDonation = ({ item: donation }: { item: Donation }) => (
    <TouchableOpacity
      onPress={() => router.push(`/donations/${donation.id}`)}
      activeOpacity={0.8}
    >
      <GlassCard style={styles.donationCard}>
        <View style={styles.donationHeader}>
          <View style={styles.donationType}>
            <Droplet size={18} color={colors.primary} />
            <AppText style={styles.donationTypeText}>
              {donation.donationType.replace('_', ' ')}
            </AppText>
          </View>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(donation.status).bg },
            ]}
          >
            <AppText
              style={[styles.statusText, { color: getStatusColor(donation.status).text }]}
            >
              {donation.status}
            </AppText>
          </View>
        </View>

        <View style={styles.donationDetails}>
          <View style={styles.detailRow}>
            <Calendar size={14} color={colors.textMuted} />
            <AppText muted style={styles.detailText}>
              {donation.collectionCompletedAt
                ? formatDate(donation.collectionCompletedAt)
                : formatDate(donation.createdAt)}
            </AppText>
          </View>
          <View style={styles.detailRow}>
            <Building2 size={14} color={colors.textMuted} />
            <AppText muted style={styles.detailText}>
              {donation.organization.name}
            </AppText>
          </View>
        </View>

        <View style={styles.donationFooter}>
          <View>
            <AppText muted style={styles.refLabel}>
              Reference
            </AppText>
            <AppText style={styles.refText}>
              {donation.donationReference}
            </AppText>
          </View>
          {donation.volumeMl && (
            <View style={styles.volumeBadge}>
              <AppText style={styles.volumeText}>{donation.volumeMl} ml</AppText>
            </View>
          )}
          <ChevronRight size={18} color={colors.textMuted} />
        </View>
      </GlassCard>
    </TouchableOpacity>
  );

  return (
    <Screen scroll={false}>
      <ScreenHeader title="Donation History" subtitle="All your previous donations" />
      <FlatList
        style={styles.scrollView}
        data={donations}
        renderItem={renderDonation}
        keyExtractor={(donation) => donation.id}
        contentContainerStyle={styles.donationsList}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <>
            {stats && (
              <GlassCard tier="elevated" style={styles.statsCard}>
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <AppText variant="heading" style={styles.statValue}>
                      {stats.totalDonations}
                    </AppText>
                    <AppText muted style={styles.statLabel}>
                      Total donations
                    </AppText>
                  </View>
                  <View style={styles.statItem}>
                    <AppText variant="heading" style={styles.statValue}>
                      {(stats.totalVolumeMl / 1000).toFixed(1)}L
                    </AppText>
                    <AppText muted style={styles.statLabel}>
                      Volume donated
                    </AppText>
                  </View>
                  <View style={styles.statItem}>
                    <AppText variant="heading" style={styles.statValue}>
                      {stats.completedCount}
                    </AppText>
                    <AppText muted style={styles.statLabel}>
                      Completed
                    </AppText>
                  </View>
                </View>
              </GlassCard>
            )}

            <View style={styles.filterTabs}>
              {(['all', 'completed', 'cancelled'] as const).map((tab) => (
                <TouchableOpacity
                  key={tab}
                  style={[styles.filterTab, filter === tab && styles.filterTabActive]}
                  onPress={() => setFilter(tab)}
                >
                  <AppText
                    style={[styles.filterTabText, filter === tab && styles.filterTabTextActive]}
                  >
                    {tab === 'all' ? 'All' : tab === 'completed' ? 'Completed' : 'Cancelled'}
                  </AppText>
                </TouchableOpacity>
              ))}
            </View>
          </>
        }
        ListEmptyComponent={
          isLoading ? (
            <Card style={styles.loadingCard}>
              <AppText muted>Loading donations...</AppText>
            </Card>
          ) : (
            <Card style={styles.emptyCard}>
              <EmptyState
                title="No donations yet"
                description={
                  filter === 'all'
                    ? "Your donation history will appear here once you complete a donation."
                    : `No ${filter} donations found.`
                }
              />
            </Card>
          )
        }
      />
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    statsCard: {
      marginBottom: spacing.lg,
    },
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
    },
    statItem: {
      alignItems: 'center',
    },
    statValue: {
      fontSize: 20,
    },
    statLabel: {
      fontSize: 11,
      marginTop: 2,
    },
    filterTabs: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceSolid,
      borderRadius: radius.sm,
      padding: spacing.xs,
      marginBottom: spacing.lg,
    },
    filterTab: {
      flex: 1,
      paddingVertical: spacing.sm,
      alignItems: 'center',
      borderRadius: radius.sm - 2,
    },
    filterTabActive: {
      backgroundColor: colors.primary,
    },
    filterTabText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textMuted,
    },
    filterTabTextActive: {
      color: colors.white,
    },
    scrollView: {
      flex: 1,
    },
    loadingCard: {
      paddingVertical: spacing.xl,
      alignItems: 'center',
    },
    emptyCard: {
      paddingVertical: spacing.xl,
    },
    donationsList: {
      gap: spacing.md,
      paddingBottom: spacing.xl,
    },
    donationCard: {
      padding: spacing.lg,
    },
    donationHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    donationType: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    donationTypeText: {
      fontSize: 15,
      fontWeight: '600',
      textTransform: 'capitalize',
    },
    statusBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.sm,
    },
    statusText: {
      fontSize: 10,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    donationDetails: {
      gap: spacing.xs,
      marginBottom: spacing.md,
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    detailText: {
      fontSize: 13,
    },
    donationFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    refLabel: {
      fontSize: 10,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    refText: {
      fontSize: 12,
      fontWeight: '600',
      letterSpacing: 0.5,
    },
    volumeBadge: {
      backgroundColor: colors.primaryMuted,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.sm,
    },
    volumeText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.onMuted.primary,
    },
  });
}