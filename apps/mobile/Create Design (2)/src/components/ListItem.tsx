import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import GlassCard from './GlassCard';
import { useTheme } from '../context';
import { DARK, LIGHT } from '../types';

interface Props {
  leading?: ReactNode;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  chevron?: boolean;
  onClick?: () => void;
}

export default function ListItem({ leading, title, subtitle, trailing, chevron = true, onClick }: Props) {
  const { theme } = useTheme();
  const T = theme === 'dark' ? DARK : LIGHT;

  return (
    <GlassCard padding="12px 14px" onClick={onClick}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {leading && (
          <div style={{ flexShrink: 0 }}>
            {leading}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {title}
          </div>
          {subtitle && (
            <div style={{ fontSize: 12, color: T.textMuted, marginTop: 1 }}>{subtitle}</div>
          )}
        </div>
        {trailing && <div style={{ flexShrink: 0 }}>{trailing}</div>}
        {chevron && !trailing && (
          <ChevronRight size={16} color={T.textMuted} />
        )}
      </div>
    </GlassCard>
  );
}
