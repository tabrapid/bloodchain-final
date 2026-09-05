import type { CSSProperties, ReactNode } from 'react';
import { useTheme } from '../context';
import { DARK, LIGHT } from '../types';

interface Props {
  icon: ReactNode;
  onClick?: () => void;
  size?: number;
  style?: CSSProperties;
  badge?: number;
}

export default function IconButton({ icon, onClick, size = 40, style, badge }: Props) {
  const { theme } = useTheme();
  const T = theme === 'dark' ? DARK : LIGHT;

  return (
    <button
      onClick={onClick}
      style={{
        position: 'relative',
        width: size,
        height: size,
        borderRadius: 14,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        background: T.surface,
        border: `1px solid ${T.border}`,
        boxShadow: T.shadow,
        cursor: 'pointer',
        flexShrink: 0,
        ...style,
      }}
    >
      {icon}
      {badge != null && badge > 0 && (
        <span style={{
          position: 'absolute',
          top: -3,
          right: -3,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#D85360',
          fontSize: 9,
          fontWeight: 700,
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  );
}
