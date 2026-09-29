import { type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { ChevronLeft, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDesign } from '../useDesign';
import { layout, radius, space } from '../tokens';
import { Text } from './Text';
import { Button, IconButton } from './Button';

/**
 * Progress through a fixed number of steps, as segments.
 *
 * Segments rather than a bar: a bar at 60% is a quantity, five segments with
 * three filled is a position, and a person in a booking flow wants to know
 * where they are, not how much is left as a fraction.
 *
 * Announced as a progressbar with the step as its value.
 */
export function StepIndicator({ step, total, label }: { step: number; total: number; label: string }) {
  const { colors } = useDesign();
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 1, max: total, now: step }}
      style={{ flexDirection: 'row', gap: space.xs + 2 }}
    >
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: 4,
            borderRadius: radius.full,
            backgroundColor: i < step ? colors.rose.base : colors.track,
          }}
        />
      ))}
    </View>
  );
}

export interface FlowStepProps {
  /** 1-based position. */
  step: number;
  total: number;
  title: string;
  subtitle?: string;
  /** Back is absent on the first step; the label is required with it. */
  onBack?: () => void;
  backLabel?: string;
  /** Leaves the flow entirely. Always present: a wizard with no exit is a trap. */
  onClose: () => void;
  closeLabel: string;
  /** The step counter, already worded and numbered by the caller. */
  counterLabel: string;
  primaryLabel?: string;
  onPrimary?: () => void;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  /** Extra controls above the primary action. */
  footer?: ReactNode;
  children: ReactNode;
}

/**
 * One step of a multi-screen flow.
 *
 * The booking wizard is five routes, and this is their shared chrome: back
 * and close in the corners, the step indicator under them, the title, the
 * content, and one primary action pinned below the scroll area so it is in
 * the same place on every step and never scrolls out of reach.
 */
export function FlowStep({
  step,
  total,
  title,
  subtitle,
  onBack,
  backLabel,
  onClose,
  closeLabel,
  counterLabel,
  primaryLabel,
  onPrimary,
  primaryDisabled,
  primaryLoading,
  footer,
  children,
}: FlowStepProps) {
  const { colors } = useDesign();
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View
        style={{
          flex: 1,
          paddingTop: insets.top,
          width: '100%',
          maxWidth: layout.maxContentWidth,
          alignSelf: 'center',
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.sm,
            paddingHorizontal: layout.gutter - space.sm,
            paddingTop: space.xs,
          }}
        >
          {onBack && backLabel ? (
            <IconButton
              accessibilityLabel={backLabel}
              onPress={onBack}
              icon={({ size, color }) => <ChevronLeft size={size + 2} color={color} />}
            />
          ) : (
            <View style={{ width: 44 }} />
          )}

          <Text variant="label" tone="tertiary" style={{ flex: 1, textAlign: 'center' }}>
            {counterLabel}
          </Text>

          <IconButton
            accessibilityLabel={closeLabel}
            onPress={onClose}
            icon={({ size, color }) => <X size={size} color={color} />}
          />
        </View>

        <View style={{ paddingHorizontal: layout.gutter, paddingTop: space.sm }}>
          <StepIndicator step={step} total={total} label={counterLabel} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: layout.gutter,
            paddingTop: space.xl,
            paddingBottom: space.xl,
            gap: space.xl,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ gap: space.sm }}>
            <Text variant="h1" accessibilityRole="header">
              {title}
            </Text>
            {subtitle ? (
              <Text variant="body" tone="secondary">
                {subtitle}
              </Text>
            ) : null}
          </View>

          {children}
        </ScrollView>

        {onPrimary || footer ? (
          <View
            style={{
              paddingHorizontal: layout.gutter,
              paddingTop: space.md,
              paddingBottom: Math.max(insets.bottom, space.lg),
              gap: space.md,
              backgroundColor: colors.background,
            }}
          >
            {footer}
            {onPrimary && primaryLabel ? (
              <Button
                label={primaryLabel}
                onPress={onPrimary}
                disabled={primaryDisabled}
                loading={primaryLoading}
              />
            ) : null}
          </View>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}
