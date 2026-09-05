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
  // The reference washes the icon square in the accent at 15% and draws the
  // icon in the full accent -- not a heavier tint under a lightened icon.
  const accent = colors[color];
  const iconBg = `${accent}26`;

  const card = (
    <GlassCard style={{ alignItems: 'center', padding: 14 }}>
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
        <Icon size={18} color={accent} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
        <AppText style={{ fontSize: 28, fontWeight: '700', letterSpacing: -0.84 }}>{value}</AppText>
        {unit && (
          <AppText muted style={{ fontSize: 12, fontWeight: '500' }}>
            {unit}
          </AppText>
        )}
      </View>
      <AppText muted style={{ fontSize: 11, fontWeight: '500', textAlign: 'center' }}>
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
