import { AlertTriangle, MapPin, Clock, Phone, ArrowLeft } from 'lucide-react';
import GlassCard from '../../components/GlassCard';
import Button from '../../components/Button';
import Badge from '../../components/Badge';
import { useNav, useTheme } from '../../context';
import { DARK, LIGHT } from '../../types';

const REQUESTS = [
  { id: 1, hospital: 'Göztepe Training Hospital', bloodType: 'O+', units: 3, urgency: 'Critical', timeLeft: '2h', distance: '0.8 km', patient: 'Surgery patient' },
  { id: 2, hospital: 'Haydarpaşa Numune', bloodType: 'O+', units: 2, urgency: 'Urgent', timeLeft: '4h', distance: '1.5 km', patient: 'Accident victim' },
  { id: 3, hospital: 'Siyami Ersek Hospital', bloodType: 'O+', units: 1, urgency: 'Urgent', timeLeft: '8h', distance: '2.3 km', patient: 'Cardiac surgery' },
];

export default function SOS() {
  const { back } = useNav();
  const { theme } = useTheme();
  const T = theme === 'dark' ? DARK : LIGHT;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      {/* Red gradient header */}
      <div style={{
        background: 'linear-gradient(180deg, rgba(216, 83, 96, 0.35) 0%, transparent 100%)',
        padding: '8px 20px 28px',
      }}>
        <button
          onClick={back}
          style={{ background: 'none', display: 'flex', alignItems: 'center', gap: 6, color: '#D85360', fontSize: 14, fontWeight: 600, marginBottom: 20 }}
        >
          <ArrowLeft size={16} /> Back
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ position: 'relative' }}>
            <div style={{
              position: 'absolute',
              inset: -8,
              borderRadius: '50%',
              border: '2px solid rgba(216, 83, 96, 0.4)',
              animation: 'pulse-ring 2s ease-out infinite',
            }} />
            <div style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: '#D85360',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(216, 83, 96, 0.5)',
            }}>
              <AlertTriangle size={26} color="#fff" />
            </div>
          </div>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: T.text, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              SOS Emergency
            </h1>
            <p style={{ fontSize: 13, color: T.textMuted, marginTop: 2 }}>
              3 urgent O+ requests near you
            </p>
          </div>
        </div>

        {/* Your blood type */}
        <GlassCard danger style={{ marginTop: 16 }} padding={12}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#D85360' }}>O+</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Your blood type matches</div>
              <div style={{ fontSize: 12, color: T.textMuted }}>You can donate to these patients</div>
            </div>
            <Badge color="danger" style={{ marginLeft: 'auto' }}>Eligible</Badge>
          </div>
        </GlassCard>
      </div>

      {/* Requests */}
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 32 }}>
        {REQUESTS.map((req, i) => (
          <GlassCard key={req.id} danger={req.urgency === 'Critical'} elevated={req.urgency !== 'Critical'}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 28, fontWeight: 800, color: '#D85360', letterSpacing: '-0.03em' }}>{req.bloodType}</span>
                  <Badge color={req.urgency === 'Critical' ? 'danger' : 'warning'}>{req.urgency}</Badge>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{req.hospital}</div>
                <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>{req.patient}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, color: T.textMuted, display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'flex-end' }}>
                  <MapPin size={11} /> {req.distance}
                </div>
                <div style={{ fontSize: 12, color: '#D85360', display: 'flex', alignItems: 'center', gap: 3, marginTop: 3, fontWeight: 600 }}>
                  <Clock size={11} /> {req.timeLeft} left
                </div>
                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 3 }}>{req.units} units needed</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="danger" size="sm" style={{ flex: 1 }} onClick={() => {}}>
                Respond Now
              </Button>
              <button style={{
                width: 36,
                height: 32,
                borderRadius: 999,
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}>
                <Phone size={14} color={T.text} />
              </button>
            </div>
          </GlassCard>
        ))}

        {/* Info */}
        <GlassCard padding={12}>
          <p style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.55, textAlign: 'center' }}>
            Responding commits you to donate within the stated timeframe. The hospital will confirm your appointment immediately.
          </p>
        </GlassCard>
      </div>
    </div>
  );
}
