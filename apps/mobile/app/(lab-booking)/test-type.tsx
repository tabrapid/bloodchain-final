import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { FlaskConical } from 'lucide-react-native';
import {
  Choice,
  EmptyState,
  ErrorState,
  FlowStep,
  Skeleton,
  Stack,
  useDesign,
} from '../../src/design';
import { useTestTypes } from '../../src/hooks/useLaboratory';
import { useTranslation } from '../../src/i18n';

/** The laboratory wizard's five steps; the confirmation screen is outside it. */
export const LAB_BOOKING_STEP_COUNT = 5;

/**
 * Step 1: which panel.
 *
 * This is the step the generic donation wizard does not have, and its absence
 * is the whole defect: a blood test booked without a test type reaches the
 * laboratory as "some blood test", and staff phone the donor to ask which one.
 * The list is `GET /test-types`, so it is the panels the laboratories in this
 * deployment actually run.
 */
export default function SelectTestType() {
  const { t } = useTranslation();
  const { colors } = useDesign();
  const [selected, setSelected] = useState<string | null>(null);

  const { data: testTypes = [], isPending, isError, refetch } = useTestTypes();
  const active = useMemo(() => testTypes.filter((type) => type.isActive), [testTypes]);

  return (
    <FlowStep
      step={1}
      total={LAB_BOOKING_STEP_COUNT}
      counterLabel={t('booking.stepOf', { current: 1, total: LAB_BOOKING_STEP_COUNT })}
      title={t('labBooking.selectTestTitle')}
      subtitle={t('labBooking.selectTestSubtitle')}
      onClose={() => router.replace('/(app)/laboratory')}
      closeLabel={t('common.a11yCloseBooking')}
      primaryLabel={t('common.continue')}
      primaryDisabled={!selected}
      onPrimary={() =>
        router.push({
          pathname: '/(lab-booking)/laboratory',
          params: { testTypeId: selected! },
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
          title={t('labBooking.testsFailed')}
          description={t('common.offline')}
          retryLabel={t('common.retry')}
          onRetry={() => void refetch()}
        />
      ) : active.length === 0 ? (
        <EmptyState title={t('labBooking.noTests')} description={t('labBooking.noTestsHint')} />
      ) : (
        <Stack gap="md">
          {active.map((testType) => (
            <Choice
              key={testType.id}
              label={testType.name}
              description={
                testType.description?.trim() ||
                t('units.parametersTested', { count: testType.parameters.length })
              }
              selected={selected === testType.id}
              onPress={() => setSelected(testType.id)}
              icon={({ size }) => <FlaskConical size={size} color={colors.clinical.base} />}
            />
          ))}
        </Stack>
      )}
    </FlowStep>
  );
}
