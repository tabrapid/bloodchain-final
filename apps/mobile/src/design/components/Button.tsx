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

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'critical';
export type ButtonSize = 'md' | 'lg';

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
   * The button sits on a filled accent surface (the emergency banner).
   *
   * Without it a `secondary` button there draws its label in `textPrimary`,
   * which is near-white in dark and near-black in light -- and near-black on a
   * saturated red is about 3.5:1, under the 4.5:1 this app holds itself to.
   * The label and the border both become `textOnAccent`, which is the one
   * colour checked against every accent fill.
   */
  onAccent?: boolean;
  style?: ViewStyle;
}

/**
 * The V2 button.
 *
 * Four variants, and the fourth is the reason the palette was reorganised:
 * `critical` is the only control in the app that fills itself with a saturated
 * red, and it is reserved for emergency response and for destructive
 * confirmation. Everything else that used to be red -- the brand, the primary
 * action -- is `primary`, drawn in rose. Someone glancing at a screen can tell
 * "this is the main thing to do" from "this is the emergency" without reading a
 * word, which is the whole point.
 *
 * Press feedback is a 3% scale and a colour change, both at 120ms. It is
 * deliberately at the edge of perception: the brief is calm, and a button that
 * bounces is not.
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

  const height = size === 'lg' ? hitTarget.comfortable : hitTarget.min;
  const iconSize = size === 'lg' ? iconScale.md : iconScale.sm;

  const fills: Record<ButtonVariant, { background: string; border: string; label: string }> = {
    primary: { background: tone.fill, border: 'transparent', label: colors.textOnAccent },
    critical: { background: colors.critical.fill, border: 'transparent', label: colors.textOnAccent },
    secondary: { background: 'transparent', border: colors.border, label: colors.textPrimary },
    ghost: { background: 'transparent', border: 'transparent', label: tone.text },
  };
  const paint = onAccent
    ? { background: 'transparent', border: colors.textOnAccent, label: colors.textOnAccent }
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
            paddingHorizontal: size === 'lg' ? space.xl : space.lg,
            paddingVertical: space.md,
            borderRadius: radius.sm,
            backgroundColor: paint.background,
            borderWidth: variant === 'secondary' || onAccent ? 1 : 0,
            borderColor: paint.border,
            opacity: isDisabled ? 0.45 : 1,
            // Secondary and ghost have no fill to darken, so they take a tint.
            ...(pressed && !isDisabled && variant !== 'primary' && variant !== 'critical'
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
        <Text variant="bodyStrong" style={{ color: paint.label }} numberOfLines={1}>
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
  tone?: AccentName;
  style?: ViewStyle;
}

/**
 * A word you can press: "View all", "See trends", "Resend".
 *
 * It exists because the alternative -- a bare `Text` inside a `Pressable` --
 * is what every screen reaches for, and every screen then picks its own
 * colour, its own hit area and its own pressed feedback. Three V1 screens had
 * one of these with no `hitSlop` at all, which on a 13pt label is a target
 * under half the size a finger needs.
 *
 * Deliberately not a `ghost` Button: a ghost Button is rose and button-sized,
 * and a row of section headers with rose buttons in them competes with the
 * primary action of the screen.
 */
export function LinkButton({ label, onPress, tone = 'clinical', disabled, style, ...rest }: LinkButtonProps) {
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
          justifyContent: 'center',
          opacity: pressed || disabled ? 0.6 : 1,
        },
        style,
      ]}
      {...rest}
    >
      <Text variant="label" tone={tone} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export interface IconButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  /** Required. An icon with no label is invisible to a screen reader. */
  accessibilityLabel: string;
  icon: (props: { size: number; color: string }) => ReactNode;
  variant?: 'plain' | 'surface';
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
  const color =
    tone === 'primary' ? colors.textPrimary : tone === 'secondary' ? colors.textSecondary : colors[tone].text;

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
          borderRadius: radius.sm,
          backgroundColor:
            pressed && !disabled
              ? colors.surfacePressed
              : variant === 'surface'
                ? colors.surfaceRaised
                : 'transparent',
          opacity: disabled ? 0.45 : 1,
        },
        style,
      ]}
      {...rest}
    >
      {icon({ size: iconScale.lg, color })}
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
