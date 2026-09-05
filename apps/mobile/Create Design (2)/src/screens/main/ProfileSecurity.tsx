import { ArrowLeft, Shield, Smartphone, Key, ChevronRight } from 'lucide-react';
import GlassCard from '../../components/GlassCard';
import Badge from '../../components/Badge';
import SectionHeader from '../../components/SectionHeader';
import { useNav, useTheme } from '../../context';
import { DARK, LIGHT } from '../../types';

export default function ProfileSecurity() {
  const { back } = useNav();
  const { theme } = useTheme();
  const T = theme === 'dark' ? DARK : LIGHT;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <div style={{ padding: '8px 20px 20px' }}>
        <button onClick={back} style={{ background: 'none', display: 'flex', alignItems: 'center', gap: 6, color: '#D85360', fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1 style={{ fontSize: 27, fontWeight: 700, color: T.text, letterSpacing: '-0.03em' }}>Security</h1>
        <p style={{ fontSize: 13, color: T.textMuted, marginTop: 2 }}>Account security settings</p>
      </div>

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 32 }}>

        <div>
          <SectionHeader label="Authentication" />
          <GlassCard>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {[
                { icon: Key, label: 'Change password', sub: 'Last changed 3 months ago', badge: null },
                { icon: Smartphone, label: 'Two-factor authentication', sub: 'Authenticator app enabled', badge: 'On' },
                { icon: Shield, label: 'Biometric login', sub: 'Face ID / Touch ID', badge: 'On' },
              ].map((r, i) => {
                const Icon = r.icon;
                return (
                  <div key={r.label}>
                    {i > 0 && <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', marginBottom: 18 }} />}
                    <button style={{ background: 'none', display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left' }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(99, 194, 155, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon size={16} color="#63C29B" />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, color: T.text }}>{r.label}</div>
                        <div style={{ fontSize: 12, color: T.textMuted, marginTop: 1 }}>{r.sub}</div>
                      </div>
                      {r.badge && <Badge color="success">{r.badge}</Badge>}
                      <ChevronRight size={16} color={T.textMuted} />
                    </button>
                  </div>
                );
              })}
            </div>
          </GlassCard>
        </div>

        <div>
          <SectionHeader label="Active Sessions" />
          <GlassCard>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { device: 'iPhone 15 Pro', location: 'Istanbul, TR', current: true, time: 'Active now' },
                { device: 'MacBook Pro', location: 'Istanbul, TR', current: false, time: '2 hours ago' },
              ].map((s) => (
                <div key={s.device} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Smartphone size={16} color={T.textMuted} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{s.device}</span>
                      {s.current && <Badge color="success">Current</Badge>}
                    </div>
                    <div style={{ fontSize: 11, color: T.textMuted }}>{s.location} · {s.time}</div>
                  </div>
                  {!s.current && (
                    <button style={{ background: 'none', fontSize: 12, color: '#D85360' }}>Revoke</button>
                  )}
                </div>
              ))}
            </div>
          </GlassCard>
        </div>

      </div>
    </div>
  );
}
