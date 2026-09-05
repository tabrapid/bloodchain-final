import type { ReactNode } from 'react';
import GlassCard from './GlassCard';
import { useTheme } from '../context';
import { DARK, LIGHT } from '../types';

interface Props {
  icon: ReactNode;
  iconBg?: string;
  value: string;
  label: string;
  unit?: string;
}

export default function StatCard({ icon, iconBg = 'rgba(216, 83, 96, 0.2)', value, label, unit }: Props) {
  const { theme } = useTheme();
  const T = theme === 'dark' ? DARK : LIGHT;

  return (
    <GlassCard padding={14} style={{ textAlign: 'center', flex: 1 }}>
      <div style={{
        width: 40,
        height: 40,
        borderRadius: 12,
        background: iconBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 8px',
      }}>
        {icon}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 2 }}>
        <span style={{ fontSize: 28, fontWeight: 700, color: T.text, letterSpacing: '-0.03em' }}>
          {value}
        </span>
        {unit && <span style={{ fontSize: 12, color: T.textMuted, fontWeight: 500 }}>{unit}</span>}
      </div>
      <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 500 }}>{label}</span>
    </GlassCard>
  );
}
