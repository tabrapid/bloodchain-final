import type { CSSProperties } from 'react';
import { useTheme } from '../context';
import { RADIUS } from '../types';

interface Props {
  width?: number | string;
  height?: number | string;
  radius?: number;
  style?: CSSProperties;
}

/** Shimmer placeholder for async content. */
export default function Skeleton({ width = '100%', height = 16, radius = RADIUS.sm, style }: Props) {
  const { theme } = useTheme();
  const base = theme === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';
  const shimmer = theme === 'dark' ? 'rgba(255,255,255,0.13)' : 'rgba(0,0,0,0.10)';

  return (
    <div
      aria-hidden="true"
      style={{
        width,
        height,
        borderRadius: radius,
        background: base,
        overflow: 'hidden',
        position: 'relative',
        ...style,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(90deg, transparent 0%, ${shimmer} 50%, transparent 100%)`,
          animation: 'skeleton-shimmer 1.6s ease-in-out infinite',
        }}
      />
    </div>
  );
}

/** Pre-composed card skeleton — matches a standard GlassCard row. */
export function SkeletonCard() {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '14px 16px' }}>
      <Skeleton width={40} height={40} radius={RADIUS.sm} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Skeleton height={14} width="60%" />
        <Skeleton height={12} width="40%" />
      </div>
    </div>
  );
}
