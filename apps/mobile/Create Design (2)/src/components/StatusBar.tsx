import { Signal, Wifi, Battery, Sun, Moon } from 'lucide-react';
import { useTheme } from '../context';
import { DARK, LIGHT } from '../types';

export default function StatusBar() {
  const { theme, toggleTheme } = useTheme();
  const T = theme === 'dark' ? DARK : LIGHT;

  const now = new Date();
  const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '14px 22px 6px',
      flexShrink: 0,
    }}>
      {/* Time */}
      <span style={{ fontSize: 15, fontWeight: 700, color: T.text, letterSpacing: '-0.02em' }}>
        {time}
      </span>

      {/* Right cluster: connectivity + theme toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Connectivity icons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, opacity: 0.75 }}>
          <Signal size={13} color={T.text} strokeWidth={2.2} />
          <Wifi size={13} color={T.text} strokeWidth={2.2} />
          <Battery size={13} color={T.text} strokeWidth={2.2} />
        </div>

        {/* Theme toggle — small, unobtrusive, in-status-bar */}
        <button
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          style={{
            width: 26,
            height: 26,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: theme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.07)',
            border: `1px solid ${T.border}`,
            cursor: 'pointer',
          }}
        >
          {theme === 'dark'
            ? <Sun size={13} color={T.text} strokeWidth={2} />
            : <Moon size={13} color={T.text} strokeWidth={2} />
          }
        </button>
      </div>
    </div>
  );
}
