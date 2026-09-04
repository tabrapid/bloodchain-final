import { Children, PropsWithChildren } from 'react';
import { Pressable, PressableProps, StyleSheet, View, ViewStyle } from 'react-native';
import { radius, spacing, typography, useTheme, ThemeColors } from '../theme';
import { AppText } from './AppText';

export interface AppButtonProps extends PressableProps {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'default' | 'small';
  loading?: boolean;
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
    </Pressable>
  );
}
