import { useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  View,
  type PressableProps,
  type ViewStyle,
} from 'react-native';
import { type ReactNode } from 'react';
import { useDesign } from '../useDesign';
import { hitTarget, icon as iconScale, motion, radius, space, type AccentName } from '../tokens';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'critical';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Rendered before the label, at the right size for it. */
  icon?: (props: { size: number; color: string }) => ReactNode;
  loading?: boolean;
  /** Fills the row. Primary actions do; inline ones do not. */
  block?: boolean;
  /** Overrides the accent. Use sparingly — the variant should usually decide. */
  accent?: AccentName;
  /**
   * The button sits on a filled accent surface (the emergency banner). The
   * label and the border both become `textOnAccent`, which is the one colour
   * checked against every accent fill.
   */
  onAccent?: boolean;
  style?: ViewStyle;
}

/**
 * The V4 button.
 *
 *   primary    rose fill. The one thing to do on the screen.
 *   secondary  a tonal fill (raised surface, no border). The quiet alternative.
 *              Tonal rather than outlined because an outline on a dark page
 *              reads as a form field, and a screen with three outlined boxes
 *              in a column reads as a form.
 *   outline    a hairline. For an action on a tinted or hero surface where a
 *              tonal fill would vanish.
 *   ghost      text only.
 *   critical   the emergency red. Reserved for emergency response and for
 *              destructive confirmation.
 *
 * Press feedback is a 2.5% scale and a colour change, both at 120ms. It is
 * deliberately at the edge of perception: the brief is calm, and a button
 * that bounces is not.
 */
export function Button({
  label,
  variant = 'primary',
  size = 'lg',
  icon,
  loading = false,
  block = true,
  accent,
  onAccent = false,
  disabled,
  onPressIn,
  onPressOut,
  style,
  ...rest
}: ButtonProps) {
  const { colors } = useDesign();
  const scale = useRef(new Animated.Value(1)).current;

  const isDisabled = Boolean(disabled) || loading;
  const accentName: AccentName = accent ?? (variant === 'critical' ? 'critical' : 'rose');
  const tone = colors[accentName];

  const height = size === 'lg' ? hitTarget.comfortable : size === 'md' ? hitTarget.min : 36;
  const iconSize = size === 'lg' ? iconScale.md : iconScale.sm;
  const corner = size === 'lg' ? radius.md : size === 'md' ? radius.sm : 10;

  const fills: Record<ButtonVariant, { background: string; border: string; label: string }> = {
    primary: { background: tone.fill, border: 'transparent', label: colors.textOnAccent },
    critical: { background: colors.critical.fill, border: 'transparent', label: colors.textOnAccent },
    secondary: {
      background: accent ? tone.soft : colors.surfaceRaised,
      border: 'transparent',
      label: accent ? tone.text : colors.textPrimary,
    },
    outline: { background: 'transparent', border: colors.border, label: accent ? tone.text : colors.textPrimary },
    ghost: { background: 'transparent', border: 'transparent', label: tone.text },
  };
  const paint = onAccent
    ? { background: 'rgba(255,255,255,0.14)', border: 'transparent', label: colors.textOnAccent }
    : fills[variant];

  const animate = (to: number) =>
    Animated.timing(scale, { toValue: to, duration: motion.instant, useNativeDriver: true }).start();

  return (
    <Animated.View style={[{ transform: [{ scale }] }, block ? undefined : { alignSelf: 'flex-start' }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        // Both flags, not one: a disabled button and a loading button are
        // different facts, and a screen reader should say which.
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        disabled={isDisabled}
        onPressIn={(e) => {
          animate(motion.pressScale);
          onPressIn?.(e);
        }}
        onPressOut={(e) => {
          animate(1);
          onPressOut?.(e);
        }}
        style={({ pressed }) => [
          {
            minHeight: height,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: space.sm,
            paddingHorizontal: size === 'lg' ? space.xl : size === 'md' ? space.lg : space.md,
            paddingVertical: size === 'sm' ? space.sm : space.md,
            borderRadius: corner,
            backgroundColor: paint.background,
            borderWidth: variant === 'outline' ? 1 : 0,
            borderColor: paint.border,
            opacity: isDisabled ? 0.4 : pressed && (variant === 'primary' || variant === 'critical') ? 0.88 : 1,
            ...(pressed && !isDisabled && variant !== 'primary' && variant !== 'critical' && !onAccent
              ? { backgroundColor: colors.surfacePressed }
              : null),
          },
          style,
        ]}
        {...rest}
      >
        {loading ? (
          <ActivityIndicator size="small" color={paint.label} />
        ) : (
          icon?.({ size: iconSize, color: paint.label })
        )}
        <Text
          variant={size === 'sm' ? 'label' : 'bodyStrong'}
          style={{ color: paint.label }}
          numberOfLines={1}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export interface LinkButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  onPress: () => void;
  /** Defaults to the clinical blue every link in the app uses. */
  tone?: AccentName | 'secondary';
  /** A small icon after the label: a chevron, an arrow. */
  icon?: (props: { size: number; color: string }) => ReactNode;
  style?: ViewStyle;
}

/**
 * A word you can press: "View all", "See trends", "Resend".
 *
 * It exists because the alternative -- a bare `Text` inside a `Pressable` --
 * is what every screen reaches for, and every screen then picks its own
 * colour, its own hit area and its own pressed feedback.
 */
export function LinkButton({ label, onPress, tone = 'clinical', icon, disabled, style, ...rest }: LinkButtonProps) {
  const { colors } = useDesign();
  const color = tone === 'secondary' ? colors.textSecondary : colors[tone].text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        {
          minHeight: hitTarget.min,
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.xs,
          justifyContent: 'center',
          opacity: pressed || disabled ? 0.6 : 1,
        },
        style,
      ]}
      {...rest}
    >
      <Text variant="label" style={{ color }} numberOfLines={1}>
        {label}
      </Text>
      {icon?.({ size: iconScale.sm, color })}
    </Pressable>
  );
}

export interface IconButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  /** Required. An icon with no label is invisible to a screen reader. */
  accessibilityLabel: string;
  icon: (props: { size: number; color: string }) => ReactNode;
  /** `plain` sits on nothing; `surface` is a tonal circle; `tonal` is an accent-tinted one. */
  variant?: 'plain' | 'surface' | 'tonal';
  tone?: 'primary' | 'secondary' | AccentName;
  style?: ViewStyle;
}

/**
 * A square tap target with an icon in it.
 *
 * `accessibilityLabel` is a required prop rather than an optional one. An icon
 * button without it is announced as "button" and nothing else, and the person
 * who needed the label is the one who cannot see the icon.
 */
export function IconButton({
  accessibilityLabel,
  icon,
  variant = 'plain',
  tone = 'primary',
  disabled,
  style,
  ...rest
}: IconButtonProps) {
  const { colors } = useDesign();
  const accent = tone !== 'primary' && tone !== 'secondary' ? colors[tone] : null;
  const color =
    tone === 'primary'
      ? colors.textPrimary
      : tone === 'secondary'
        ? colors.textSecondary
        : variant === 'tonal'
          ? accent!.base
          : accent!.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      style={({ pressed }) => [
        {
          width: hitTarget.min,
          height: hitTarget.min,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radius.full,
          backgroundColor:
            pressed && !disabled
              ? colors.surfacePressed
              : variant === 'surface'
                ? colors.surfaceRaised
                : variant === 'tonal' && accent
                  ? accent.soft
                  : 'transparent',
          opacity: disabled ? 0.4 : 1,
        },
        style,
      ]}
      {...rest}
    >
      {icon({ size: iconScale.md + 2, color })}
    </Pressable>
  );
}

/**
 * A row of buttons that share the width.
 *
 * Exists so that "two buttons side by side" is one decision rather than a
 * flexDirection and a gap repeated at every call site with slightly different
 * numbers.
 */
export function ButtonRow({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', gap: space.md }}>{children}</View>;
}
