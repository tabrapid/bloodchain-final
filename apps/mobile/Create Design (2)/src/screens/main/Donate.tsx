import { Droplet, Award, Users, ChevronRight, MapPin, Clock } from 'lucide-react';
import GlassCard from '../../components/GlassCard';
import GradientCard from '../../components/GradientCard';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import SectionHeader from '../../components/SectionHeader';
import { useNav, useTheme } from '../../context';
import { DARK, LIGHT } from '../../types';

const CAMPAIGNS = [
  { org: 'Turkish Red Crescent', need: 'O+ urgent', until: 'Sep 5', distance: '1.2 km', tag: 'danger' as const },
  { org: 'Acıbadem Hospital', need: 'Platelets', until: 'Sep 10', distance: '3.4 km', tag: 'warning' as const },
  { org: 'Florence Nightingale', need: 'Plasma', until: 'Sep 15', distance: '5.1 km', tag: 'secondary' as const },
];

export default function Donate() {
  const { navigate } = useNav();
  const { theme } = useTheme();
  const T = theme === 'dark' ? DARK : LIGHT;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '8px 20px 20px' }}>
        <h1 style={{ fontSize: 27, fontWeight: 700, color: T.text, letterSpacing: '-0.03em' }}>Donate</h1>
        <p style={{ fontSize: 13, color: T.textMuted, marginTop: 2 }}>Schedule your next donation</p>
      </div>

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 110 }}>

        {/* Eligibility + CTA */}
        <GradientCard gradient="linear-gradient(135deg, #D85360 0%, #7B3266 100%)">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <Badge color="success" style={{ marginBottom: 10 }}>Eligible to donate</Badge>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', lineHeight: 1.2, letterSpacing: '-0.02em' }}>
                Ready for your<br />next donation?
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 6 }}>
                <Clock size={11} style={{ display: 'inline', marginRight: 4 }} />
                Last donated 57 days ago
              </div>
            </div>
            <Droplet size={36} color="#fff" fill="rgba(255,255,255,0.3)" strokeWidth={1.5} />
          </div>
          <Button
            style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.3)' }}
            onClick={() => navigate('booking')}
            fullWidth
          >
            Schedule a Donation
          </Button>
        </GradientCard>

        {/* Donation types */}
        <div>
          <SectionHeader label="Donation Types" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { name: 'Whole Blood', freq: 'Every 56 days', color: '#D85360', icon: '🩸' },
              { name: 'Plasma', freq: 'Every 28 days', color: '#68B7D1', icon: '💉' },
              { name: 'Platelets', freq: 'Every 7 days', color: '#E5B86D', icon: '🔬' },
              { name: 'Double Red', freq: 'Every 112 days', color: '#8E82DF', icon: '🩺' },
            ].map((t) => (
              <GlassCard key={t.name} padding={14} onClick={() => navigate('booking')} style={{ cursor: 'pointer' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>{t.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{t.name}</div>
                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{t.freq}</div>
              </GlassCard>
            ))}
          </div>
        </div>

        {/* Active Campaigns */}
        <div>
          <SectionHeader label="Active Campaigns" action={{ label: 'See all', onClick: () => navigate('campaigns') }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {CAMPAIGNS.map((c) => (
              <GlassCard key={c.org} padding="12px 14px" onClick={() => navigate('booking')}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{c.org}</span>
                      <Badge color={c.tag}>{c.need}</Badge>
                    </div>
                    <div style={{ display: 'flex', gap: 12, fontSize: 11, color: T.textMuted }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Clock size={10} /> Until {c.until}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <MapPin size={10} /> {c.distance}
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={14} color={T.textMuted} />
                </div>
              </GlassCard>
            ))}
          </div>
        </div>

        {/* Challenges */}
        <div>
          <SectionHeader label="Challenges" action={{ label: 'View all', onClick: () => navigate('challenges') }} />
          <GlassCard>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(229, 184, 109, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Award size={22} color="#E5B86D" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Summer Donor Challenge</div>
                <div style={{ fontSize: 12, color: T.textMuted }}>Donate 3 times before Sep 30</div>
                <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                    <div style={{ width: '66%', height: '100%', background: '#E5B86D', borderRadius: 999 }} />
                  </div>
                  <span style={{ fontSize: 11, color: '#E5B86D', fontWeight: 600 }}>2/3</span>
                </div>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Stats row */}
        <div>
          <SectionHeader label="Community Impact" />
          <GlassCard>
            <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
              <div>
                <div style={{ fontSize: 24, fontWeight: 700, color: T.text }}>2,847</div>
                <div style={{ fontSize: 11, color: T.textMuted }}>Donors this month</div>
              </div>
              <div style={{ width: 1, background: 'rgba(255,255,255,0.08)' }} />
              <div>
                <div style={{ fontSize: 24, fontWeight: 700, color: T.text }}>8,541</div>
                <div style={{ fontSize: 11, color: T.textMuted }}>Lives saved</div>
              </div>
              <div style={{ width: 1, background: 'rgba(255,255,255,0.08)' }} />
              <div>
                <div style={{ fontSize: 24, fontWeight: 700, color: T.text }}>127</div>
                <div style={{ fontSize: 11, color: T.textMuted }}>Active drives</div>
              </div>
            </div>
          </GlassCard>
        </div>

      </div>
    </div>
  );
}
