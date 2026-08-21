import { View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';
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

const variants: Record<string, { border: string; bg: string; icon: string }> = {
  default: { border: colors.border, bg: colors.surface, icon: colors.textMuted },
  secondary: { border: '#29404D', bg: '#10202A', icon: colors.secondary },
  success: { border: '#28413B', bg: '#10221F', icon: colors.success },
  warning: { border: '#4A3B22', bg: '#1F1A12', icon: colors.warning },
  danger: { border: '#5B3038', bg: '#26191F', icon: colors.danger },
};

export function StatCard({
  label,
  value,
  note,
  icon: Icon,
  variant = 'default',
  style,
}: StatCardProps) {
  const theme = variants[variant]!;
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
