import { ChevronRight, Edit2, Bell, Lock, Shield, LogOut, User, Droplet, Award, Zap } from 'lucide-react';
import GlassCard from '../../components/GlassCard';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import SectionHeader from '../../components/SectionHeader';
import Avatar from '../../components/Avatar';
import ProgressBar from '../../components/ProgressBar';
import { useNav, useTheme } from '../../context';
import { DARK, LIGHT } from '../../types';
import type { Screen } from '../../types';

function SettingsRow({ icon, label, subtitle, dest, badge }: {
  icon: React.ReactNode; label: string; subtitle?: string; dest: Screen; badge?: string
}) {
  const { navigate } = useNav();
  const { theme } = useTheme();
  const T = theme === 'dark' ? DARK : LIGHT;
  return (
    <button
      onClick={() => navigate(dest)}
      style={{ background: 'none', display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left' }}
    >
      <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: T.text }}>{label}</div>
        {subtitle && <div style={{ fontSize: 12, color: T.textMuted, marginTop: 1 }}>{subtitle}</div>}
      </div>
      {badge && <Badge color="primary">{badge}</Badge>}
      <ChevronRight size={16} color={T.textMuted} />
    </button>
  );
}

export default function Profile() {
  const { navigate } = useNav();
  const { theme } = useTheme();
  const T = theme === 'dark' ? DARK : LIGHT;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '8px 20px 0' }}>
        <h1 style={{ fontSize: 27, fontWeight: 700, color: T.text, letterSpacing: '-0.03em' }}>Profile</h1>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 110 }}>

        {/* Profile Card */}
        <GlassCard elevated style={{ textAlign: 'center' }}>
          <Avatar name="Alex Johnson" size={72} ring="#D85360" />
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: T.text, letterSpacing: '-0.02em' }}>Alex Johnson</div>
            <div style={{ fontSize: 13, color: T.textMuted, marginTop: 2 }}>alex.johnson@email.com</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 10 }}>
            <Badge color="primary">O+ Blood Type</Badge>
            <Badge color="success">Verified Donor</Badge>
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 20, paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: T.text }}>12</div>
              <div style={{ fontSize: 11, color: T.textMuted }}>Donations</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: T.text }}>36</div>
              <div style={{ fontSize: 11, color: T.textMuted }}>Lives saved</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: T.text }}>2400</div>
              <div style={{ fontSize: 11, color: T.textMuted }}>XP</div>
            </div>
          </div>

          {/* XP bar */}
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: T.textMuted }}>Level 8 → Level 9</span>
              <span style={{ fontSize: 11, color: '#E5B86D', fontWeight: 600 }}>2400 / 3000 XP</span>
            </div>
            <ProgressBar value={80} color="#E5B86D" />
          </div>

          <Button variant="secondary" size="sm" style={{ marginTop: 16 }} onClick={() => navigate('profile-personal')}>
            <Edit2 size={13} /> Edit Profile
          </Button>
        </GlassCard>

        {/* Gamification Teaser */}
        <GlassCard onClick={() => navigate('gamification')} style={{ cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(229, 184, 109, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Award size={22} color="#E5B86D" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>Achievements & Badges</div>
              <div style={{ fontSize: 12, color: T.textMuted }}>7 earned · 3 in progress</div>
            </div>
            <ChevronRight size={16} color={T.textMuted} />
          </div>
        </GlassCard>

        {/* Donor info */}
        <div>
          <SectionHeader label="Donor Info" />
          <GlassCard>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <SettingsRow icon={<Droplet size={16} color="#D85360" />} label="Donor Profile" subtitle="Blood type, eligibility, preferences" dest="profile-donor" />
              <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
              <SettingsRow icon={<User size={16} color={T.textMuted} />} label="Personal Info" subtitle="Name, contact, address" dest="profile-personal" />
            </div>
          </GlassCard>
        </div>

        {/* App settings */}
        <div>
          <SectionHeader label="Settings" />
          <GlassCard>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <SettingsRow icon={<Bell size={16} color={T.textMuted} />} label="Notifications" dest="notifications" badge="3" />
              <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
              <SettingsRow icon={<Lock size={16} color={T.textMuted} />} label="Privacy" dest="profile-privacy" />
              <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
              <SettingsRow icon={<Shield size={16} color={T.textMuted} />} label="Security" dest="profile-security" />
            </div>
          </GlassCard>
        </div>

        {/* Logout */}
        <GlassCard>
          <button
            onClick={() => navigate('welcome')}
            style={{ background: 'none', display: 'flex', alignItems: 'center', gap: 10, color: '#D85360', width: '100%', fontSize: 14, fontWeight: 600 }}
          >
            <LogOut size={18} />
            Sign out
          </button>
        </GlassCard>

      </div>
    </div>
  );
}
