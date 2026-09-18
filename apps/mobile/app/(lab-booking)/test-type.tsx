import { useMemo, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Check, FlaskConical } from 'lucide-react-native';
import {
  AppButton,
  AppText,
  BookingStep,
  EmptyState,
  GlassCard,
} from '../../src/components';
import { useTestTypes } from '../../src/hooks/useLaboratory';
import { radius, spacing, useTheme, ThemeColors } from '../../src/theme';
import { useTranslation } from '../../src/i18n';

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
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [selected, setSelected] = useState<string | null>(null);

  const { data: testTypes = [], isLoading, isError, refetch, isRefetching } = useTestTypes();
  const active = useMemo(() => testTypes.filter((type) => type.isActive), [testTypes]);

  return (
    <BookingStep
      step={1}
      title={t('labBooking.selectTestTitle')}
      subtitle={t('labBooking.selectTestSubtitle')}
      nextDisabled={!selected}
      onClose={() => router.replace('/(app)/laboratory')}
      onNext={() =>
        router.push({
          pathname: '/(lab-booking)/laboratory',
          params: { testTypeId: selected! },
        })
      }
    >
      {isLoading ? (
        <AppText style={styles.status}>{t('labBooking.loadingTests')}</AppText>
      ) : isError ? (
        <GlassCard style={styles.stateCard}>
          <EmptyState
            title={t('labBooking.testsFailed')}
            description={t('common.offline')}
          />
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
      ) : active.length === 0 ? (
        <GlassCard style={styles.stateCard}>
          <EmptyState
            title={t('labBooking.noTests')}
            description={t('labBooking.noTestsHint')}
          />
        </GlassCard>
      ) : (
        <View style={styles.list}>
          {active.map((testType) => {
            const isSelected = selected === testType.id;
            return (
              <Pressable
                key={testType.id}
                onPress={() => setSelected(testType.id)}
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
                      <FlaskConical size={22} color={colors.onMuted.secondary} />
                    </View>
                    <View style={styles.body}>
                      <AppText style={styles.title}>{testType.name}</AppText>
                      <AppText style={styles.description}>
                        {testType.description?.trim() ||
                          t('units.parametersTested', { count: testType.parameters.length })}
                      </AppText>
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
      backgroundColor: colors.secondaryMuted,
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
