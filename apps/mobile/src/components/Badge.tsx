import { PropsWithChildren } from 'react';
import { View, ViewProps } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';
import { AppText } from './AppText';

export interface BadgeProps extends ViewProps {
  variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
}

const badgeColors: Record<string, { bg: string; text: string }> = {
  default: { bg: colors.surfaceElevated, text: colors.textMuted },
  primary: { bg: colors.primaryMuted, text: colors.primary },
  secondary: { bg: '#10202A', text: colors.secondary },
  success: { bg: '#10221F', text: colors.success },
  warning: { bg: '#1F1A12', text: colors.warning },
  danger: { bg: '#26191F', text: colors.danger },
};

export function Badge({
  children,
  variant = 'default',
  style,
  ...props
}: PropsWithChildren<BadgeProps>) {
  const theme = badgeColors[variant]!;
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
