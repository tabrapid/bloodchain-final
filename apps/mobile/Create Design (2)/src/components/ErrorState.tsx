import { AlertCircle } from 'lucide-react';
import { useTheme } from '../context';
import { DARK, LIGHT } from '../types';

interface Props {
  message?: string;
  onRetry?: () => void;
}

/** Inline error state — concise message + Retry. */
export default function ErrorState({ message = 'Something went wrong.', onRetry }: Props) {
  const { theme } = useTheme();
  const T = theme === 'dark' ? DARK : LIGHT;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: '40px 32px',
      gap: 12,
    }}>
      <div style={{
        width: 52,
        height: 52,
        borderRadius: 16,
        background: 'rgba(216, 83, 96, 0.12)',
        border: '1px solid rgba(216, 83, 96, 0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <AlertCircle size={24} color="#D85360" />
      </div>
      <p style={{ fontSize: 15, fontWeight: 600, color: T.text }}>{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            padding: '9px 20px',
            borderRadius: 999,
            background: 'rgba(255,255,255,0.1)',
            border: `1px solid ${T.standardBorder}`,
            color: T.text,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      )}
    </div>
  );
}
