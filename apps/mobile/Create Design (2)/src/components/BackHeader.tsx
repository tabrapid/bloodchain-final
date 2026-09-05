import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useNav, useTheme } from '../context';
import { DARK, LIGHT, TYPE } from '../types';

interface Props {
  title?: string;
  trailing?: ReactNode;
  onBack?: () => void;
}

/** Header for detail / sub-screens with a back affordance. */
export default function BackHeader({ title, trailing, onBack }: Props) {
  const { back } = useNav();
  const { theme } = useTheme();
  const T = theme === 'dark' ? DARK : LIGHT;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      padding: '8px 16px 16px',
      minHeight: 52,
    }}>
      {/* Back button — 44×44 touch target */}
      <button
        onClick={onBack ?? back}
        aria-label="Go back"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          minWidth: 44,
          minHeight: 44,
          padding: '0 6px 0 0',
          background: 'none',
          color: '#D85360',
          fontSize: 15,
          fontWeight: 600,
        }}
      >
        <ChevronLeft size={22} strokeWidth={2.5} aria-hidden="true" />
        Back
      </button>

      {title && (
        <h1 style={{
          flex: 1,
          textAlign: 'center',
          fontSize: 17,
          fontWeight: 700,
          color: T.text,
          letterSpacing: -0.3,
          margin: 0,
        }}>
          {title}
        </h1>
      )}

      {trailing ? (
        <div style={{ minWidth: 44, display: 'flex', justifyContent: 'flex-end' }}>
          {trailing}
        </div>
      ) : (
        /* Balance the back button so the title stays centred */
        <div style={{ minWidth: 52 }} />
      )}
    </div>
  );
}
