import { View } from 'react-native';
import { radius, spacing, typography, useTheme, ThemeColors } from '../theme';
import { AppText } from './AppText';
import { GlassCard } from './GlassCard';
import { LucideIcon } from '../types/icons';

export interface StatCardProps {
  label: string;
  value: string;
  note?: string;
  icon?: LucideIcon;
  variant?: 'default' | 'secondary' | 'success' | 'warning' | 'danger';
  style?: object;
}

function getIconTheme(colors: ThemeColors): Record<string, { bg: string; icon: string }> {
  return {
    default: { bg: colors.surfaceElevated, icon: colors.textMuted },
    secondary: { bg: colors.secondaryMuted, icon: colors.secondary },
    success: { bg: colors.successMuted, icon: colors.success },
    warning: { bg: colors.warningMuted, icon: colors.warning },
    danger: { bg: colors.dangerMuted, icon: colors.danger },
  };
}

/**
 * A stat tile that's real glass, not a flat translucent square.
 *
 * This previously rendered as a plain `View` with a low-alpha background and
 * no `BlurView` at all -- the same bug `Card` had before it was made to
 * delegate to `GlassCard` (see P0-35): a translucent color with nothing
 * behind it to blur just reads as a dull, flat tint. The `variant` prop used
 * to tint the *entire* card surface, which also fought with the glass look
 * once it had one. Now only the small icon badge is tinted per variant --
 * matching the reference design -- and the card itself is always real glass.
 */
export function StatCard({ label, value, note, icon: Icon, variant = 'default', style }: StatCardProps) {
  const { colors } = useTheme();
  const iconTheme = getIconTheme(colors)[variant]!;

  return (
    <GlassCard style={[{ alignItems: 'flex-start' }, style]}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          width: '100%',
          marginBottom: spacing.sm,
        }}
      >
        <AppText muted style={{ ...typography.caption }}>
          {label.toUpperCase()}
        </AppText>
        {Icon && (
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: radius.sm,
              backgroundColor: iconTheme.bg,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon size={16} color={iconTheme.icon} />
          </View>
        )}
      </View>
      <AppText style={{ ...typography.numeric }}>{value}</AppText>
      {note && (
        <AppText muted style={{ marginTop: spacing.xs }}>
          {note}
        </AppText>
      )}
    </GlassCard>
  );
}
