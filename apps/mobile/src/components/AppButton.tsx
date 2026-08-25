import { Children, PropsWithChildren } from 'react';
import { Pressable, PressableProps, StyleSheet, View, ViewStyle } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';
import { AppText } from './AppText';

export interface AppButtonProps extends PressableProps {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'default' | 'small';
  loading?: boolean;
}

const variants: Record<string, ViewStyle> = {
  primary: { backgroundColor: colors.primary },
  secondary: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  danger: { backgroundColor: colors.danger },
  ghost: { backgroundColor: 'transparent' },
};

export function AppButton({
  children,
  variant = 'primary',
  size = 'default',
  loading = false,
  disabled,
  style,
  ...props
}: PropsWithChildren<AppButtonProps>) {
  const flattenedStyle = StyleSheet.flatten(style);
  const isDisabled = disabled || loading;
  const textColor = variant === 'secondary' || variant === 'ghost' ? colors.text : colors.white;
  const textStyle = { ...typography.button, color: textColor };

  return (
    <Pressable
      style={({ pressed }) => ({
        borderRadius: radius.sm,
        paddingVertical: size === 'small' ? spacing.sm : spacing.md,
        paddingHorizontal: spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.85 : isDisabled ? 0.5 : 1,
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