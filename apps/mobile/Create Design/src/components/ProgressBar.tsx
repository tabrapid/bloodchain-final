import type { CSSProperties } from 'react';

interface Props {
  value: number; // 0-100
  color?: string;
  height?: number;
  style?: CSSProperties;
}

export default function ProgressBar({ value, color = '#D85360', height = 5, style }: Props) {
  return (
    <div style={{
      width: '100%',
      height,
      borderRadius: 999,
      background: 'rgba(255,255,255,0.1)',
      overflow: 'hidden',
      ...style,
    }}>
      <div style={{
        width: `${Math.min(100, Math.max(0, value))}%`,
        height: '100%',
        borderRadius: 999,
        background: color,
        transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
      }} />
    </div>
  );
}
