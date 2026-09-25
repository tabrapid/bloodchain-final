import { useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { View } from 'react-native';
import {
  AlertCircle,
  Calendar,
  Clock,
  Droplet,
  FlaskConical,
  Hash,
  MapPin,
  XCircle,
} from 'lucide-react-native';
import {
  Badge,
  Banner,
  Button,
  ConfirmationSheet,
  EmptyState,
  Field,
  ListGroup,
  ListRow,
  Row,
  ScreenHeader,
  ScrollScreen,
  Skeleton,
  Stack,
  Surface,
  Text,
  iconSize,
  useDesign,
  type StatusTone,
  ErrorState,
  FormScreen,
} from '../../../src/design';
import { useAppointment, useCancelAppointment } from '../../../src/hooks/useAppointments';
import { useTranslation } from '../../../src/i18n';

/**
 * What the donor should do before arriving. This is the same advice every
 * blood service publishes and does not vary per appointment, so it is content
 * rather than data -- the backend has no per-appointment preparation field to
 * read it from.
 */
// Catalogue keys, resolved at render: there is no locale at module load.
const PREPARATION = [
  'medical.preparation.hydrate',
  'medical.preparation.eatWell',
  'medical.preparation.noAlcohol',
  'medical.preparation.bringId',
  'medical.preparation.wearComfortable',
];

function statusTone(status: string): StatusTone {
  switch (status) {
    case 'CONFIRMED':
      return 'success';
    case 'PENDING':
      return 'warning';
    case 'CANCELLED':
    case 'NO_SHOW':
      return 'critical';
    case 'COMPLETED':
      return 'clinical';
    default:
      return 'neutral';
  }
}

/**
 * One appointment, and the two things a donor can still do to it.
 *
 * Cancelling used to run through `Alert.alert` with a destructive option, on
 * top of an inline reason field that had already appeared -- two different
 * confirmation surfaces for one action. It is one sheet now, which states what
 * cancelling means before it happens.
 *
 * The duration read `${minutes} min` after the word "approx." in English, on a
 * screen otherwise fully translated.
 */
export default function AppointmentDetail() {
  const { t, formatDate, formatTime } = useTranslation();
  const { colors } = useDesign();
  const params = useLocalSearchParams<{ id: string }>();
  const { data: appointment, isPending, isError, refetch } = useAppointment(params.id);

  const [cancelReason, setCancelReason] = useState('');
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancelMutation = useCancelAppointment();
  const isOpen = !!appointment && ['PENDING', 'CONFIRMED'].includes(appointment.status);

  const header = (
    <ScreenHeader
      title={
        appointment
          ? t(`appointmentTypes.${appointment.appointmentType}`)
          : t('appointment.title')
      }
      onBack={() => router.back()}
      backLabel={t('common.a11yGoBack')}
      actions={
        appointment ? (
          <Badge
            label={t(`status.appointment.${appointment.status}`)}
            tone={statusTone(appointment.status)}
          />
        ) : undefined
      }
    />
  );

  if (isPending) {
    return (
      <ScrollScreen header={header}>
        <Stack gap="lg">
          <Skeleton height={180} />
          <Skeleton height={120} />
        </Stack>
      </ScrollScreen>
    );
  }

  // A request that failed is not an appointment that does not exist. Telling a
  // donor their booked appointment was "not found" because the network dropped
  // is the worst reading of the two, and it offered no way to try again.
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

  if (!appointment) {
    return (
      <ScrollScreen header={header}>
        <EmptyState
          title={t('appointment.notFound')}
          action={{ label: t('common.back'), onPress: () => router.back() }}
        />
      </ScrollScreen>
    );
  }

  const start = new Date(appointment.scheduledStart);
  const end = new Date(appointment.scheduledEnd);
  const durationMin = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));

  const confirmCancel = async () => {
    setError(null);
    try {
      await cancelMutation.mutateAsync({
        id: params.id,
        input: { reason: cancelReason.trim() || undefined },
      });
      setConfirmingCancel(false);
      router.back();
    } catch (err) {
      setConfirmingCancel(false);
      setError(err instanceof Error ? err.message : t('appointment.cancelFailed'));
    }
  };

  return (
    // FormScreen rather than ScrollScreen: the cancellation-reason field is the
    // second-to-last block on this screen and Reschedule and Cancel sit directly
    // under it, so an open keyboard covered both buttons and the field itself.
    <FormScreen header={header}>
      <Stack gap="xl">
        <ListGroup
          rows={[
            <ListRow
              key="date"
              leading={<Calendar size={iconSize.lg} color={colors.success.base} />}
              title={t('table.date')}
              value={formatDate(start, 'medium')}
            />,
            <ListRow
              key="time"
              leading={<Clock size={iconSize.lg} color={colors.clinical.base} />}
              title={t('table.time')}
              subtitle={t('appointment.aboutDuration', {
                duration: t('units.minutes', { count: durationMin }),
              })}
              value={formatTime(start)}
            />,
            <ListRow
              key="where"
              leading={<MapPin size={iconSize.lg} color={colors.rose.base} />}
              title={t('table.location')}
              subtitle={appointment.organization.address ?? undefined}
              value={appointment.organization.name}
            />,
            <ListRow
              key="type"
              leading={<Droplet size={iconSize.lg} color={colors.rose.base} />}
              title={t('table.type')}
              value={t(`appointmentTypes.${appointment.appointmentType}`)}
            />,
            // The panel the donor chose in the laboratory wizard. It is the
            // same row the laboratory's console reads, so what the donor sees
            // here is what staff are expecting.
            ...(appointment.testType
              ? [
                  <ListRow
                    key="panel"
                    leading={<FlaskConical size={iconSize.lg} color={colors.clinical.base} />}
                    title={t('labBooking.testType')}
                    value={appointment.testType.name}
                  />,
                ]
              : []),
            <ListRow
              key="reference"
              leading={<Hash size={iconSize.lg} color={colors.textSecondary} />}
              title={t('booking.referenceNumber')}
              value={appointment.referenceNumber}
            />,
          ]}
        />

        {isOpen ? (
          <Surface>
            <Stack gap="sm">
              <Text variant="bodyStrong">{t('appointment.preparation')}</Text>
              {PREPARATION.map((tip) => (
                <Text key={tip} variant="caption" tone="secondary">
                  {`• ${t(tip)}`}
                </Text>
              ))}
            </Stack>
          </Surface>
        ) : null}

        {appointment.notes ? (
          <Surface>
            <Stack gap="xs">
              <Text variant="overline" tone="tertiary" caps>
                {t('table.notes')}
              </Text>
              <Text variant="body" tone="secondary">
                {appointment.notes}
              </Text>
            </Stack>
          </Surface>
        ) : null}

        {appointment.cancellationReason ? (
          <Banner
            tone="critical"
            title={t('appointment.cancelledNotice')}
            description={appointment.cancellationReason}
            icon={({ size, color }) => <XCircle size={size} color={color} />}
          />
        ) : null}

        {error ? (
          <Banner
            tone="critical"
            title={error}
            icon={({ size, color }) => <AlertCircle size={size} color={color} />}
          />
        ) : null}

        {isOpen ? (
          <Stack gap="md">
            {/* The reason is optional and is typed before confirming, not
                inside the confirmation: a sheet is for deciding, not for
                composing. */}
            <Field
              label={t('appointment.cancelReason')}
              placeholder={t('appointment.cancelReasonHint')}
              value={cancelReason}
              onChangeText={setCancelReason}
              multiline
            />
            <Row gap="md">
              <View style={{ flex: 1 }}>
                <Button
                  label={t('appointment.reschedule')}
                  variant="secondary"
                  // Reschedule keeps the same organization and appointment
                  // type -- only the date and time change -- so this skips
                  // straight to date selection instead of re-running the full
                  // new-booking flow.
                  onPress={() =>
                    router.push({
                      pathname: '/(booking)/date' as const,
                      params: {
                        organizationId: appointment.organization.id,
                        type: appointment.appointmentType,
                        rescheduleAppointmentId: params.id,
                      },
                    })
                  }
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label={t('actions.cancel')}
                  variant="secondary"
                  accent="critical"
                  style={{ borderColor: colors.critical.base }}
                  onPress={() => setConfirmingCancel(true)}
                />
              </View>
            </Row>
          </Stack>
        ) : (
          <Button label={t('common.back')} variant="secondary" onPress={() => router.back()} />
        )}
      </Stack>

      <ConfirmationSheet
        visible={confirmingCancel}
        onCancel={() => setConfirmingCancel(false)}
        onConfirm={() => void confirmCancel()}
        title={t('appointment.cancelTitle')}
        description={t('appointment.cancelConfirmBody')}
        confirmLabel={t('appointment.cancelConfirm')}
        cancelLabel={t('appointment.cancelKeep')}
        busy={cancelMutation.isPending}
        destructive
      />
    </FormScreen>
  );
}
