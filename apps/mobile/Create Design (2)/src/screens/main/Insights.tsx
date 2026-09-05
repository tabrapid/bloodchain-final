import { ArrowLeft, Zap, TrendingUp, Brain, Lightbulb } from 'lucide-react';
import GlassCard from '../../components/GlassCard';
import Badge from '../../components/Badge';
import SectionHeader from '../../components/SectionHeader';
import { useNav, useTheme } from '../../context';
import { DARK, LIGHT } from '../../types';

const INSIGHTS = [
  {
    id: 1,
    title: 'Iron levels trending low',
    body: 'Your iron panel from Aug 15 shows borderline ferritin levels. Incorporate spinach, lentils, and lean red meat into your diet at least 3 days before your Sep 3 appointment.',
    category: 'Nutrition',
    confidence: 94,
    icon: Lightbulb,
  },
  {
    id: 2,
    title: 'Optimal donation window',
    body: 'Based on your donation history and recovery metrics, you are at peak hemoglobin levels right now. Your body is ready — this is the best time to donate.',
    category: 'Timing',
    confidence: 88,
    icon: TrendingUp,
  },
  {
    id: 3,
    title: 'Heart rate improving',
    body: 'Your resting heart rate has dropped 4 bpm over the past 30 days, indicating improved cardiovascular health. Regular donations may be contributing to this positive trend.',
    category: 'Cardiovascular',
    confidence: 82,
    icon: Brain,
  },
  {
    id: 4,
    title: 'Hydration recommendation',
    body: 'Drink at least 500mL of water in the 2 hours before your next donation. Your recent check-in data suggests below-average pre-donation hydration.',
    category: 'Preparation',
    confidence: 91,
    icon: Zap,
  },
];

export default function Insights() {
  const { back } = useNav();
  const { theme } = useTheme();
  const T = theme === 'dark' ? DARK : LIGHT;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Header with purple AI tint */}
      <div style={{
        background: 'linear-gradient(180deg, rgba(142, 130, 223, 0.2) 0%, transparent 100%)',
        padding: '8px 20px 24px',
      }}>
        <button
          onClick={back}
          style={{ background: 'none', display: 'flex', alignItems: 'center', gap: 6, color: '#8E82DF', fontSize: 14, fontWeight: 600, marginBottom: 16 }}
        >
          <ArrowLeft size={16} /> Back
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            background: 'rgba(142, 130, 223, 0.2)',
            border: '1px solid rgba(142, 130, 223, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Brain size={22} color="#8E82DF" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: T.text, letterSpacing: '-0.02em' }}>AI Insights</h1>
              <Badge color="ai">Powered by AI</Badge>
            </div>
            <p style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>Personalized health recommendations</p>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 32 }}>

        <SectionHeader label="Your insights · Updated today" />

        {INSIGHTS.map((ins) => {
          const Icon = ins.icon;
          return (
            <GlassCard key={ins.id} style={{ borderColor: 'rgba(142, 130, 223, 0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: 'rgba(142, 130, 223, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Icon size={18} color="#8E82DF" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{ins.title}</span>
                  </div>
                  <Badge color="ai" style={{ marginBottom: 8 }}>{ins.category}</Badge>
                </div>
              </div>
              <p style={{ fontSize: 13, color: T.text, lineHeight: 1.6 }}>{ins.body}</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginTop: 12, gap: 6 }}>
                <div style={{ flex: 1, height: 3, borderRadius: 999, background: 'rgba(142, 130, 223, 0.1)', overflow: 'hidden' }}>
                  <div style={{ width: `${ins.confidence}%`, height: '100%', background: '#8E82DF', borderRadius: 999 }} />
                </div>
                <span style={{ fontSize: 11, color: '#8E82DF', fontWeight: 600 }}>{ins.confidence}% confidence</span>
              </div>
            </GlassCard>
          );
        })}

        <p style={{ fontSize: 11, color: T.textMuted, textAlign: 'center', lineHeight: 1.5, padding: '8px 16px' }}>
          AI insights are generated from your health data and donation history. They are not medical advice. Always consult your doctor.
        </p>
      </div>
    </div>
  );
}
