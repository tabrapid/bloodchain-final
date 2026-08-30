import { ArrowLeft, MapPin, Droplet } from 'lucide-react';
import GlassCard from '../../components/GlassCard';
import Badge from '../../components/Badge';
import SectionHeader from '../../components/SectionHeader';
import { useNav, useTheme } from '../../context';
import { DARK, LIGHT } from '../../types';

const DONATIONS = [
  { id: 1, type: 'Whole Blood', date: 'Jul 5, 2026', org: 'Acıbadem Blood Center, Kadıköy', volume: '450mL', tag: 'success' as const },
  { id: 2, type: 'Plasma', date: 'May 2, 2026', org: 'Turkish Red Crescent, Üsküdar', volume: '600mL', tag: 'secondary' as const },
  { id: 3, type: 'Whole Blood', date: 'Mar 7, 2026', org: 'Göztepe Training Hospital', volume: '450mL', tag: 'success' as const },
  { id: 4, type: 'Platelets', date: 'Jan 14, 2026', org: 'Acıbadem Blood Center, Kadıköy', volume: '200mL', tag: 'warning' as const },
  { id: 5, type: 'Whole Blood', date: 'Nov 22, 2025', org: 'Florence Nightingale Clinic', volume: '450mL', tag: 'success' as const },
  { id: 6, type: 'Plasma', date: 'Sep 30, 2025', org: 'Haydarpaşa Numune Hospital', volume: '600mL', tag: 'secondary' as const },
  { id: 7, type: 'Whole Blood', date: 'Jul 18, 2025', org: 'Acıbadem Blood Center, Kadıköy', volume: '450mL', tag: 'success' as const },
  { id: 8, type: 'Whole Blood', date: 'May 2, 2025', org: 'Göztepe Training Hospital', volume: '450mL', tag: 'success' as const },
];

export default function DonationHistory() {
  const { back } = useNav();
  const { theme } = useTheme();
  const T = theme === 'dark' ? DARK : LIGHT;

  const totalVolume = '5.4L';
  const totalLives = 36;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '8px 20px 16px' }}>
        <button
          onClick={back}
          style={{ background: 'none', display: 'flex', alignItems: 'center', gap: 6, color: '#D85360', fontSize: 14, fontWeight: 600, marginBottom: 16 }}
        >
          <ArrowLeft size={16} /> Back
        </button>
        <h1 style={{ fontSize: 27, fontWeight: 700, color: T.text, letterSpacing: '-0.03em' }}>Donation History</h1>
        <p style={{ fontSize: 13, color: T.textMuted, marginTop: 2 }}>All your previous donations</p>
      </div>

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 32 }}>

        {/* Summary */}
        <div style={{ display: 'flex', gap: 10 }}>
          <GlassCard padding={14} style={{ flex: 1, textAlign: 'center' }} elevated>
            <div style={{ fontSize: 28, fontWeight: 800, color: T.text, letterSpacing: '-0.03em' }}>12</div>
            <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>Total donations</div>
          </GlassCard>
          <GlassCard padding={14} style={{ flex: 1, textAlign: 'center' }} elevated>
            <div style={{ fontSize: 28, fontWeight: 800, color: T.text, letterSpacing: '-0.03em' }}>{totalVolume}</div>
            <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>Volume donated</div>
          </GlassCard>
          <GlassCard padding={14} style={{ flex: 1, textAlign: 'center' }} elevated>
            <div style={{ fontSize: 28, fontWeight: 800, color: T.text, letterSpacing: '-0.03em' }}>{totalLives}</div>
            <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>Lives helped</div>
          </GlassCard>
        </div>

        <SectionHeader label="History" />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {DONATIONS.map((d) => (
            <GlassCard key={d.id} padding="14px">
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: 'rgba(216, 83, 96, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Droplet size={18} color="#D85360" fill="rgba(216, 83, 96, 0.4)" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{d.type}</span>
                    <Badge color={d.tag}>{d.volume}</Badge>
                  </div>
                  <div style={{ fontSize: 12, color: T.textMuted }}>{d.date}</div>
                  <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
                    <MapPin size={10} /> {d.org}
                  </div>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>
    </div>
  );
}
