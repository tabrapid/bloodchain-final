import { useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { View } from 'react-native';
import {
  AlertCircle,
  Calendar,
  Check,
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
  Section,
  Skeleton,
  Stack,
  Surface,
  Text,
  radius,
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
              icon={({ size, color }) => <Calendar size={size} color={color} />}
              iconTone="success"
              title={t('table.date')}
              value={formatDate(start, 'medium')}
            />,
            <ListRow
              key="time"
              icon={({ size, color }) => <Clock size={size} color={color} />}
              iconTone="clinical"
              title={t('table.time')}
              subtitle={t('appointment.aboutDuration', {
                duration: t('units.minutes', { count: durationMin }),
              })}
              value={formatTime(start)}
            />,
            <ListRow
              key="where"
              icon={({ size, color }) => <MapPin size={size} color={color} />}
              iconTone="rose"
              title={t('table.location')}
              subtitle={appointment.organization.address ?? undefined}
              value={appointment.organization.name}
            />,
            <ListRow
              key="type"
              icon={({ size, color }) => <Droplet size={size} color={color} />}
              iconTone="rose"
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
                    icon={({ size, color }) => <FlaskConical size={size} color={color} />}
                    iconTone="clinical"
                    title={t('labBooking.testType')}
                    value={appointment.testType.name}
                  />,
                ]
              : []),
            <ListRow
              key="reference"
              icon={({ size, color }) => <Hash size={size} color={color} />}
              title={t('booking.referenceNumber')}
              value={appointment.referenceNumber}
            />,
          ]}
        />

        {isOpen ? (
          <Section title={t('appointment.preparation')}>
            <Surface level="flat">
              <Stack gap="md">
                {PREPARATION.map((tip) => (
                  <Row key={tip} gap="md" align="flex-start">
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: radius.full,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: colors.success.soft,
                        marginTop: 1,
                      }}
                    >
                      <Check size={13} color={colors.success.base} strokeWidth={3} />
                    </View>
                    <Text variant="body" tone="secondary" style={{ flex: 1 }}>
                      {t(tip)}
                    </Text>
                  </Row>
                ))}
              </Stack>
            </Surface>
          </Section>
        ) : null}

        {appointment.notes ? (
          <Section title={t('table.notes')}>
            <Surface level="flat">
              <Text variant="body" tone="secondary">
                {appointment.notes}
              </Text>
            </Surface>
          </Section>
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
