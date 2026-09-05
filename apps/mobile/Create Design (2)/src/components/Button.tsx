import type { CSSProperties, ReactNode } from 'react';
import { useTheme } from '../context';
import { DARK, LIGHT, COLORS } from '../types';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

interface Props {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
  fullWidth?: boolean;
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  onClick,
  style,
  fullWidth,
}: Props) {
  const { theme } = useTheme();
  const T = theme === 'dark' ? DARK : LIGHT;

  const base: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 999,
    fontWeight: 700,
    fontSize: size === 'sm' ? 13 : 15,
    padding: size === 'sm' ? '8px 16px' : '14px 24px',
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    opacity: disabled || loading ? 0.5 : 1,
    transition: 'opacity 0.15s, transform 0.1s',
    width: fullWidth ? '100%' : undefined,
    letterSpacing: '-0.01em',
  };

  const variants: Record<Variant, CSSProperties> = {
    primary: {
      background: COLORS.primary,
      color: '#fff',
      boxShadow: '0 4px 16px rgba(216, 83, 96, 0.4)',
    },
    secondary: {
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      background: T.surface,
      border: `1px solid ${T.border}`,
      color: COLORS.primary,
    },
    ghost: {
      background: 'transparent',
      color: COLORS.primary,
    },
    danger: {
      background: COLORS.danger,
      color: '#fff',
      boxShadow: '0 4px 20px rgba(216, 83, 96, 0.5)',
    },
  };

  return (
    <button
      onClick={!disabled && !loading ? onClick : undefined}
      style={{ ...base, ...variants[variant], ...style }}
    >
      {loading ? (
        <span style={{
          width: 16,
          height: 16,
          borderRadius: '50%',
          border: '2px solid rgba(255,255,255,0.35)',
          borderTopColor: '#fff',
          animation: 'spin 0.7s linear infinite',
          display: 'inline-block',
        }} />
      ) : children}
    </button>
  );
}
