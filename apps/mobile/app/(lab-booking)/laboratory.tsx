import { useMemo, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Building2, Check, MapPin } from 'lucide-react-native';
import {
  AppButton,
  AppText,
  BookingStep,
  EmptyState,
  GlassCard,
} from '../../src/components';
import {
  laboratoriesOfferingTestType,
  useLaboratories,
  useTestTypes,
} from '../../src/hooks/useLaboratory';
import { radius, spacing, useTheme, ThemeColors } from '../../src/theme';
import { useTranslation } from '../../src/i18n';

/**
 * Step 2: which laboratory, out of the ones that run the chosen panel.
 *
 * `GET /laboratories` returns each site's laboratory profile with the test
 * types it offers, so this is filtered on the server's own data rather than
 * showing every blood centre and letting the booking fail at the slot step.
 */
export default function SelectLaboratory() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams<{ testTypeId: string }>();
  const [selected, setSelected] = useState<string | null>(null);

  const { data: laboratories = [], isLoading, isError, refetch, isRefetching } = useLaboratories();
  const { data: testTypes = [] } = useTestTypes();
  const testType = testTypes.find((type) => type.id === params.testTypeId);

  const offering = useMemo(
    () => laboratoriesOfferingTestType(laboratories, params.testTypeId),
    [laboratories, params.testTypeId],
  );

  return (
    <BookingStep
      step={2}
      title={t('labBooking.selectLabTitle')}
      subtitle={
        testType
          ? t('labBooking.selectLabSubtitleFor', { test: testType.name })
          : t('labBooking.selectLabSubtitle')
      }
      nextDisabled={!selected}
      onClose={() => router.replace('/(app)/laboratory')}
      onNext={() =>
        router.push({
          pathname: '/(lab-booking)/date',
          params: { testTypeId: params.testTypeId, laboratoryId: selected! },
        })
      }
    >
      {isLoading ? (
        <AppText style={styles.status}>{t('labBooking.loadingLabs')}</AppText>
      ) : isError ? (
        <GlassCard style={styles.stateCard}>
          <EmptyState title={t('labBooking.labsFailed')} description={t('common.offline')} />
          <AppButton
            variant="secondary"
            onPress={() => refetch()}
            disabled={isRefetching}
            loading={isRefetching}
            style={styles.retry}
          >
            {t('common.retry')}
          </AppButton>
        </GlassCard>
      ) : offering.length === 0 ? (
        <GlassCard style={styles.stateCard}>
          <EmptyState title={t('labBooking.noLabs')} description={t('labBooking.noLabsHint')} />
        </GlassCard>
      ) : (
        <View style={styles.list}>
          {offering.map((laboratory) => {
            const isSelected = selected === laboratory.id;
            return (
              <Pressable
                key={laboratory.id}
                onPress={() => setSelected(laboratory.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                style={({ pressed }) => ({ opacity: pressed && !isSelected ? 0.7 : 1 })}
              >
                <GlassCard
                  tier={isSelected ? 'elevated' : 'standard'}
                  style={isSelected ? styles.cardSelected : undefined}
                >
                  <View style={styles.row}>
                    <View style={styles.icon}>
                      <Building2 size={22} color={colors.onMuted.primary} />
                    </View>
                    <View style={styles.body}>
                      <AppText style={styles.title}>{laboratory.name}</AppText>
                      {laboratory.address ? (
                        <View style={styles.metaRow}>
                          <MapPin size={12} color={colors.textMuted} />
                          <AppText style={styles.description}>{laboratory.address}</AppText>
                        </View>
                      ) : null}
                    </View>
                    {isSelected ? (
                      <View style={styles.check}>
                        <Check size={13} color={colors.white} strokeWidth={3} />
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
      )}
    </BookingStep>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    status: {
      fontSize: 13,
      color: colors.textMuted,
    },
    stateCard: {
      paddingVertical: spacing.lg,
    },
    retry: {
      marginTop: spacing.md,
      alignSelf: 'center',
    },
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
      backgroundColor: colors.primaryMuted,
    },
    body: {
      flex: 1,
    },
    title: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 2,
    },
    description: {
      flex: 1,
      fontSize: 12,
      color: colors.textMuted,
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
