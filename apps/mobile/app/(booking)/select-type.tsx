import { useState } from 'react';
import { router } from 'expo-router';
import { Droplet, HeartPulse, Stethoscope } from 'lucide-react-native';
import { Choice, FlowStep, Stack, useDesign } from '../../src/design';
import { LucideIcon } from '../../src/types/icons';
import { useTranslation } from '../../src/i18n';
import type { AccentName } from '../../src/design';

/** The wizard's five decision steps; the confirmation screen is outside it. */
export const BOOKING_STEP_COUNT = 5;

interface AppointmentTypeOption {
  id: string;
  icon: LucideIcon;
  tone: AccentName;
}

/**
 * The copy comes from the id, not from the map.
 *
 * This list is built at module load, where there is no locale, so it carries
 * only what does not change: which types exist, their icon and their tint. The
 * words are looked up per render under `appointmentTypes.<ID>`, which also
 * means a new appointment type needs one catalogue entry rather than three
 * strings in a file nobody opens.
 */
const APPOINTMENT_TYPES: AppointmentTypeOption[] = [
  { id: 'BLOOD_DONATION', icon: Droplet, tone: 'rose' },
  { id: 'BLOOD_TEST', icon: HeartPulse, tone: 'success' },
  { id: 'CONSULTATION', icon: Stethoscope, tone: 'clinical' },
];

export default function SelectType() {
  const { t } = useTranslation();
  const { colors } = useDesign();
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <FlowStep
      step={1}
      total={BOOKING_STEP_COUNT}
      counterLabel={t('booking.stepOf', { current: 1, total: BOOKING_STEP_COUNT })}
      title={t('booking.selectType')}
      subtitle={t('booking.whatToBook')}
      onClose={() => router.replace('/(app)/donate')}
      closeLabel={t('common.a11yCloseBooking')}
      primaryLabel={t('common.continue')}
      primaryDisabled={!selected}
      onPrimary={() =>
        router.push({ pathname: '/(booking)/organizations', params: { type: selected! } })
      }
    >
      <Stack gap="md">
        {APPOINTMENT_TYPES.map((type) => {
          const Icon = type.icon;
          return (
            <Choice
              key={type.id}
              label={t(`appointmentTypes.${type.id}`)}
              description={t(`appointmentTypes.${type.id}_HINT`)}
              selected={selected === type.id}
              onPress={() => setSelected(type.id)}
              icon={({ size }) => <Icon size={size} color={colors[type.tone].base} />}
            />
          );
        })}
      </Stack>
    </FlowStep>
  );
}
