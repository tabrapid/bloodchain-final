import { useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { Building2, Calendar, Droplet } from 'lucide-react-native';
import {
  Banner,
  Button,
  ErrorState,
  Field,
  FlowStep,
  ListGroup,
  ListRow,
  Skeleton,
  Stack,
  Text,
  iconSize,
  useDesign,
} from '../../src/design';
import {
  useAvailability,
  useBookAppointment,
  useRescheduleAppointment,
} from '../../src/hooks/useAppointments';
import { ApiRequestError } from '../../src/api/client';
import { useOrganization } from '../../src/hooks/useOrganizations';
import { useTranslation } from '../../src/i18n';
import { BOOKING_STEP_COUNT } from './select-type';

export default function ReviewBooking() {
  const { t, formatDate, formatTime } = useTranslation();
  const { colors } = useDesign();
  const params = useLocalSearchParams<{
    slotId: string;
    organizationId: string;
    type: string;
    date: string;
    rescheduleAppointmentId?: string;
  }>();
  const isRescheduling = Boolean(params.rescheduleAppointmentId);

  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const {
    data: slots,
    isLoading: slotsLoading,
    isError: slotsError,
    refetch: refetchSlots,
  } = useAvailability({ date: params.date });
  const slot = slots?.find((s) => s.id === params.slotId);

  const {
    data: organization,
    isLoading: orgsLoading,
    isError: orgsError,
    refetch: refetchOrgs,
  } = useOrganization(params.organizationId);

  const isLoading = slotsLoading || orgsLoading;
  const hasLoadError = slotsError || orgsError;
  const notFound = !isLoading && !hasLoadError && (!slot || !organization);

  const bookMutation = useBookAppointment();
  const rescheduleMutation = useRescheduleAppointment();
  const isSaving = isRescheduling ? rescheduleMutation.isPending : bookMutation.isPending;

  const handleConfirm = async () => {
    setError(null);
    try {
      const result = params.rescheduleAppointmentId
        ? await rescheduleMutation.mutateAsync({
            id: params.rescheduleAppointmentId,
            input: { newSlotId: params.slotId },
          })
        : await bookMutation.mutateAsync({
            slotId: params.slotId,
            appointmentType: params.type,
            notes: notes.trim() || undefined,
          });
      router.replace({
        pathname: '/(booking)/confirmation',
        params: {
          appointmentId: result.id,
          ...(isRescheduling && { rescheduled: '1' }),
        },
      });
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.error.message
          : isRescheduling
            ? t('booking.rescheduleFailed')
            : t('booking.bookFailed'),
      );
    }
  };

  const chrome = {
    step: 5,
    total: BOOKING_STEP_COUNT,
    counterLabel: t('booking.stepOf', { current: 5, total: BOOKING_STEP_COUNT }),
    onBack: () => router.back(),
    backLabel: t('common.a11yGoBack'),
    onClose: () => router.replace('/(app)/donate'),
    closeLabel: t('common.a11yCloseBooking'),
  } as const;

  if (isLoading) {
    return (
      <FlowStep {...chrome} title={t('booking.review')} subtitle={t('booking.loadingDetails')}>
        <Stack gap="md">
          <Skeleton height={56} />
          <Skeleton height={56} />
          <Skeleton height={56} />
        </Stack>
      </FlowStep>
    );
  }

  // A slot that has gone while the donor was deciding is not an error to
  // retry: it is a different slot they now have to pick. The two are told
  // apart here because the way out of them is different.
  if (hasLoadError || notFound || !slot || !organization) {
    return (
      <FlowStep {...chrome} title={t('booking.review')}>
        <ErrorState
          title={hasLoadError ? t('booking.detailsFailed') : t('booking.slotTaken')}
          description={hasLoadError ? t('common.offline') : t('booking.slotTakenHint')}
          {...(hasLoadError
            ? {
                retryLabel: t('common.retry'),
                onRetry: () => {
                  void refetchSlots();
                  void refetchOrgs();
                },
              }
            : {})}
        />
        <Button label={t('common.back')} variant="secondary" onPress={() => router.back()} />
      </FlowStep>
    );
  }

  const start = new Date(slot.startAt);

  return (
    <FlowStep
      {...chrome}
      title={isRescheduling ? t('booking.reviewReschedule') : t('booking.review')}
      subtitle={t('booking.confirmDetails')}
      primaryLabel={isRescheduling ? t('booking.confirmReschedule') : t('booking.confirmAppointment')}
      primaryDisabled={isSaving}
      primaryLoading={isSaving}
      onPrimary={() => void handleConfirm()}
      footer={
        <Text variant="caption" tone="tertiary">
          {t('booking.terms')}
        </Text>
      }
    >
      <ListGroup
        rows={[
          <ListRow
            key="type"
            leading={<Droplet size={iconSize.lg} color={colors.rose.base} />}
            title={t('booking.donationType')}
            value={t(`appointmentTypes.${params.type}`)}
          />,
          <ListRow
            key="where"
            leading={<Building2 size={iconSize.lg} color={colors.clinical.base} />}
            title={t('table.location')}
            subtitle={organization.address ?? undefined}
            value={organization.name}
          />,
          <ListRow
            key="when"
            leading={<Calendar size={iconSize.lg} color={colors.success.base} />}
            title={t('booking.dateAndTime')}
            subtitle={t('booking.endsAround', { time: formatTime(slot.endAt) })}
            value={`${formatDate(start, 'medium')} · ${formatTime(slot.startAt)}`}
          />,
        ]}
      />

      {!isRescheduling ? (
        <Field
          label={t('booking.notesOptional')}
          placeholder={t('booking.notesHint')}
          value={notes}
          onChangeText={setNotes}
          multiline
        />
      ) : null}

      {error ? <Banner tone="critical" title={error} /> : null}
    </FlowStep>
  );
}
