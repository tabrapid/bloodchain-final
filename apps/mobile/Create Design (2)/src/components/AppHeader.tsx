import type { ReactNode } from 'react';
import { useTheme } from '../context';
import { DARK, LIGHT, TYPE } from '../types';

interface Props {
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
}

/** Standard in-app screen header — title + optional subtitle + trailing slot. */
export default function AppHeader({ title, subtitle, trailing }: Props) {
  const { theme } = useTheme();
  const T = theme === 'dark' ? DARK : LIGHT;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      padding: '8px 20px 20px',
    }}>
      <div>
        <h1 style={{
          ...TYPE.screenTitle,
          color: T.text,
          margin: 0,
          lineHeight: 1.1,
        }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ fontSize: 13, color: T.textMuted, marginTop: 3 }}>{subtitle}</p>
        )}
      </div>
      {trailing && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 4 }}>
          {trailing}
        </div>
      )}
    </div>
  );
}
