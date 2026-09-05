import { ArrowLeft, Clock, MapPin, Phone, Calendar, ChevronRight } from 'lucide-react';
import GlassCard from '../../components/GlassCard';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import { useNav, useTheme } from '../../context';
import { DARK, LIGHT } from '../../types';

export default function AppointmentDetail() {
  const { back } = useNav();
  const { theme } = useTheme();
  const T = theme === 'dark' ? DARK : LIGHT;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <div style={{ padding: '8px 20px 20px' }}>
        <button onClick={back} style={{ background: 'none', display: 'flex', alignItems: 'center', gap: 6, color: '#D85360', fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
          <ArrowLeft size={16} /> Back
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: T.text, letterSpacing: '-0.02em', flex: 1 }}>
            Whole Blood Donation
          </h1>
          <Badge color="success">Confirmed</Badge>
        </div>
      </div>

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 32 }}>

        <GlassCard tier="elevated">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(99, 194, 155, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Calendar size={18} color="#63C29B" />
              </div>
              <div>
                <div style={{ fontSize: 11, color: T.textMuted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Date</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: T.text }}>Tuesday, September 3, 2026</div>
              </div>
            </div>
            <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(104, 183, 209, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Clock size={18} color="#68B7D1" />
              </div>
              <div>
                <div style={{ fontSize: 11, color: T.textMuted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Time</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: T.text }}>10:30 AM — approx. 45 min</div>
              </div>
            </div>
            <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(216, 83, 96, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MapPin size={18} color="#D85360" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: T.textMuted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Location</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: T.text }}>Acıbadem Blood Center</div>
                <div style={{ fontSize: 12, color: T.textMuted }}>Kadıköy, Istanbul · 1.2 km away</div>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Preparation tips */}
        <GlassCard>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 12 }}>Preparation checklist</div>
          {[
            'Drink plenty of water the night before',
            'Eat a healthy meal 2–3 hours before',
            'Avoid alcohol for 24 hours prior',
            'Bring a valid ID document',
            'Wear comfortable, loose clothing',
          ].map((tip, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#63C29B', marginTop: 5, flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.5 }}>{tip}</span>
            </div>
          ))}
        </GlassCard>

        {/* Contact */}
        <GlassCard padding="12px 14px">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(104, 183, 209, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Phone size={16} color="#68B7D1" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>Acıbadem Blood Center</div>
              <div style={{ fontSize: 12, color: T.textMuted }}>+90 216 544 4444</div>
            </div>
            <ChevronRight size={16} color={T.textMuted} />
          </div>
        </GlassCard>

        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="secondary" style={{ flex: 1 }}>Reschedule</Button>
          <Button variant="ghost" style={{ flex: 1, color: '#D85360' }}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}
