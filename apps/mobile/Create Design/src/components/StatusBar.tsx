import { Signal, Wifi, Battery } from 'lucide-react';
import { useTheme } from '../context';
import { DARK, LIGHT } from '../types';

export default function StatusBar() {
  const { theme } = useTheme();
  const T = theme === 'dark' ? DARK : LIGHT;

  const now = new Date();
  const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '14px 20px 6px',
      flexShrink: 0,
    }}>
      <span style={{ fontSize: 15, fontWeight: 700, color: T.text, letterSpacing: '-0.02em' }}>{time}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: T.text }}>
        <Signal size={14} strokeWidth={2} />
        <Wifi size={14} strokeWidth={2} />
        <Battery size={14} strokeWidth={2} />
      </div>
    </div>
  );
}
