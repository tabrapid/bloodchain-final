import { type ReactNode } from 'react';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAvoidingView, ScrollView } from 'react-native';
import { useDesign } from '../useDesign';
import { layout, space } from '../tokens';
import { Text } from './Text';
import { Button, IconButton } from './Button';
import { Progress } from './Stat';

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
 * The booking wizard is five routes, and before this each of them grew its own
 * header, its own title size and its own pair of stacked buttons -- so a donor
 * moving through it saw five screens that resembled each other rather than one
 * screen changing. This is that chrome, once.
 *
 * Three things it owns that a per-screen header keeps getting wrong:
 *
 *   The exit. Back steps within the flow; close leaves it. A wizard with only
 *   a back button makes abandoning it a five-tap operation.
 *
 *   The progress. A real `progressbar` with its position announced, not a
 *   decorative bar -- "step 3 of 5" is the single most useful thing an
 *   assistive technology can say about a wizard.
 *
 *   The action. One primary button, pinned below the scroll area rather than
 *   inside it, so it is in the same place on every step and never scrolls out
 *   of reach on a long one.
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
      <View style={{ flex: 1, paddingTop: insets.top }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.sm,
            paddingHorizontal: layout.gutter,
          }}
        >
          {onBack && backLabel ? (
            <IconButton
              accessibilityLabel={backLabel}
              onPress={onBack}
              style={{ marginLeft: -space.md }}
              icon={({ size, color }) => (
                <Text style={{ fontSize: size + 4, color, lineHeight: size + 6 }}>‹</Text>
              )}
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
            style={{ marginRight: -space.md }}
            icon={({ size, color }) => (
              <Text style={{ fontSize: size, color, lineHeight: size + 4 }}>✕</Text>
            )}
          />
        </View>

        <View style={{ paddingHorizontal: layout.gutter, paddingTop: space.sm }}>
          <Progress
            label={counterLabel}
            value={step / total}
            bare
          />
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
          <View style={{ gap: space.xs }}>
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
              borderTopWidth: 1,
              borderTopColor: colors.divider,
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
