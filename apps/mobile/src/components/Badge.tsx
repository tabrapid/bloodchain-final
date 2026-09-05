import { PropsWithChildren } from 'react';
import { View, ViewProps } from 'react-native';
import { radius, spacing, typography, useTheme, ThemeColors } from '../theme';
import { AppText } from './AppText';

export interface BadgeProps extends ViewProps {
  variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'ai';
}

function getBadgeColors(colors: ThemeColors): Record<string, { bg: string; text: string }> {
  // Text uses the `onMuted` shade, not the raw accent: the accent is a
  // mid-tone and lands ~1.9:1 against its own tint on dark (and ~3.0:1 on
  // light), well under the 4.5:1 small text needs. `onMuted` is the same hue
  // shifted per mode to clear it.
  return {
    default: { bg: colors.surfaceElevated, text: colors.textMuted },
    primary: { bg: colors.primaryMuted, text: colors.onMuted.primary },
    secondary: { bg: colors.secondaryMuted, text: colors.onMuted.secondary },
    success: { bg: colors.successMuted, text: colors.onMuted.success },
    warning: { bg: colors.warningMuted, text: colors.onMuted.warning },
    danger: { bg: colors.dangerMuted, text: colors.onMuted.danger },
    ai: { bg: colors.aiMuted, text: colors.onMuted.ai },
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
          // A border in the badge's own text color (at low alpha) is what
          // gives Create Design's badges their defined pill outline, instead
          // of reading as a flat, edgeless tint.
          borderWidth: 1,
          borderColor: `${theme.text}28`,
        },
        style,
      ]}
      {...props}
    >
      <AppText style={{ ...typography.caption, color: theme.text, textTransform: 'uppercase' }}>
        {children}
      </AppText>
    </View>
  );
}
