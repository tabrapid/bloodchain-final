import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Building2, Calendar, FlaskConical } from 'lucide-react-native';
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
  laboratoriesOfferingTestType,
  useBookLaboratoryAppointment,
  useLaboratories,
  useLaboratorySlots,
  useTestTypes,
} from '../../src/hooks/useLaboratory';
import { ApiRequestError } from '../../src/api/client';
import { useTranslation } from '../../src/i18n';
import { LAB_BOOKING_STEP_COUNT } from './test-type';

/**
 * Step 5: what the donor is about to book, then `POST /laboratory-appointments`.
 *
 * The three choices are re-read from their own queries rather than carried
 * through the route as display strings, so what is shown here is the same data
 * the request is built from -- and the test type, the thing this whole flow
 * exists to carry, is named on screen before the donor confirms it.
 */
export default function ReviewLabBooking() {
  const { t, formatDate, formatTime } = useTranslation();
  const { colors } = useDesign();
  const params = useLocalSearchParams<{
    testTypeId: string;
    laboratoryId: string;
    date: string;
    slotId: string;
  }>();

  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const {
    data: testTypes = [],
    isLoading: testTypesLoading,
    isError: testTypesError,
    refetch: refetchTestTypes,
  } = useTestTypes();
  const {
    data: laboratories = [],
    isLoading: labsLoading,
    isError: labsError,
    refetch: refetchLabs,
  } = useLaboratories();
  const {
    data: slots = [],
    isLoading: slotsLoading,
    isError: slotsError,
    refetch: refetchSlots,
  } = useLaboratorySlots(params.laboratoryId, params.testTypeId, params.date);

  const testType = testTypes.find((type) => type.id === params.testTypeId);
  const laboratory = laboratoriesOfferingTestType(laboratories, params.testTypeId).find(
    (org) => org.id === params.laboratoryId,
  );
  const slot = slots.find((candidate) => candidate.id === params.slotId);

  const isLoading = testTypesLoading || labsLoading || slotsLoading;
  const hasLoadError = testTypesError || labsError || slotsError;
  const notFound = !isLoading && !hasLoadError && (!testType || !laboratory || !slot);

  const bookMutation = useBookLaboratoryAppointment();

  const handleConfirm = async () => {
    setError(null);
    try {
      const appointment = await bookMutation.mutateAsync({
        laboratoryId: params.laboratoryId,
        testTypeId: params.testTypeId,
        slotId: params.slotId,
        notes: notes.trim() || undefined,
      });
      router.replace({
        pathname: '/(lab-booking)/confirmation',
        params: { appointmentId: appointment.id },
      });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.error.message : t('labBooking.bookFailed'));
    }
  };

  const chrome = {
    step: 5,
    total: LAB_BOOKING_STEP_COUNT,
    counterLabel: t('booking.stepOf', { current: 5, total: LAB_BOOKING_STEP_COUNT }),
    onBack: () => router.back(),
    backLabel: t('common.a11yGoBack'),
    onClose: () => router.replace('/(app)/laboratory'),
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

  if (hasLoadError || notFound || !testType || !laboratory || !slot) {
    return (
      <FlowStep {...chrome} title={t('booking.review')}>
        <ErrorState
          title={hasLoadError ? t('booking.detailsFailed') : t('booking.slotTaken')}
          description={hasLoadError ? t('common.offline') : t('booking.slotTakenHint')}
          {...(hasLoadError
            ? {
                retryLabel: t('common.retry'),
                onRetry: () => {
                  void refetchTestTypes();
                  void refetchLabs();
                  void refetchSlots();
                },
              }
            : {})}
        />
        <Button label={t('common.back')} variant="secondary" onPress={() => router.back()} />
      </FlowStep>
    );
  }

  return (
    <FlowStep
      {...chrome}
      title={t('booking.review')}
      subtitle={t('booking.confirmDetails')}
      primaryLabel={t('labBooking.confirmBooking')}
      primaryDisabled={bookMutation.isPending}
      primaryLoading={bookMutation.isPending}
      onPrimary={() => void handleConfirm()}
      footer={
        <Text variant="caption" tone="tertiary">
          {t('labBooking.fastingHint')}
        </Text>
      }
    >
      <ListGroup
        rows={[
          <ListRow
            key="test"
            leading={<FlaskConical size={iconSize.lg} color={colors.clinical.base} />}
            title={t('labBooking.testType')}
            subtitle={t('units.parametersTested', { count: testType.parameters.length })}
            value={testType.name}
          />,
          <ListRow
            key="where"
            leading={<Building2 size={iconSize.lg} color={colors.rose.base} />}
            title={t('table.location')}
            subtitle={laboratory.address ?? undefined}
            value={laboratory.name}
          />,
          <ListRow
            key="when"
            leading={<Calendar size={iconSize.lg} color={colors.success.base} />}
            title={t('booking.dateAndTime')}
            subtitle={t('booking.endsAround', { time: formatTime(slot.endAt) })}
            value={`${formatDate(slot.startAt, 'medium')} · ${formatTime(slot.startAt)}`}
          />,
        ]}
      />

      <Field
        label={t('booking.notesOptional')}
        placeholder={t('booking.notesHint')}
        value={notes}
        onChangeText={setNotes}
        multiline
      />

      {error ? <Banner tone="critical" title={error} /> : null}
    </FlowStep>
  );
}
