import { Bell, Zap, MapPin, ChevronRight, Clock, Droplet, TrendingUp, Shield } from 'lucide-react';
import GlassCard from '../../components/GlassCard';
import GradientCard from '../../components/GradientCard';
import StatCard from '../../components/StatCard';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import SectionHeader from '../../components/SectionHeader';
import IconButton from '../../components/IconButton';
import ProgressBar from '../../components/ProgressBar';
import Avatar from '../../components/Avatar';
import { useNav, useTheme } from '../../context';
import { DARK, LIGHT } from '../../types';

export default function Home() {
  const { navigate } = useNav();
  const { theme } = useTheme();
  const T = theme === 'dark' ? DARK : LIGHT;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 20px 20px' }}>
        <div>
          <p style={{ fontSize: 12, color: T.textMuted, fontWeight: 500, letterSpacing: '0.02em' }}>
            Saturday, 30 Aug
          </p>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: T.text, letterSpacing: '-0.02em', marginTop: 2 }}>
            Good morning, Alex 👋
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <IconButton
            icon={<Bell size={18} color={T.text} strokeWidth={1.8} />}
            onClick={() => navigate('notifications')}
            badge={3}
          />
          <Avatar name="Alex Johnson" size={40} ring="#D85360" />
        </div>
      </div>

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 110 }}>

        {/* Blood Type Hero Card */}
        <GradientCard gradient="linear-gradient(135deg, #D85360 0%, #8E3A59 45%, #5B3080 100%)">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Droplet size={14} color="rgba(255,255,255,0.7)" fill="rgba(255,255,255,0.5)" />
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Blood Type</span>
              </div>
              <div style={{ fontSize: 64, fontWeight: 800, color: '#fff', letterSpacing: '-0.04em', lineHeight: 1 }}>O+</div>
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Badge color="success">Verified</Badge>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <MapPin size={11} /> Istanbul, Kadıköy
                </span>
              </div>
            </div>
            <div style={{
              width: 60,
              height: 60,
              borderRadius: 18,
              background: 'rgba(255,255,255,0.15)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Shield size={28} color="#fff" strokeWidth={1.5} />
            </div>
          </div>
          <div style={{
            marginTop: 16,
            height: 1,
            background: 'rgba(255,255,255,0.15)',
          }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>12</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>Donations</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>5.4L</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>Total volume</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>36</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>Lives helped</div>
            </div>
          </div>
        </GradientCard>

        {/* Next Appointment */}
        <div>
          <SectionHeader label="Next Appointment" action={{ label: 'View all', onClick: () => navigate('calendar') }} />
          <GlassCard onClick={() => navigate('appointment-detail')} elevated>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: T.text }}>Whole Blood Donation</span>
                  <Badge color="success">Confirmed</Badge>
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <span style={{ fontSize: 12, color: T.textMuted, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={12} /> Tue, 3 Sep · 10:30 AM
                  </span>
                </div>
                <div style={{ marginTop: 4, fontSize: 12, color: T.textMuted, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <MapPin size={12} /> Acıbadem Blood Center
                </div>
              </div>
              <ChevronRight size={18} color={T.textMuted} />
            </div>
          </GlassCard>
        </div>

        {/* Your Overview */}
        <div>
          <SectionHeader label="Your Overview" />
          <div style={{ display: 'flex', gap: 12 }}>
            <StatCard
              icon={<Droplet size={18} color="#D85360" />}
              iconBg="rgba(216, 83, 96, 0.15)"
              value="12"
              label="Donations"
            />
            <StatCard
              icon={<TrendingUp size={18} color="#68B7D1" />}
              iconBg="rgba(104, 183, 209, 0.15)"
              value="5.4"
              unit="L"
              label="Total volume"
            />
            <StatCard
              icon={<Zap size={18} color="#E5B86D" />}
              iconBg="rgba(229, 184, 109, 0.15)"
              value="2400"
              label="XP points"
            />
          </div>
        </div>

        {/* Profile Completion */}
        <div>
          <SectionHeader label="Profile" />
          <GlassCard>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 2 }}>Complete your profile</div>
                <div style={{ fontSize: 12, color: T.textMuted }}>Add medical info to unlock all features</div>
              </div>
              <span style={{
                fontSize: 14,
                fontWeight: 700,
                color: '#63C29B',
                background: 'rgba(99, 194, 155, 0.15)',
                padding: '3px 10px',
                borderRadius: 999,
              }}>78%</span>
            </div>
            <ProgressBar value={78} color="#63C29B" />
          </GlassCard>
        </div>

        {/* Quick Actions */}
        <div>
          <SectionHeader label="Quick Actions" />
          <div style={{ display: 'flex', gap: 10 }}>
            <Button variant="secondary" size="sm" style={{ flex: 1 }} onClick={() => navigate('profile-donor')}>
              Edit Donor Profile
            </Button>
            <Button variant="secondary" size="sm" style={{ flex: 1 }} onClick={() => navigate('profile-personal')}>
              Edit Personal Info
            </Button>
          </div>
        </div>

        {/* Emergency SOS */}
        <GlassCard danger>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#D85360', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#D85360',
                  display: 'inline-block',
                  boxShadow: '0 0 0 3px rgba(216, 83, 96, 0.3)',
                  animation: 'pulse 2s ease-in-out infinite',
                }} />
                Emergency Requests
              </div>
              <div style={{ fontSize: 12, color: T.textMuted }}>3 urgent O+ requests near you</div>
            </div>
            <Button variant="danger" size="sm" onClick={() => navigate('sos')}>
              SOS Area
            </Button>
          </div>
        </GlassCard>

      </div>
    </div>
  );
}
