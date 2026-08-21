import { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { Droplet, Calendar, Building2, ChevronRight } from 'lucide-react-native';
import { AppText, Card, EmptyState, GlassCard, Screen } from '../../../src/components';
import { useMyDonations } from '../../../src/hooks/useDonations';
import { type Donation } from '../../../src/api/donations';
import { colors, spacing, radius } from '../../../src/theme';

export default function DonationsScreen() {
  const [filter, setFilter] = useState<'all' | 'completed' | 'cancelled'>('all');

  const { data, isLoading, refetch, isRefetching } = useMyDonations(
    filter === 'all' ? { past: true } : filter === 'completed' ? { status: 'COMPLETED', past: true } : { status: 'CANCELLED', past: true }
  );

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
        return colors.success;
      case 'CANCELLED':
      case 'ABORTED':
      case 'REJECTED':
        return colors.danger;
      case 'IN_PROGRESS':
        return colors.warning;
      default:
        return colors.textMuted;
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="title">Donation History</AppText>
      </View>

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

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
          />
        }
      >
        {isLoading ? (
          <Card style={styles.loadingCard}>
            <AppText muted>Loading donations...</AppText>
          </Card>
        ) : donations.length === 0 ? (
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
        ) : (
          <View style={styles.donationsList}>
            {donations.map((donation) => (
              <TouchableOpacity
                key={donation.id}
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
                        { backgroundColor: getStatusColor(donation.status) + '20' },
                      ]}
                    >
                      <AppText
                        style={[styles.statusText, { color: getStatusColor(donation.status) }]}
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
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.lg,
  },
  filterTabs: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
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
    backgroundColor: colors.primary + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  volumeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
});