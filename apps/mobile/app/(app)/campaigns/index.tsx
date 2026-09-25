import { useState } from 'react';
import { FlatList } from 'react-native';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, Droplet, MapPin, Users } from 'lucide-react-native';
import { getCampaigns, joinCampaign, type Campaign } from '../../../src/api/campaigns';
import {
  Badge,
  Banner,
  Button,
  EmptyState,
  ErrorState,
  Row,
  Screen,
  ScreenHeader,
  SkeletonRow,
  Stack,
  Surface,
  Text,
  iconSize,
  layout,
  space,
  useDesign,
} from '../../../src/design';
import { useTranslation } from '../../../src/i18n';

/** Inside this many days, the deadline is worth saying out loud. */
const CLOSING_SOON_DAYS = 7;

export default function CampaignsScreen() {
  const { t } = useTranslation();
  const [joinError, setJoinError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isPending, isError, refetch, isRefetching } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => getCampaigns({ page: 1, limit: 50, status: 'ACTIVE' }),
  });

  const joinMutation = useMutation({
    mutationFn: joinCampaign,
    onSuccess: () => {
      setJoinError(null);
      void queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      void queryClient.invalidateQueries({ queryKey: ['my-campaigns'] });
    },
    onError: (err: Error) => {
      setJoinError(err.message || t('campaigns.joinFailed'));
    },
  });

  const header = (
    <ScreenHeader
      title={t('campaigns.title')}
      eyebrow={t('campaigns.subtitle')}
      onBack={() => router.back()}
      backLabel={t('common.a11yGoBack')}
    />
  );

  if (isPending) {
    return (
      <Screen>
        {header}
        <Surface>
          <SkeletonRow />
          <SkeletonRow />
        </Surface>
      </Screen>
    );
  }

  // A network failure used to render as an empty list, which reads as
  // "there are none" -- a different and wrong answer.
  if (isError) {
    return (
      <Screen>
        {header}
        <ErrorState
          title={t('common.errorTitle')}
          description={t('common.errorBody')}
          retryLabel={t('common.retry')}
          onRetry={() => void refetch()}
        />
      </Screen>
    );
  }

  const campaigns = data?.items ?? [];

  return (
    <Screen gutter={false}>
      {header}
      <FlatList
        style={{ flex: 1 }}
        data={campaigns}
        keyExtractor={(campaign) => campaign.id}
        contentContainerStyle={{
          paddingHorizontal: layout.gutter,
          paddingBottom: layout.tabBarClearance,
          gap: space.md,
        }}
        showsVerticalScrollIndicator={false}
        refreshing={isRefetching}
        onRefresh={() => void refetch()}
        renderItem={({ item: campaign }) => (
          <CampaignCard
            campaign={campaign}
            onJoin={() => joinMutation.mutate(campaign.id)}
            isJoining={joinMutation.isPending}
          />
        )}
        ListHeaderComponent={
          joinError ? <Banner tone="critical" title={joinError} style={{ marginBottom: space.md }} /> : null
        }
        ListEmptyComponent={
          <EmptyState
            title={t('campaigns.empty')}
            description={t('campaigns.emptyHint')}
            icon={({ size, color }) => <Calendar size={size} color={color} />}
          />
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
  const { t, formatDate } = useTranslation();
  const { colors } = useDesign();

  const endDate = new Date(campaign.endDate);
  const daysLeft = Math.ceil((endDate.getTime() - Date.now()) / 86_400_000);

  return (
    <Surface>
      <Stack gap="md">
        <Row gap="md" align="flex-start">
          <Stack gap="xs" style={{ flex: 1 }}>
            <Text variant="h3">{campaign.title}</Text>
            {campaign.organization ? (
              <Text variant="caption" tone="tertiary">
                {campaign.organization.name}
              </Text>
            ) : null}
          </Stack>
          {daysLeft > 0 && daysLeft <= CLOSING_SOON_DAYS ? (
            <Badge label={t('units.daysLeft', { count: daysLeft })} tone="warning" />
          ) : null}
        </Row>

        <Text variant="body" tone="secondary" numberOfLines={3}>
          {campaign.description}
        </Text>

        <Stack gap="sm">
          {/* `toLocaleDateString()` with no locale reads the device's, not the
              app's: a donor with an English phone saw English dates inside an
              Uzbek screen. */}
          <Row gap="sm">
            <Calendar size={iconSize.sm} color={colors.textTertiary} />
            <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
              {`${formatDate(campaign.startDate, 'medium')} – ${formatDate(campaign.endDate, 'medium')}`}
            </Text>
          </Row>

          {campaign.location ? (
            <Row gap="sm">
              <MapPin size={iconSize.sm} color={colors.textTertiary} />
              <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
                {campaign.location}
              </Text>
            </Row>
          ) : null}

          {campaign.bloodGroupsNeeded && campaign.bloodGroupsNeeded.length > 0 ? (
            <Row gap="sm">
              <Droplet size={iconSize.sm} color={colors.rose.base} />
              <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
                {t('campaigns.bloodTypesNeeded', { types: campaign.bloodGroupsNeeded.join(', ') })}
              </Text>
            </Row>
          ) : null}

          {campaign.participantCount !== undefined ? (
            <Row gap="sm">
              <Users size={iconSize.sm} color={colors.textTertiary} />
              <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
                {`${t('units.participants', { count: campaign.participantCount })}${
                  campaign.targetParticipants
                    ? t('campaigns.targetSuffix', { count: campaign.targetParticipants })
                    : ''
                }`}
              </Text>
            </Row>
          ) : null}
        </Stack>

        <Button label={t('campaigns.joinCampaign')} loading={isJoining} onPress={onJoin} />
      </Stack>
    </Surface>
  );
}
