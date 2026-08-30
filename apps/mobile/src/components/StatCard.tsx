import { View } from 'react-native';
import { radius, spacing, typography, useTheme, ThemeColors } from '../theme';
import { AppText } from './AppText';
import { LucideIcon } from '../types/icons';

export interface StatCardProps {
  label: string;
  value: string;
  note?: string;
  icon?: LucideIcon;
  variant?: 'default' | 'secondary' | 'success' | 'warning' | 'danger';
  style?: object;
}

function getVariants(colors: ThemeColors): Record<string, { border: string; bg: string; icon: string }> {
  return {
    default: { border: colors.border, bg: colors.surface, icon: colors.textMuted },
    secondary: { border: colors.border, bg: colors.secondaryMuted, icon: colors.secondary },
    success: { border: colors.border, bg: colors.successMuted, icon: colors.success },
    warning: { border: colors.border, bg: colors.warningMuted, icon: colors.warning },
    danger: { border: colors.border, bg: colors.dangerMuted, icon: colors.danger },
  };
}

export function StatCard({
  label,
  value,
  note,
  icon: Icon,
  variant = 'default',
  style,
}: StatCardProps) {
  const { colors } = useTheme();
  const theme = getVariants(colors)[variant]!;
  return (
    <View
      style={{
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: theme.border,
        backgroundColor: theme.bg,
        padding: spacing.md,
        ...style,
      }}
    >
      <View
        style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}
      >
        <AppText style={{ ...typography.caption, color: colors.textMuted }}>
          {label.toUpperCase()}
        </AppText>
        {Icon && <Icon size={18} color={theme.icon} />}
      </View>
      <AppText style={{ ...typography.numeric }}>{value}</AppText>
      {note && (
        <AppText muted style={{ marginTop: spacing.xs }}>
          {note}
        </AppText>
      )}
    </View>
  );
}
