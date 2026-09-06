import { Children, PropsWithChildren } from 'react';
import { Pressable, PressableProps, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { radius, spacing, typography, useTheme, ThemeColors } from '../theme';
import { LucideIcon } from '../types/icons';
import { AppText } from './AppText';

export interface AppButtonProps extends PressableProps {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'default' | 'small';
  loading?: boolean;
  /**
   * Fills the button with the brand's rose-to-violet CTA gradient instead of a
   * flat accent. Reserved for the one action a screen is actually asking for
   * -- Sign in, Create account, Continue. A screen with two gradient buttons
   * has no primary action.
   */
  gradient?: boolean;
  /**
   * An icon pinned to the right edge. It sits outside the centred content row
   * on purpose: laid out as a sibling of the label it drags the label off
   * centre, and a CTA whose text is not centred reads as a mistake.
   */
  trailingIcon?: LucideIcon;
}

function getVariants(colors: ThemeColors): Record<string, ViewStyle> {
  return {
    // The colored glow beneath primary/danger buttons matches Create
    // Design's `boxShadow: rgba(color, 0.4-0.5)` -- `shadowOpacity` scales
    // whatever alpha `shadowColor` already has, so an opaque hex color here
    // reproduces that glow without needing an rgba conversion.
    primary: {
      backgroundColor: colors.primary,
      shadowColor: colors.primary,
      shadowOpacity: 0.4,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    secondary: {
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    danger: {
      backgroundColor: colors.danger,
      shadowColor: colors.danger,
      shadowOpacity: 0.5,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 4 },
      elevation: 8,
    },
    ghost: { backgroundColor: 'transparent' },
  };
}

export function AppButton({
  children,
  variant = 'primary',
  size = 'default',
  loading = false,
  gradient = false,
  trailingIcon: TrailingIcon,
  disabled,
  style,
  ...props
}: PropsWithChildren<AppButtonProps>) {
  const { colors } = useTheme();
  const variants = getVariants(colors);
  const flattenedStyle = StyleSheet.flatten(style);
  const isDisabled = disabled || loading;
  const textColor = variant === 'secondary' || variant === 'ghost' ? colors.primary : colors.white;
  const textStyle = { ...typography.button, color: textColor };
  // A gradient only makes sense over a filled variant -- painting one across a
  // ghost button would quietly turn it into a second primary.
  const showGradient = gradient && (variant === 'primary' || variant === 'danger');

  return (
    <Pressable
      style={({ pressed }) => ({
        borderRadius: radius.pill,
        paddingVertical: size === 'small' ? spacing.sm : spacing.md,
        paddingHorizontal: spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.9 : isDisabled ? 0.5 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
        ...variants[variant],
        ...flattenedStyle,
      })}
      disabled={isDisabled}
      {...props}
    >
      {/* Declared before the content, so it paints beneath it. It carries its
          own radius rather than relying on the parent clipping: `overflow:
          hidden` on the Pressable would clip the coloured glow too. */}
      {showGradient && (
        <LinearGradient
          colors={colors.ctaGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[StyleSheet.absoluteFillObject, { borderRadius: radius.pill }]}
          pointerEvents="none"
        />
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs }}>
        {loading ? (
          <AppText style={textStyle}>Loading...</AppText>
        ) : (
          // Icons (or any non-text element) are rendered as siblings instead of
          // nesting inside AppText — React Native's Text can't host a View/SVG.
          Children.map(children, (child) =>
            typeof child === 'string' || typeof child === 'number' ? (
              <AppText style={textStyle}>{child}</AppText>
            ) : (
              child
            ),
          )
        )}
      </View>
      {TrailingIcon && !loading && (
        <View style={{ position: 'absolute', right: 20 }} pointerEvents="none">
          <TrailingIcon size={18} color={textColor} strokeWidth={2.5} />
        </View>
      )}
    </Pressable>
  );
}
