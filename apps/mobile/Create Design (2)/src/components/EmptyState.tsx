import type { ReactNode } from 'react';
import { useTheme } from '../context';
import { DARK, LIGHT } from '../types';

interface Props {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: { label: string; onClick: () => void };
}

/** Neutral empty-state pattern. Copy must be factual, never guilt-inducing. */
export default function EmptyState({ icon, title, body, action }: Props) {
  const { theme } = useTheme();
  const T = theme === 'dark' ? DARK : LIGHT;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: '48px 32px',
      gap: 12,
    }}>
      {icon && (
        <div style={{
          width: 64,
          height: 64,
          borderRadius: 20,
          background: 'rgba(255,255,255,0.07)',
          border: `1px solid ${T.standardBorder}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 4,
          opacity: 0.6,
        }}>
          {icon}
        </div>
      )}
      <p style={{ fontSize: 16, fontWeight: 600, color: T.text }}>{title}</p>
      {body && (
        <p style={{ fontSize: 14, color: T.textMuted, lineHeight: 1.55, maxWidth: 260 }}>{body}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          style={{
            marginTop: 8,
            padding: '10px 22px',
            borderRadius: 999,
            background: '#D85360',
            color: '#fff',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(216,83,96,0.35)',
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
