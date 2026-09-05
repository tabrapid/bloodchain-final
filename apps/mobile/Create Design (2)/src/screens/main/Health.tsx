import { Heart, Activity, Thermometer, Wind, TrendingUp, ChevronRight, Zap } from 'lucide-react';
import GlassCard from '../../components/GlassCard';
import GradientCard from '../../components/GradientCard';
import Badge from '../../components/Badge';
import SectionHeader from '../../components/SectionHeader';
import { useNav, useTheme } from '../../context';
import { DARK, LIGHT } from '../../types';

function VitalRow({ icon, label, value, unit, color, status }: {
  icon: React.ReactNode; label: string; value: string; unit: string; color: string; status?: string
}) {
  const { theme } = useTheme();
  const T = theme === 'dark' ? DARK : LIGHT;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, color: T.textMuted }}>{label}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginTop: 1 }}>
          <span style={{ fontSize: 22, fontWeight: 700, color: T.text, letterSpacing: '-0.02em' }}>{value}</span>
          <span style={{ fontSize: 12, color: T.textMuted }}>{unit}</span>
        </div>
      </div>
      {status && <Badge color={status === 'Normal' ? 'success' : 'warning'}>{status}</Badge>}
    </div>
  );
}

export default function Health() {
  const { navigate } = useNav();
  const { theme } = useTheme();
  const T = theme === 'dark' ? DARK : LIGHT;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Header */}
      <div style={{ padding: '8px 20px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 27, fontWeight: 700, color: T.text, letterSpacing: '-0.03em' }}>Health</h1>
          <p style={{ fontSize: 13, color: T.textMuted, marginTop: 2 }}>Your vitals overview</p>
        </div>
        <Badge color="success">All Normal</Badge>
      </div>

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 110 }}>

        {/* Heart Rate Hero */}
        <GradientCard gradient="linear-gradient(135deg, #D85360 0%, #C83B6C 100%)">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Heart Rate</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
                <span style={{ fontSize: 52, fontWeight: 800, color: '#fff', letterSpacing: '-0.04em' }}>72</span>
                <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.7)' }}>bpm</span>
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>Normal resting rate</div>
            </div>
            <Heart size={28} color="#fff" fill="rgba(255,255,255,0.3)" />
          </div>
          {/* Mini sparkline */}
          <svg width="100%" height="40" viewBox="0 0 280 40" preserveAspectRatio="none">
            <polyline
              points="0,35 25,28 50,32 75,18 100,22 125,14 150,20 175,10 200,16 225,8 250,14 280,10"
              fill="none"
              stroke="rgba(255,255,255,0.4)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Min 62</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Max 88</span>
          </div>
        </GradientCard>

        {/* Vitals grid */}
        <div>
          <SectionHeader label="Vitals" action={{ label: 'Trends', onClick: () => navigate('health-trends') }} />
          <GlassCard>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <VitalRow icon={<Activity size={18} color="#68B7D1" />} label="Blood Pressure" value="118/76" unit="mmHg" color="#68B7D1" status="Normal" />
              <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
              <VitalRow icon={<Wind size={18} color="#63C29B" />} label="Oxygen Saturation" value="98" unit="%" color="#63C29B" status="Normal" />
              <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
              <VitalRow icon={<Thermometer size={18} color="#E5B86D" />} label="Body Temperature" value="36.6" unit="°C" color="#E5B86D" status="Normal" />
              <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
              <VitalRow icon={<TrendingUp size={18} color="#8E82DF" />} label="Hemoglobin" value="14.2" unit="g/dL" color="#8E82DF" status="Normal" />
            </div>
          </GlassCard>
        </div>

        {/* AI Insights */}
        <div>
          <SectionHeader label="AI Insights" action={{ label: 'View all', onClick: () => navigate('insights') }} />
          <GlassCard style={{ borderColor: 'rgba(142, 130, 223, 0.25)' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'rgba(142, 130, 223, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Zap size={16} color="#8E82DF" />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#8E82DF', marginBottom: 4 }}>Personalized insight</div>
                <div style={{ fontSize: 13, color: T.text, lineHeight: 1.5 }}>
                  Your iron levels are trending slightly low. Consider iron-rich foods before your next donation on Sep 3.
                </div>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Lab Results */}
        <div>
          <SectionHeader label="Lab Results" action={{ label: 'View all', onClick: () => navigate('laboratory') }} />
          {[
            { test: 'Complete Blood Count', date: 'Aug 15, 2026', status: 'success' as const },
            { test: 'Iron Panel', date: 'Aug 15, 2026', status: 'warning' as const },
          ].map((r) => (
            <GlassCard key={r.test} padding="12px 14px" style={{ marginBottom: 8 }} onClick={() => navigate('laboratory')}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: T.text }}>{r.test}</div>
                  <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>{r.date}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Badge color={r.status}>{r.status === 'success' ? 'Normal' : 'Review'}</Badge>
                  <ChevronRight size={14} color={T.textMuted} />
                </div>
              </div>
            </GlassCard>
          ))}
        </div>

      </div>
    </div>
  );
}
