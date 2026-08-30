import type { CSSProperties, ReactNode } from 'react';
import { useTheme } from '../context';
import { DARK, LIGHT } from '../types';

type Radius = 'sm' | 'md' | 'lg' | 'xl';

const RADIUS: Record<Radius, string> = {
  sm: '12px',
  md: '18px',
  lg: '26px',
  xl: '34px',
};

interface Props {
  children: ReactNode;
  radius?: Radius;
  padding?: number | string;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  elevated?: boolean;
  danger?: boolean;
}

export default function GlassCard({
  children,
  radius = 'md',
  padding = 16,
  className,
  style,
  onClick,
  elevated,
  danger,
}: Props) {
  const { theme } = useTheme();
  const T = theme === 'dark' ? DARK : LIGHT;

  const bg = danger
    ? 'rgba(216, 83, 96, 0.12)'
    : elevated
    ? T.surfaceHigh
    : T.surface;

  const border = danger
    ? 'rgba(216, 83, 96, 0.28)'
    : elevated
    ? T.borderHigh
    : T.border;

  return (
    <div
      className={className}
      onClick={onClick}
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: RADIUS[radius],
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        background: bg,
        border: `1px solid ${border}`,
        boxShadow: T.shadow,
        padding,
        cursor: onClick ? 'pointer' : undefined,
        ...style,
      }}
    >
      {/* Specular highlight – liquid glass cue */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '44%',
          background: T.specular,
          borderRadius: `${RADIUS[radius]} ${RADIUS[radius]} 0 0`,
          pointerEvents: 'none',
        }}
      />
      <div style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </div>
    </div>
  );
}
