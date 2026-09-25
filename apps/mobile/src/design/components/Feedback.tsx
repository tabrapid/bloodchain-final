import { useEffect, useRef, type ReactNode } from 'react';
import { ActivityIndicator, Animated, Easing, View, type ViewStyle, type DimensionValue } from 'react-native';
import { useDesign } from '../useDesign';
import { icon as iconScale, motion, radius, space } from '../tokens';
import { Text } from './Text';
import { Button } from './Button';

/**
 * The states a screen that talks to a server has to support are not decoration;
 * they are most of what a donor on a slow connection in a hospital corridor
 * actually sees. Each one is a component here so that no screen has to invent
 * it, and so that "loading" looks the same everywhere.
 */

export interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  corner?: keyof typeof radius;
  style?: ViewStyle;
}

/**
 * A placeholder with the shape of the thing that is coming.
 *
 * It pulses opacity rather than sweeping a gradient band across itself. The
 * sweep is prettier and it is also the single most restless thing on a loading
 * screen; with six of them on a page the whole screen shimmers. Opacity at
 * 1100ms reads as "working" and then stops asking for attention.
 */
export function Skeleton({ width = '100%', height = 16, corner = 'xs', style }: SkeletonProps) {
  const { colors } = useDesign();
  const pulse = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width, height, borderRadius: radius[corner], backgroundColor: colors.surfaceRaised, opacity: pulse }, style]}
    />
  );
}

/** A skeleton shaped like a list row, so a loading list has the right height. */
export function SkeletonRow() {
  return (
    <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center', paddingVertical: space.md }}>
      <Skeleton width={40} height={40} corner="sm" />
      <View style={{ flex: 1, gap: space.sm }}>
        <Skeleton height={14} width="55%" />
        <Skeleton height={12} width="35%" />
      </View>
    </View>
  );
}

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: (props: { size: number; color: string }) => ReactNode;
  action?: { label: string; onPress: () => void };
  style?: ViewStyle;
}

/**
 * "There is nothing here" — which is a different fact from "we could not find
 * out". Keeping the two apart is a product requirement in this app, not a
 * nicety: an empty donation history and a failed request used to render the
 * same reassuring card, with no way to retry.
 */
export function EmptyState({ title, description, icon, action, style }: EmptyStateProps) {
  const { colors } = useDesign();

  return (
    <View
      accessible
      accessibilityLabel={description ? `${title}. ${description}` : title}
      style={[{ alignItems: 'center', gap: space.md, paddingVertical: space.xxl, paddingHorizontal: space.lg }, style]}
    >
      {icon ? (
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: radius.full,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surfaceRaised,
          }}
        >
          {icon({ size: iconScale.xl, color: colors.textTertiary })}
        </View>
      ) : null}
      <Text variant="h3" align="center">
        {title}
      </Text>
      {description ? (
        <Text variant="body" tone="secondary" align="center">
          {description}
        </Text>
      ) : null}
      {action ? (
        <Button label={action.label} variant="secondary" size="md" block={false} onPress={action.onPress} />
      ) : null}
    </View>
  );
}

export interface ErrorStateProps {
  title: string;
  description?: string;
  onRetry?: () => void;
  /** Required with `onRetry`: a default in English ships untranslated. */
  retryLabel?: string;
  style?: ViewStyle;
}

/**
 * A request that failed, with the way out of it.
 *
 * `onRetry` is separate from `action` on EmptyState because retrying is the
 * only sensible thing to offer here, and making it the shape of the component
 * means a screen cannot ship an error with no way forward.
 */
export function ErrorState({ title, description, onRetry, retryLabel, style }: ErrorStateProps) {
  const { colors } = useDesign();

  return (
    <View
      accessible
      accessibilityRole="alert"
      accessibilityLabel={description ? `${title}. ${description}` : title}
      style={[{ alignItems: 'center', gap: space.md, paddingVertical: space.xxl, paddingHorizontal: space.lg }, style]}
    >
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: radius.full,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.warning.soft,
        }}
      >
        <Text variant="h2" style={{ color: colors.warning.text }}>
          !
        </Text>
      </View>
      <Text variant="h3" align="center">
        {title}
      </Text>
      {description ? (
        <Text variant="body" tone="secondary" align="center">
          {description}
        </Text>
      ) : null}
      {onRetry && retryLabel ? (
        <Button label={retryLabel} variant="secondary" size="md" block={false} onPress={onRetry} />
      ) : null}
    </View>
  );
}

/**
 * One section of a screen could not be loaded, said where that section would
 * have been.
 *
 * The distinction from `ErrorState` is the whole point: a screen whose main
 * request failed has nothing to show and says so once, full height. A screen
 * where one of five sections failed still has four true sections on it, and
 * replacing all of them with a single apology loses more than it explains.
 */
export function SectionError({
  message,
  onRetry,
  retryLabel,
}: {
  message: string;
  onRetry: () => void;
  retryLabel: string;
}) {
  const { colors } = useDesign();
  return (
    <View
      accessible
      accessibilityRole="alert"
      accessibilityLabel={message}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        padding: space.lg,
        borderRadius: radius.md,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.divider,
      }}
    >
      <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
        {message}
      </Text>
      <Button label={retryLabel} variant="ghost" size="md" block={false} onPress={onRetry} />
    </View>
  );
}

/** A validation message under a field. Announced, and never colour alone. */
export function InlineError({ message }: { message: string }) {
  const { colors } = useDesign();
  if (!message) return null;
  return (
    <Text
      variant="caption"
      accessibilityRole="alert"
      style={{ color: colors.critical.text, marginTop: space.xs }}
    >
      {message}
    </Text>
  );
}

/**
 * A blocking spinner over the page while a mutation is in flight.
 *
 * Deliberately has a label: an unexplained full-screen spinner is the least
 * informative thing an interface can do, and on a slow connection it is what
 * the donor stares at longest.
 */
export function LoadingOverlay({ label }: { label: string }) {
  const { colors } = useDesign();
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
      style={{
        ...StyleSheetAbsoluteFill,
        alignItems: 'center',
        justifyContent: 'center',
        gap: space.md,
        backgroundColor: colors.scrim,
      }}
    >
      <ActivityIndicator size="large" color={colors.rose.base} />
      <Text variant="body" tone="secondary">
        {label}
      </Text>
    </View>
  );
}

const StyleSheetAbsoluteFill = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};

/**
 * Inline "still working", for a section rather than a page.
 *
 * `motion.quick` is not used here: a spinner that fades in on every render is
 * more distracting than one that simply appears.
 */
export function LoadingSection({ label }: { label?: string }) {
  const { colors } = useDesign();
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? 'Loading'}
      accessibilityState={{ busy: true }}
      style={{ alignItems: 'center', justifyContent: 'center', gap: space.sm, paddingVertical: space.xxl }}
    >
      <ActivityIndicator color={colors.textSecondary} />
      {label ? (
        <Text variant="caption" tone="tertiary">
          {label}
        </Text>
      ) : null}
    </View>
  );
}

export { motion };
