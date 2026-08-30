import type { CSSProperties } from 'react';
import { COLORS } from '../types';

type Color = 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'ai';

const PALETTE: Record<Color, { bg: string; text: string }> = {
  default: { bg: 'rgba(255,255,255,0.12)', text: 'rgba(255,255,255,0.7)' },
  primary: { bg: 'rgba(216, 83, 96, 0.18)', text: COLORS.primary },
  secondary: { bg: 'rgba(104, 183, 209, 0.18)', text: COLORS.secondary },
  success: { bg: 'rgba(99, 194, 155, 0.18)', text: COLORS.success },
  warning: { bg: 'rgba(229, 184, 109, 0.18)', text: COLORS.warning },
  danger: { bg: 'rgba(216, 83, 96, 0.18)', text: COLORS.danger },
  ai: { bg: 'rgba(142, 130, 223, 0.18)', text: COLORS.ai },
};

interface Props {
  children: string;
  color?: Color;
  style?: CSSProperties;
}

export default function Badge({ children, color = 'default', style }: Props) {
  const { bg, text } = PALETTE[color];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 999,
        padding: '3px 9px',
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        background: bg,
        color: text,
        border: `1px solid ${text}28`,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </span>
  );
}
