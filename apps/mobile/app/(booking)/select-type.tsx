import { useMemo, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Check, Droplet, HeartPulse, Stethoscope, type LucideIcon } from 'lucide-react-native';
import { AppText, BookingStep, GlassCard } from '../../src/components';
import { radius, useTheme, ThemeColors } from '../../src/theme';
import { useTranslation } from '../../src/i18n';

interface AppointmentTypeOption {
  id: string;
  icon: LucideIcon;
  tintKey: 'primary' | 'success' | 'secondary';
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
  { id: 'BLOOD_DONATION', icon: Droplet, tintKey: 'primary' },
  { id: 'BLOOD_TEST', icon: HeartPulse, tintKey: 'success' },
  { id: 'CONSULTATION', icon: Stethoscope, tintKey: 'secondary' },
];

export default function SelectType() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <BookingStep
      step={1}
      title={t('booking.selectType')}
      subtitle={t('booking.whatToBook')}
      nextDisabled={!selected}
      onNext={() =>
        router.push({ pathname: '/(booking)/organizations', params: { type: selected! } })
      }
    >
      <View style={styles.list}>
        {APPOINTMENT_TYPES.map((type) => {
          const Icon = type.icon;
          const isSelected = selected === type.id;
          return (
            <Pressable
              key={type.id}
              onPress={() => setSelected(type.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              style={({ pressed }) => ({ opacity: pressed && !isSelected ? 0.7 : 1 })}
            >
              <GlassCard
                tier={isSelected ? 'elevated' : 'standard'}
                style={isSelected ? styles.cardSelected : undefined}
              >
                <View style={styles.row}>
                  <View
                    style={[styles.icon, { backgroundColor: colors[`${type.tintKey}Muted`] }]}
                  >
                    <Icon size={22} color={colors.onMuted[type.tintKey]} />
                  </View>
                  <View style={styles.body}>
                    <AppText style={styles.title}>{t(`appointmentTypes.${type.id}`)}</AppText>
                    <AppText style={styles.description}>{t(`appointmentTypes.${type.id}_HINT`)}</AppText>
                  </View>
                  {isSelected ? (
                    <View style={styles.check}>
                      <Check size={13} color="#FFFFFF" strokeWidth={3} />
                    </View>
                  ) : (
                    <View style={styles.radio} />
                  )}
                </View>
              </GlassCard>
            </Pressable>
          );
        })}
      </View>
    </BookingStep>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    list: {
      gap: 10,
    },
    cardSelected: {
      borderColor: 'rgba(216, 83, 96, 0.45)',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    icon: {
      width: 44,
      height: 44,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    body: {
      flex: 1,
    },
    title: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    description: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },
    radio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: colors.border,
      flexShrink: 0,
    },
    check: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
  });
}
