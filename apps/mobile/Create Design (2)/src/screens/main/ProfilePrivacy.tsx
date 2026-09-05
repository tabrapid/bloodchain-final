import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import GlassCard from '../../components/GlassCard';
import SectionHeader from '../../components/SectionHeader';
import { useNav, useTheme } from '../../context';
import { DARK, LIGHT } from '../../types';

function Toggle({ value, onChange, label, desc }: { value: boolean; onChange: (v: boolean) => void; label: string; desc?: string }) {
  const { theme } = useTheme();
  const T = theme === 'dark' ? DARK : LIGHT;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: T.text }}>{label}</div>
        {desc && <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>{desc}</div>}
      </div>
      <button
        onClick={() => onChange(!value)}
        style={{
          width: 44,
          height: 24,
          borderRadius: 999,
          background: value ? '#D85360' : 'rgba(255,255,255,0.15)',
          border: 'none',
          position: 'relative',
          cursor: 'pointer',
          transition: 'background 0.2s',
          flexShrink: 0,
        }}
      >
        <div style={{
          position: 'absolute',
          top: 2,
          left: value ? 22 : 2,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }} />
      </button>
    </div>
  );
}

export default function ProfilePrivacy() {
  const { back } = useNav();
  const { theme } = useTheme();
  const T = theme === 'dark' ? DARK : LIGHT;

  const [settings, setSettings] = useState({
    showProfile: true,
    showDonations: false,
    showLocation: true,
    analyticsSharing: false,
    communityVisible: true,
  });

  const set = (key: keyof typeof settings) => (v: boolean) => setSettings((p) => ({ ...p, [key]: v }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <div style={{ padding: '8px 20px 20px' }}>
        <button onClick={back} style={{ background: 'none', display: 'flex', alignItems: 'center', gap: 6, color: '#D85360', fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1 style={{ fontSize: 27, fontWeight: 700, color: T.text, letterSpacing: '-0.03em' }}>Privacy</h1>
        <p style={{ fontSize: 13, color: T.textMuted, marginTop: 2 }}>Control what others can see</p>
      </div>

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 32 }}>
        <div>
          <SectionHeader label="Profile Visibility" />
          <GlassCard>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <Toggle value={settings.showProfile} onChange={set('showProfile')} label="Public profile" desc="Let other donors find you" />
              <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
              <Toggle value={settings.showDonations} onChange={set('showDonations')} label="Show donation history" desc="Visible in community feed" />
              <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
              <Toggle value={settings.communityVisible} onChange={set('communityVisible')} label="Community leaderboard" desc="Show your rank publicly" />
            </div>
          </GlassCard>
        </div>

        <div>
          <SectionHeader label="Location & Data" />
          <GlassCard>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <Toggle value={settings.showLocation} onChange={set('showLocation')} label="Share location" desc="For SOS area matching" />
              <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
              <Toggle value={settings.analyticsSharing} onChange={set('analyticsSharing')} label="Share anonymized data" desc="Improve AI insights for everyone" />
            </div>
          </GlassCard>
        </div>

        <GlassCard padding="12px 14px">
          <button style={{ background: 'none', width: '100%', textAlign: 'left', fontSize: 14, color: '#D85360', fontWeight: 500 }}>
            Download my data
          </button>
        </GlassCard>
        <GlassCard padding="12px 14px">
          <button style={{ background: 'none', width: '100%', textAlign: 'left', fontSize: 14, color: '#D85360', fontWeight: 500 }}>
            Delete account
          </button>
        </GlassCard>
      </div>
    </div>
  );
}
