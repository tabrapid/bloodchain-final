import { router } from 'expo-router';
import { View } from 'react-native';
import {
  Beaker,
  ChevronRight,
  FlaskConical,
  TestTube2,
  Calendar as CalendarIcon,
} from 'lucide-react-native';
import {
  Badge,
  EmptyState,
  ErrorState,
  ListGroup,
  ListRow,
  ScreenHeader,
  ScrollScreen,
  Section,
  Sections,
  Skeleton,
  Stack,
  Stat,
  StatRow,
  Surface,
  Row,
  Text,
  iconSize,
  radius,
  useDesign,
  type StatusTone,
} from '../../../src/design';
import {
  useDonorLaboratoryAppointments,
  useDonorLaboratoryResults,
} from '../../../src/hooks/useLaboratory';
import { useTranslation } from '../../../src/i18n';

/** Statuses that mean the appointment is behind the donor, not ahead of them. */
const FINISHED = ['COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESULT_PUBLISHED'];

function appointmentTone(status: string): StatusTone {
  switch (status) {
    case 'RESULT_PUBLISHED':
    case 'COMPLETED':
      return 'success';
    case 'CHECKED_IN':
    case 'IN_PROGRESS':
    case 'RESULT_PENDING':
      return 'warning';
    case 'CANCELLED':
    case 'NO_SHOW':
      return 'critical';
    default:
      return 'clinical';
  }
}

/**
 * The laboratory hub, rebuilt for V2.
 *
 * Two lists and a way to book. V1 fetched both with a `Promise.all` in a
 * `useEffect` and set a single `loadError` flag, which it then only showed if
 * *both* lists happened to be empty -- so a donor whose results failed to load
 * but who had one upcoming appointment saw a screen that quietly claimed they
 * had no results at all. The two requests are separate queries now and each
 * says for itself whether it failed.
 */
export default function LaboratoryScreen() {
  const { t, formatDate, formatTime } = useTranslation();
  const { colors } = useDesign();

  const appointments = useDonorLaboratoryAppointments();
  const results = useDonorLaboratoryResults();

  const upcoming = (appointments.data ?? []).filter((a) => !FINISHED.includes(a.status));
  const published = (results.data ?? []).filter((r) => r.status === 'PUBLISHED');

  const isPending = appointments.isPending || results.isPending;
  const bothFailed = appointments.isError && results.isError;

  const header = (
    <ScreenHeader
      title={t('laboratory.title')}
      size="large"
      onBack={() => router.back()}
      backLabel={t('common.a11yGoBack')}
    />
  );

  if (isPending) {
    return (
      <ScrollScreen header={header}>
        <Stack gap="lg">
          <Skeleton height={72} />
          <Skeleton height={64} />
          <Skeleton height={64} />
        </Stack>
      </ScrollScreen>
    );
  }

  if (bothFailed) {
    return (
      <ScrollScreen header={header}>
        <ErrorState
          title={t('laboratory.loadFailed')}
          description={t('laboratory.loadFailedHint')}
          retryLabel={t('common.retry')}
          onRetry={() => {
            void appointments.refetch();
            void results.refetch();
          }}
        />
      </ScrollScreen>
    );
  }

  const nothingYet = upcoming.length === 0 && published.length === 0;

  return (
    <ScrollScreen
      header={header}
      refreshing={appointments.isRefetching || results.isRefetching}
      onRefresh={() => {
        void appointments.refetch();
        void results.refetch();
      }}
    >
      <Sections rhythm="major">
        <StatRow>
          <Stat
            label={t('laboratory.upcoming')}
            value={String(upcoming.length)}
            icon={({ size, color }) => <CalendarIcon size={size} color={color} />}
            tone={upcoming.length > 0 ? 'clinical' : undefined}
          />
          <Stat
            label={t('laboratory.results')}
            value={String(published.length)}
            icon={({ size, color }) => <TestTube2 size={size} color={color} />}
            tone={published.length > 0 ? 'success' : undefined}
          />
        </StatRow>

        <Surface
          tone="clinical"
          onPress={() => router.push('/(lab-booking)/test-type')}
          accessibilityLabel={`${t('laboratory.bookBloodTest')}. ${t('laboratory.bookHint')}`}
        >
          <Row gap="md">
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: radius.sm,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.clinical.soft,
              }}
            >
              <FlaskConical size={iconSize.md + 2} color={colors.clinical.base} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="title">{t('laboratory.bookBloodTest')}</Text>
              <Text variant="caption" tone="secondary">
                {t('laboratory.bookHint')}
              </Text>
            </View>
            <ChevronRight size={iconSize.md} color={colors.textTertiary} />
          </Row>
        </Surface>

        {appointments.isError ? (
          <ErrorState
            title={t('laboratory.loadFailed')}
            description={t('laboratory.loadFailedHint')}
            retryLabel={t('common.retry')}
            onRetry={() => void appointments.refetch()}
          />
        ) : upcoming.length > 0 ? (
          <Section title={t('laboratory.upcomingAppointments')}>
            <ListGroup
              rows={upcoming.slice(0, 3).map((appointment) => (
                <ListRow
                  key={appointment.id}
                  icon={({ size, color }) => <FlaskConical size={size} color={color} />}
                  iconTone="clinical"
                  title={appointment.testType?.name ?? appointment.organization.name}
                  subtitle={`${formatDate(appointment.scheduledStart, 'medium')} · ${formatTime(
                    appointment.scheduledStart,
                  )}${appointment.testType ? ` · ${appointment.organization.name}` : ''}`}
                  subtitleTrailing={
                    <Badge
                      label={t(`status.appointment.${appointment.status}`)}
                      tone={appointmentTone(appointment.status)}
                      dot
                    />
                  }
                  onPress={() => router.push(`/appointment/${appointment.id}`)}
                />
              ))}
            />
          </Section>
        ) : null}

        {results.isError ? (
          <ErrorState
            title={t('laboratory.loadFailed')}
            description={t('laboratory.loadFailedHint')}
            retryLabel={t('common.retry')}
            onRetry={() => void results.refetch()}
          />
        ) : published.length > 0 ? (
          <Section title={t('laboratory.recentResults')}>
            <ListGroup
              rows={published.slice(0, 3).map((result) => (
                <ListRow
                  key={result.id}
                  icon={({ size, color }) => <Beaker size={size} color={color} />}
                  iconTone="success"
                  title={result.testType.name}
                  subtitle={`${t('units.parametersTested', { count: result.items.length })} · ${
                    result.laboratory.name
                  } · ${
                    result.publishedAt
                      ? formatDate(result.publishedAt, 'medium')
                      : t('laboratory.dateUnknown')
                  }`}
                  onPress={() => router.push('/health-trends')}
                />
              ))}
            />
          </Section>
        ) : null}

        {nothingYet && !appointments.isError && !results.isError ? (
          <EmptyState
            title={t('laboratory.empty')}
            description={t('laboratory.emptyHint')}
            icon={({ size, color }) => <FlaskConical size={size} color={color} />}
            action={{
              label: t('laboratory.bookATest'),
              onPress: () => router.push('/(lab-booking)/test-type'),
            }}
          />
        ) : null}
      </Sections>
    </ScrollScreen>
  );
}
