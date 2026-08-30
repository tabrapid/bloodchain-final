import { PropsWithChildren } from 'react';
import { View, ViewProps } from 'react-native';
import { radius, spacing, typography, useTheme, ThemeColors } from '../theme';
import { AppText } from './AppText';

export interface BadgeProps extends ViewProps {
  variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
}

function getBadgeColors(colors: ThemeColors): Record<string, { bg: string; text: string }> {
  return {
    default: { bg: colors.surfaceElevated, text: colors.textMuted },
    primary: { bg: colors.primaryMuted, text: colors.primary },
    secondary: { bg: colors.secondaryMuted, text: colors.secondary },
    success: { bg: colors.successMuted, text: colors.success },
    warning: { bg: colors.warningMuted, text: colors.warning },
    danger: { bg: colors.dangerMuted, text: colors.danger },
  };
}

export function Badge({
  children,
  variant = 'default',
  style,
  ...props
}: PropsWithChildren<BadgeProps>) {
  const { colors } = useTheme();
  const theme = getBadgeColors(colors)[variant]!;
  return (
    <View
      style={[
        {
          backgroundColor: theme.bg,
          borderRadius: radius.pill,
          paddingVertical: spacing.xs,
          paddingHorizontal: spacing.sm,
        },
        style,
      ]}
      {...props}
    >
      <AppText style={{ ...typography.caption, color: theme.text }}>{children}</AppText>
    </View>
  );
}
