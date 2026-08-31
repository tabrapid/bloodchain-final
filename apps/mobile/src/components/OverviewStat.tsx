import { ReactNode } from 'react';
import { TouchableOpacity, View, ViewStyle } from 'react-native';
import { spacing, useTheme } from '../theme';
import { AppText } from './AppText';
import { GlassCard } from './GlassCard';
import { LucideIcon } from '../types/icons';

export type OverviewStatColor = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'ai';

export interface OverviewStatProps {
  icon: LucideIcon;
  color: OverviewStatColor;
  value: ReactNode;
  unit?: string;
  label: string;
  onPress?: () => void;
  style?: ViewStyle;
}

/**
 * The compact stat-grid tile from Home's "Your Overview" section: icon in a
 * colored rounded square, big number (with its unit given its own smaller,
 * offset baseline instead of being crammed against the digits), small label
 * underneath. This is the one shared implementation -- Health's "Overview"
 * section renders the same component rather than a visually different
 * hand-rolled tile.
 */
export function OverviewStat({ icon: Icon, color, value, unit, label, onPress, style }: OverviewStatProps) {
  const { colors } = useTheme();
  const iconBg = colors[`${color}Muted` as const];
  const iconColor = colors.onMuted[color];

  const card = (
    <GlassCard style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: iconBg,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing.sm,
        }}
      >
        <Icon size={18} color={iconColor} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
        <AppText style={{ fontSize: 28, fontWeight: '700' }}>{value}</AppText>
        {unit && (
          <AppText muted style={{ fontSize: 12, fontWeight: '500' }}>
            {unit}
          </AppText>
        )}
      </View>
      <AppText muted style={{ fontSize: 12, textAlign: 'center', marginTop: spacing.xs }}>
        {label}
      </AppText>
    </GlassCard>
  );

  if (!onPress) {
    return <View style={style}>{card}</View>;
  }

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={style}>
      {card}
    </TouchableOpacity>
  );
}
