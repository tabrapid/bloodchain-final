import type { CSSProperties, InputHTMLAttributes, ReactNode } from 'react';
import { useTheme } from '../context';
import { DARK, LIGHT } from '../types';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  trailing?: ReactNode;
  wrapperStyle?: CSSProperties;
}

export default function InputField({ label, error, trailing, wrapperStyle, ...props }: Props) {
  const { theme } = useTheme();
  const T = theme === 'dark' ? DARK : LIGHT;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, ...wrapperStyle }}>
      {label && (
        <label style={{ fontSize: 13, fontWeight: 500, color: T.textMuted, letterSpacing: '-0.01em' }}>
          {label}
        </label>
      )}
      <div style={{ position: 'relative' }}>
        <input
          {...props}
          style={{
            width: '100%',
            padding: '14px 16px',
            paddingRight: trailing ? 44 : 16,
            borderRadius: 14,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            background: T.surface,
            border: `1px solid ${error ? '#D85360' : T.border}`,
            color: T.text,
            fontSize: 15,
            fontFamily: 'inherit',
            transition: 'border-color 0.15s',
            ...props.style,
          }}
        />
        {trailing && (
          <div style={{
            position: 'absolute',
            right: 14,
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'center',
          }}>
            {trailing}
          </div>
        )}
      </div>
      {error && (
        <span style={{ fontSize: 12, color: '#D85360', letterSpacing: '-0.01em' }}>{error}</span>
      )}
    </div>
  );
}
