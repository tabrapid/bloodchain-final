import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, Users, MapPin, Droplet } from 'lucide-react-native';
import { getCampaigns, joinCampaign, type Campaign } from '../../../src/api/campaigns';
import {
  AppButton,
  AppText,
  Badge,
  Card,
  EmptyState,
  GlassCard,
  LoadingState,
  Screen,
  ScreenHeader,
} from '../../../src/components';
import { spacing, useTheme, ThemeColors } from '../../../src/theme';

export default function CampaignsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [refreshing, setRefreshing] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => getCampaigns({ page: 1, limit: 50, status: 'ACTIVE' }),
  });

  const joinMutation = useMutation({
    mutationFn: joinCampaign,
    onSuccess: () => {
      setJoinError(null);
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['my-campaigns'] });
    },
    onError: (err: any) => {
      setJoinError(err.message || 'Failed to join campaign. Please try again.');
    },
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  if (isLoading) {
    return (
      <Screen>
        <ScreenHeader title="Blood Donation Campaigns" />
        <LoadingState message="Loading campaigns..." />
      </Screen>
    );
  }

  const campaigns = data?.items ?? [];

  return (
    <Screen scroll={false}>
      <ScreenHeader
        title="Blood Donation Campaigns"
        subtitle="Join campaigns to help save lives in your community"
      />
      <FlatList
        style={{ flex: 1 }}
        data={campaigns}
        keyExtractor={(campaign) => campaign.id}
        contentContainerStyle={styles.list}
        renderItem={({ item: campaign }) => (
          <CampaignCard
            campaign={campaign}
            onJoin={() => joinMutation.mutate(campaign.id)}
            isJoining={joinMutation.isPending}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          joinError ? (
            <Card style={styles.errorCard}>
              <AppText style={{ color: colors.onMuted.danger }}>{joinError}</AppText>
            </Card>
          ) : null
        }
        ListEmptyComponent={
          <Card>
            <EmptyState
              icon={Calendar}
              title="No Active Campaigns"
              description="Check back later for new blood donation campaigns"
            />
          </Card>
        }
      />
    </Screen>
  );
}

function CampaignCard({
  campaign,
  onJoin,
  isJoining,
}: {
  campaign: Campaign;
  onJoin: () => void;
  isJoining: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const startDate = new Date(campaign.startDate);
  const endDate = new Date(campaign.endDate);
  const now = new Date();
  const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  return (
    <GlassCard>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeading}>
          <AppText variant="heading">{campaign.title}</AppText>
          {campaign.organization && (
            <AppText muted variant="bodySmall" style={styles.organization}>
              {campaign.organization.name}
            </AppText>
          )}
        </View>
        {daysLeft > 0 && daysLeft <= 7 && (
          <Badge variant="danger">{`${daysLeft} days left`}</Badge>
        )}
      </View>

      <AppText variant="bodySmall" style={styles.description} numberOfLines={3}>
        {campaign.description}
      </AppText>

      <View style={styles.details}>
        <View style={styles.detailRow}>
          <Calendar size={16} color={colors.textMuted} />
          <AppText muted variant="bodySmall">
            {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}
          </AppText>
        </View>

        {campaign.location && (
          <View style={styles.detailRow}>
            <MapPin size={16} color={colors.textMuted} />
            <AppText muted variant="bodySmall">
              {campaign.location}
            </AppText>
          </View>
        )}

        {campaign.bloodGroupsNeeded && campaign.bloodGroupsNeeded.length > 0 && (
          <View style={styles.detailRow}>
            <Droplet size={16} color={colors.textMuted} />
            <AppText muted variant="bodySmall">
              Blood types needed: {campaign.bloodGroupsNeeded.join(', ')}
            </AppText>
          </View>
        )}

        {campaign.participantCount !== undefined && (
          <View style={styles.detailRow}>
            <Users size={16} color={colors.textMuted} />
            <AppText muted variant="bodySmall">
              {campaign.participantCount} participants
              {campaign.targetParticipants && ` / ${campaign.targetParticipants} target`}
            </AppText>
          </View>
        )}
      </View>

      <AppButton onPress={onJoin} loading={isJoining}>
        Join Campaign
      </AppButton>
    </GlassCard>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    errorCard: {
      padding: spacing.md,
      marginBottom: 12,
      backgroundColor: colors.dangerMuted,
    },
    list: {
      gap: spacing.md,
      paddingBottom: spacing.xl,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    cardHeading: {
      flex: 1,
    },
    organization: {
      marginTop: spacing.xs,
    },
    description: {
      marginBottom: spacing.md,
    },
    details: {
      gap: spacing.xs,
      marginBottom: spacing.md,
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
  });
}
