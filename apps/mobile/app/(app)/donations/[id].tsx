import { View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { AlertCircle, Building2, Calendar, Clock, Droplet } from 'lucide-react-native';
import {
  Badge,
  Banner,
  Button,
  EmptyState,
  ErrorState,
  ListGroup,
  ListRow,
  Row,
  ScreenHeader,
  ScrollScreen,
  Skeleton,
  Stack,
  Surface,
  Text,
  ValueText,
  iconSize,
  useDesign,
  type StatusTone,
} from '../../../src/design';
import { useDonation } from '../../../src/hooks/useDonations';
import { useTranslation } from '../../../src/i18n';

function statusTone(status: string): StatusTone {
  switch (status) {
    case 'COMPLETED':
      return 'success';
    case 'CANCELLED':
    case 'ABORTED':
    case 'REJECTED':
      return 'critical';
    case 'IN_PROGRESS':
      return 'warning';
    default:
      return 'neutral';
  }
}

/**
 * One donation, as the record holds it.
 *
 * Three enums used to reach the donor raw: the status in a badge
 * (`COMPLETED`), the type through `replace('_', ' ')` ("WHOLE BLOOD"), and the
 * cancellation reason the same way ("DONOR CANCELLED"). All three have had
 * catalogue entries since their namespaces shipped. `abortedReason` is free
 * text written by staff and is shown as written -- it is the one field here
 * that is not an enum.
 */
export default function DonationDetailScreen() {
  const { t, formatDate, formatTime } = useTranslation();
  const { colors } = useDesign();
  const params = useLocalSearchParams<{ id: string }>();
  const { data: donation, isPending, isError, refetch } = useDonation(params.id);

  const header = (
    <ScreenHeader
      title={t('donationHistory.detailTitle')}
      onBack={() => router.back()}
      backLabel={t('common.a11yGoBack')}
    />
  );

  if (isPending) {
    return (
      <ScrollScreen header={header}>
        <Stack gap="lg">
          <Skeleton height={96} />
          <Skeleton height={180} />
        </Stack>
      </ScrollScreen>
    );
  }

  // "Not found" and "could not reach the server" were the same screen, which
  // told the donor their donation was gone when the network had simply failed.
  if (isError) {
    return (
      <ScrollScreen header={header}>
        <ErrorState
          title={t('common.errorTitle')}
          description={t('common.errorBody')}
          retryLabel={t('common.retry')}
          onRetry={() => void refetch()}
        />
      </ScrollScreen>
    );
  }

  if (!donation) {
    return (
      <ScrollScreen header={header}>
        <EmptyState
          title={t('donationHistory.notFound')}
          action={{ label: t('common.back'), onPress: () => router.back() }}
        />
      </ScrollScreen>
    );
  }

  const bloodType = donation.bloodType
    ? `${donation.bloodType}${donation.rhFactor ? (donation.rhFactor === 'POSITIVE' ? '+' : '-') : ''}`
    : null;

  return (
    <ScrollScreen header={header}>
      <Stack gap="xl">
        <Surface>
          <Stack gap="md">
            <Row gap="md">
              <Droplet size={iconSize.xl} color={colors.rose.base} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="h3">{t(`medical.components.${donation.donationType}`)}</Text>
                <Text variant="caption" tone="tertiary">
                  {donation.donationReference}
                </Text>
              </View>
              <Badge
                label={t(`status.donation.${donation.status}`)}
                tone={statusTone(donation.status)}
              />
            </Row>

            {donation.volumeMl ? (
              <Row gap="xs" align="baseline">
                <ValueText variant="display">{donation.volumeMl}</ValueText>
                <Text variant="h3" tone="secondary">
                  ml
                </Text>
              </Row>
            ) : null}
          </Stack>
        </Surface>

        <ListGroup
          rows={[
            <ListRow
              key="date"
              leading={<Calendar size={iconSize.lg} color={colors.textSecondary} />}
              title={t('table.date')}
              value={formatDate(donation.collectionCompletedAt ?? donation.createdAt, 'medium')}
            />,
            ...(donation.collectionStartedAt
              ? [
                  <ListRow
                    key="time"
                    leading={<Clock size={iconSize.lg} color={colors.textSecondary} />}
                    title={t('table.time')}
                    value={`${formatTime(donation.collectionStartedAt)}${
                      donation.collectionCompletedAt
                        ? ` – ${formatTime(donation.collectionCompletedAt)}`
                        : ''
                    }`}
                  />,
                ]
              : []),
            <ListRow
              key="org"
              leading={<Building2 size={iconSize.lg} color={colors.textSecondary} />}
              title={t('table.organization')}
              subtitle={donation.organization.address ?? undefined}
              value={donation.organization.name}
            />,
            ...(bloodType
              ? [
                  <ListRow
                    key="blood"
                    leading={<Droplet size={iconSize.lg} color={colors.rose.base} />}
                    title={t('medical.bloodGroup')}
                    value={bloodType}
                  />,
                ]
              : []),
          ]}
        />

        {donation.nextDonationDate ? (
          <Surface>
            <Stack gap="xs">
              <Text variant="overline" tone="tertiary" caps>
                {t('donationHistory.nextDonationDate')}
              </Text>
              <Text variant="h3">{formatDate(donation.nextDonationDate, 'medium')}</Text>
            </Stack>
          </Surface>
        ) : null}

        {donation.cancellationReason ? (
          <Banner
            tone="critical"
            title={t(`status.donation.${donation.status}`)}
            description={t(`status.cancellation.${donation.cancellationReason}`)}
            icon={({ size, color }) => <AlertCircle size={size} color={color} />}
          />
        ) : null}

        {/* Staff free text, shown as written. */}
        {donation.abortedReason ? (
          <Banner
            tone="critical"
            title={t('status.donation.ABORTED')}
            description={donation.abortedReason}
            icon={({ size, color }) => <AlertCircle size={size} color={color} />}
          />
        ) : null}

        <Button label={t('common.back')} variant="secondary" onPress={() => router.back()} />
      </Stack>
    </ScrollScreen>
  );
}
