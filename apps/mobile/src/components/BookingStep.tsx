import { useMemo, type PropsWithChildren, type ReactNode } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft, X } from 'lucide-react-native';
import { AppButton } from './AppButton';
import { AppText } from './AppText';
import { Screen } from './Screen';
import { radius, spacing, useTheme, type ThemeColors } from '../theme';
import { useTranslation } from '../i18n';

/** The wizard's five decision steps; the confirmation screen is outside it. */
export const BOOKING_STEP_COUNT = 5;

export interface BookingStepProps {
  /** 1-based position among the five steps, used for the counter and bar. */
  step: number;
  title: string;
  subtitle?: string;
  /** Primary action label; omit `onNext` to render the step without a CTA. */
  nextLabel?: string;
  onNext?: () => void;
  nextDisabled?: boolean;
  nextLoading?: boolean;
  footer?: ReactNode;
}

/**
 * The reference draws the booking flow as one wizard with fixed chrome:
 * a Back link, a step counter, a close button that leaves the flow entirely,
 * and a progress bar -- then the step's own title and a single full-width
 * CTA pinned to the bottom.
 *
 * The real app splits those steps across five routes, and each had grown its
 * own header, its own title size, and its own pair of stacked Continue/Back
 * buttons. This is that chrome once, so a donor moving through the flow sees
 * one screen changing rather than five screens that resemble each other.
 */
export function BookingStep({
  step,
  title,
  subtitle,
  nextLabel = 'Continue',
  onNext,
  nextDisabled,
  nextLoading,
  footer,
  children,
}: PropsWithChildren<BookingStepProps>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const progress = (step / BOOKING_STEP_COUNT) * 100;

  return (
    <Screen scroll={false}>
      <View style={styles.chrome}>
        {step > 1 ? (
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t('common.a11yGoBack')}
            style={({ pressed }) => [styles.backLink, { opacity: pressed ? 0.6 : 1 }]}
          >
            <ChevronLeft size={18} color={colors.textMuted} />
            <AppText style={styles.backLabel}>{t('common.back')}</AppText>
          </Pressable>
        ) : (
          <View style={styles.chromeSpacer} />
        )}

        <AppText style={styles.counter}>
          {step} OF {BOOKING_STEP_COUNT}
        </AppText>

        <Pressable
          onPress={() => router.replace('/(app)/donate')}
          accessibilityRole="button"
          accessibilityLabel={t('common.a11yCloseBooking')}
          hitSlop={8}
          style={({ pressed }) => [styles.close, { opacity: pressed ? 0.6 : 1 }]}
        >
          <X size={20} color={colors.textMuted} />
        </Pressable>
      </View>

      <View
        style={styles.track}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: BOOKING_STEP_COUNT, now: step }}
      >
        <View style={[styles.fill, { width: `${progress}%` }]} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <AppText style={styles.title}>{title}</AppText>
        {subtitle && <AppText style={styles.subtitle}>{subtitle}</AppText>}
        {children}
      </ScrollView>

      {(onNext || footer) && (
        <View style={styles.footer}>
          {footer}
          {onNext && (
            <AppButton onPress={onNext} disabled={nextDisabled} loading={nextLoading}>
              {nextLabel}
            </AppButton>
          )}
        </View>
      )}
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    chrome: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 44,
    },
    chromeSpacer: {
      width: 60,
    },
    backLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      minHeight: 44,
      minWidth: 60,
      paddingRight: spacing.sm,
    },
    backLabel: {
      fontSize: 14,
      color: colors.textMuted,
    },
    counter: {
      fontSize: 13,
      fontWeight: '600',
      letterSpacing: 0.65,
      color: colors.textMuted,
    },
    close: {
      width: 60,
      minHeight: 44,
      alignItems: 'flex-end',
      justifyContent: 'center',
    },
    track: {
      height: 3,
      borderRadius: radius.pill,
      backgroundColor: colors.glass.standard.fill,
      overflow: 'hidden',
      marginTop: spacing.sm,
      marginBottom: spacing.lg,
    },
    fill: {
      height: '100%',
      borderRadius: radius.pill,
      backgroundColor: colors.primary,
    },
    content: {
      paddingBottom: spacing.lg,
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      letterSpacing: -0.44,
      color: colors.text,
      marginBottom: 6,
    },
    subtitle: {
      fontSize: 13,
      color: colors.textMuted,
      marginBottom: 20,
    },
    footer: {
      paddingTop: spacing.md,
      paddingBottom: spacing.md,
      gap: spacing.sm,
    },
  });
}
