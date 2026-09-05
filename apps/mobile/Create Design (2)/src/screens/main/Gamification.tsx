import { ArrowLeft, Zap, Award, Star, Trophy } from 'lucide-react';
import GlassCard from '../../components/GlassCard';
import GradientCard from '../../components/GradientCard';
import ProgressBar from '../../components/ProgressBar';
import Badge from '../../components/Badge';
import SectionHeader from '../../components/SectionHeader';
import { useNav, useTheme } from '../../context';
import { DARK, LIGHT } from '../../types';

const BADGES = [
  { emoji: '🩸', name: 'First Drop', earned: true },
  { emoji: '💪', name: 'Iron Will', earned: true },
  { emoji: '⭐', name: 'Star Donor', earned: true },
  { emoji: '🏆', name: 'Champion', earned: true },
  { emoji: '🌟', name: 'Lifesaver', earned: true },
  { emoji: '❤️', name: 'Hero', earned: true },
  { emoji: '🔬', name: 'Lab Ready', earned: true },
  { emoji: '🎯', name: 'Streak Pro', earned: false },
  { emoji: '💎', name: 'Diamond', earned: false },
  { emoji: '🦁', name: 'Legend', earned: false },
  { emoji: '🌈', name: 'All Types', earned: false },
  { emoji: '🚀', name: 'Launchpad', earned: false },
];

const CHALLENGES = [
  { name: 'Summer Challenge', desc: 'Donate 3× before Sep 30', progress: 66, reward: '500 XP', color: '#E5B86D' },
  { name: '10-Streak', desc: 'Donate 10 times total', progress: 100, reward: '1000 XP', color: '#63C29B' },
  { name: 'Community Hero', desc: 'Respond to 5 SOS requests', progress: 40, reward: '750 XP', color: '#D85360' },
];

export default function Gamification() {
  const { back, navigate } = useNav();
  const { theme } = useTheme();
  const T = theme === 'dark' ? DARK : LIGHT;

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
        <h1 style={{ fontSize: 27, fontWeight: 700, color: T.text, letterSpacing: '-0.03em' }}>Achievements</h1>
        <p style={{ fontSize: 13, color: T.textMuted, marginTop: 2 }}>Your progress & rewards</p>
      </div>

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 32 }}>

        {/* XP Level Card */}
        <GradientCard gradient="linear-gradient(135deg, #E5B86D 0%, #D4A043 100%)">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Level</div>
              <div style={{ fontSize: 52, fontWeight: 800, color: '#fff', letterSpacing: '-0.04em', lineHeight: 1 }}>8</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>Senior Donor</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <Zap size={32} color="rgba(255,255,255,0.8)" />
              <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginTop: 4 }}>2400</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>XP points</div>
            </div>
          </div>
          <div style={{ marginBottom: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>Progress to Level 9</span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.9)', fontWeight: 700 }}>2400 / 3000</span>
            </div>
            <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.2)', overflow: 'hidden' }}>
              <div style={{ width: '80%', height: '100%', borderRadius: 999, background: 'rgba(255,255,255,0.85)' }} />
            </div>
          </div>
        </GradientCard>

        {/* Quick stats */}
        <div style={{ display: 'flex', gap: 10 }}>
          <GlassCard padding={14} style={{ flex: 1, textAlign: 'center' }}>
            <Trophy size={20} color="#E5B86D" style={{ margin: '0 auto 6px' }} />
            <div style={{ fontSize: 22, fontWeight: 700, color: T.text }}>7</div>
            <div style={{ fontSize: 11, color: T.textMuted }}>Badges earned</div>
          </GlassCard>
          <GlassCard padding={14} style={{ flex: 1, textAlign: 'center' }}>
            <Star size={20} color="#8E82DF" style={{ margin: '0 auto 6px' }} />
            <div style={{ fontSize: 22, fontWeight: 700, color: T.text }}>#14</div>
            <div style={{ fontSize: 11, color: T.textMuted }}>Rank this month</div>
          </GlassCard>
          <GlassCard padding={14} style={{ flex: 1, textAlign: 'center' }}>
            <Award size={20} color="#63C29B" style={{ margin: '0 auto 6px' }} />
            <div style={{ fontSize: 22, fontWeight: 700, color: T.text }}>3</div>
            <div style={{ fontSize: 11, color: T.textMuted }}>Challenges active</div>
          </GlassCard>
        </div>

        {/* Badges grid */}
        <div>
          <SectionHeader label="Badges" action={{ label: 'View all', onClick: () => {} }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {BADGES.map((b) => (
              <GlassCard key={b.name} padding={10} style={{ textAlign: 'center', opacity: b.earned ? 1 : 0.35 }}>
                <div style={{ fontSize: 28, marginBottom: 4 }}>{b.emoji}</div>
                <div style={{ fontSize: 9, fontWeight: 600, color: T.textMuted, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{b.name}</div>
              </GlassCard>
            ))}
          </div>
        </div>

        {/* Challenges */}
        <div>
          <SectionHeader label="Active Challenges" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {CHALLENGES.map((c) => (
              <GlassCard key={c.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>{c.desc}</div>
                  </div>
                  <Badge color={c.progress === 100 ? 'success' : 'default'}>{c.reward}</Badge>
                </div>
                <ProgressBar value={c.progress} color={c.color} />
                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 6, textAlign: 'right' }}>{c.progress}%</div>
              </GlassCard>
            ))}
          </div>
        </div>

        {/* Leaderboard link */}
        <GlassCard tier="elevated" onClick={() => navigate('leaderboard')} style={{ cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(142, 130, 223, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Trophy size={20} color="#8E82DF" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>Monthly Leaderboard</div>
              <div style={{ fontSize: 12, color: T.textMuted }}>You are ranked #14 this month</div>
            </div>
          </div>
        </GlassCard>

      </div>
    </div>
  );
}
