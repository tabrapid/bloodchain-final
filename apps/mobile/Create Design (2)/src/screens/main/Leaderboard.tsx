import { ArrowLeft, Trophy, Medal } from 'lucide-react';
import GlassCard from '../../components/GlassCard';
import GradientCard from '../../components/GradientCard';
import Avatar from '../../components/Avatar';
import Badge from '../../components/Badge';
import { useNav, useTheme } from '../../context';
import { DARK, LIGHT } from '../../types';

const TOP = [
  { rank: 1, name: 'Elif Taş', xp: 8420, donations: 28, bloodType: 'A+' },
  { rank: 2, name: 'Can Doğan', xp: 7890, donations: 26, bloodType: 'O-' },
  { rank: 3, name: 'Zeynep Ak', xp: 7210, donations: 24, bloodType: 'B+' },
];

const REST = [
  { rank: 4, name: 'Ahmet Kara', xp: 6880, donations: 22 },
  { rank: 5, name: 'Seda Yıldız', xp: 6540, donations: 21 },
  { rank: 6, name: 'Ozan Çelik', xp: 6120, donations: 20 },
  { rank: 7, name: 'Hasan Aydın', xp: 5900, donations: 19 },
  { rank: 8, name: 'Merve Şahin', xp: 5640, donations: 18 },
  { rank: 9, name: 'Burak Uysal', xp: 5380, donations: 17 },
  { rank: 10, name: 'Derya Koç', xp: 5100, donations: 16 },
  { rank: 11, name: 'Fatma Güneş', xp: 4880, donations: 15 },
  { rank: 12, name: 'Serkan Arslan', xp: 4600, donations: 14 },
  { rank: 13, name: 'Aylin Demir', xp: 4350, donations: 13 },
  { rank: 14, name: 'Alex Johnson', xp: 2400, donations: 12, isMe: true },
];

const RANK_COLORS = ['#E5B86D', '#8495A3', '#CD7F32'];
const RANK_GRADIENTS = [
  'linear-gradient(135deg, #E5B86D 0%, #D4A043 100%)',
  'linear-gradient(135deg, #9BA8B2 0%, #7A8B96 100%)',
  'linear-gradient(135deg, #CD7F32 0%, #A6642A 100%)',
];

export default function Leaderboard() {
  const { back } = useNav();
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
        <h1 style={{ fontSize: 27, fontWeight: 700, color: T.text, letterSpacing: '-0.03em' }}>Leaderboard</h1>
        <p style={{ fontSize: 13, color: T.textMuted, marginTop: 2 }}>September 2026</p>
      </div>

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 32 }}>

        {/* Top 3 podium */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, justifyContent: 'center', marginBottom: 4 }}>
          {/* 2nd */}
          <div style={{ textAlign: 'center', flex: 1 }}>
            <Avatar name={TOP[1].name} size={48} ring={RANK_COLORS[1]} />
            <div style={{ fontSize: 11, fontWeight: 600, color: T.text, marginTop: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{TOP[1].name.split(' ')[0]}</div>
            <div style={{ height: 50, background: RANK_GRADIENTS[1], borderRadius: '8px 8px 0 0', marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>2</span>
            </div>
          </div>
          {/* 1st */}
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <Avatar name={TOP[0].name} size={58} ring={RANK_COLORS[0]} />
              <Trophy size={16} color="#E5B86D" style={{ position: 'absolute', top: -4, right: -4, background: '#070B12', borderRadius: '50%', padding: 2 }} />
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.text, marginTop: 6 }}>{TOP[0].name.split(' ')[0]}</div>
            <div style={{ height: 70, background: RANK_GRADIENTS[0], borderRadius: '8px 8px 0 0', marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>1</span>
            </div>
          </div>
          {/* 3rd */}
          <div style={{ textAlign: 'center', flex: 1 }}>
            <Avatar name={TOP[2].name} size={48} ring={RANK_COLORS[2]} />
            <div style={{ fontSize: 11, fontWeight: 600, color: T.text, marginTop: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{TOP[2].name.split(' ')[0]}</div>
            <div style={{ height: 40, background: RANK_GRADIENTS[2], borderRadius: '8px 8px 0 0', marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>3</span>
            </div>
          </div>
        </div>

        {/* Rest of rankings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {REST.map((user) => (
            <GlassCard
              key={user.rank}
              padding="12px 14px"
              tier={(user as any).isMe ? 'elevated' : 'standard'}
              style={(user as any).isMe ? { borderColor: 'rgba(216, 83, 96, 0.35)' } : {}}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{
                  width: 28,
                  fontSize: 14,
                  fontWeight: 700,
                  color: (user as any).isMe ? '#D85360' : T.textMuted,
                  textAlign: 'center',
                }}>#{user.rank}</span>
                <Avatar name={user.name} size={36} ring={(user as any).isMe ? '#D85360' : undefined} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: (user as any).isMe ? 700 : 500, color: T.text }}>{user.name}</span>
                    {(user as any).isMe && <Badge color="primary">You</Badge>}
                  </div>
                  <div style={{ fontSize: 11, color: T.textMuted }}>{user.donations} donations</div>
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: (user as any).isMe ? '#D85360' : T.text }}>{user.xp.toLocaleString()} XP</span>
              </div>
            </GlassCard>
          ))}
        </div>

      </div>
    </div>
  );
}
