import type { CSSProperties, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  gradient?: string;
  radius?: string;
  padding?: number | string;
  style?: CSSProperties;
  onClick?: () => void;
}

export default function GradientCard({
  children,
  gradient = 'linear-gradient(135deg, #D85360 0%, #8E4A75 100%)',
  radius = '26px',
  padding = 20,
  style,
  onClick,
}: Props) {
  return (
    <div
      onClick={onClick}
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: radius,
        background: gradient,
        padding,
        boxShadow: '0 12px 40px rgba(216, 83, 96, 0.35)',
        cursor: onClick ? 'pointer' : undefined,
        ...style,
      }}
    >
      {/* Subtle gloss overlay */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '50%',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.18) 0%, transparent 100%)',
          borderRadius: `${radius} ${radius} 0 0`,
          pointerEvents: 'none',
        }}
      />
      <div style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </div>
    </div>
  );
}
