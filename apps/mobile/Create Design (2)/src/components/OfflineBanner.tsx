import { WifiOff } from 'lucide-react';

/** Subtle top banner shown when the device is offline. */
export default function OfflineBanner({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: '7px 16px',
        background: 'rgba(229, 184, 109, 0.18)',
        borderBottom: '1px solid rgba(229, 184, 109, 0.3)',
        fontSize: 12,
        fontWeight: 600,
        color: '#E5B86D',
        letterSpacing: '0.01em',
      }}
    >
      <WifiOff size={13} aria-hidden="true" />
      You are offline. Showing cached content.
    </div>
  );
}
