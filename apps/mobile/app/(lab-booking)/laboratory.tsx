import { useMemo, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Building2 } from 'lucide-react-native';
import {
  Choice,
  EmptyState,
  ErrorState,
  FlowStep,
  Skeleton,
  Stack,
  useDesign,
} from '../../src/design';
import {
  laboratoriesOfferingTestType,
  useLaboratories,
  useTestTypes,
} from '../../src/hooks/useLaboratory';
import { useTranslation } from '../../src/i18n';
import { LAB_BOOKING_STEP_COUNT } from './test-type';

/**
 * Step 2: which laboratory, out of the ones that run the chosen panel.
 *
 * `GET /laboratories` returns each site's laboratory profile with the test
 * types it offers, so this is filtered on the server's own data rather than
 * showing every blood centre and letting the booking fail at the slot step.
 */
export default function SelectLaboratory() {
  const { t } = useTranslation();
  const { colors } = useDesign();
  const params = useLocalSearchParams<{ testTypeId: string }>();
  const [selected, setSelected] = useState<string | null>(null);

  const { data: laboratories = [], isPending, isError, refetch } = useLaboratories();
  const { data: testTypes = [] } = useTestTypes();
  const testType = testTypes.find((type) => type.id === params.testTypeId);

  const offering = useMemo(
    () => laboratoriesOfferingTestType(laboratories, params.testTypeId),
    [laboratories, params.testTypeId],
  );

  return (
    <FlowStep
      step={2}
      total={LAB_BOOKING_STEP_COUNT}
      counterLabel={t('booking.stepOf', { current: 2, total: LAB_BOOKING_STEP_COUNT })}
      title={t('labBooking.selectLabTitle')}
      subtitle={
        testType
          ? t('labBooking.selectLabSubtitleFor', { test: testType.name })
          : t('labBooking.selectLabSubtitle')
      }
      onBack={() => router.back()}
      backLabel={t('common.a11yGoBack')}
      onClose={() => router.replace('/(app)/laboratory')}
      closeLabel={t('common.a11yCloseBooking')}
      primaryLabel={t('common.continue')}
      primaryDisabled={!selected}
      onPrimary={() =>
        router.push({
          pathname: '/(lab-booking)/date',
          params: { testTypeId: params.testTypeId, laboratoryId: selected! },
        })
      }
    >
      {isPending ? (
        <Stack gap="md">
          <Skeleton height={72} />
          <Skeleton height={72} />
        </Stack>
      ) : isError ? (
        <ErrorState
          title={t('labBooking.labsFailed')}
          description={t('common.offline')}
          retryLabel={t('common.retry')}
          onRetry={() => void refetch()}
        />
      ) : offering.length === 0 ? (
        <EmptyState title={t('labBooking.noLabs')} description={t('labBooking.noLabsHint')} />
      ) : (
        <Stack gap="md">
          {offering.map((laboratory) => (
            <Choice
              key={laboratory.id}
              label={laboratory.name}
              description={laboratory.address ?? undefined}
              selected={selected === laboratory.id}
              onPress={() => setSelected(laboratory.id)}
              icon={({ size }) => <Building2 size={size} color={colors.rose.base} />}
            />
          ))}
        </Stack>
      )}
    </FlowStep>
  );
}
