import { Heart, MessageCircle, Share2, Search, Award } from 'lucide-react';
import GlassCard from '../../components/GlassCard';
import Badge from '../../components/Badge';
import Avatar from '../../components/Avatar';
import { useNav, useTheme } from '../../context';
import { DARK, LIGHT } from '../../types';
import { useState } from 'react';

const POSTS = [
  {
    id: 1,
    user: 'Sarah M.',
    handle: 'sarahm',
    avatar: undefined,
    time: '2h ago',
    content: 'Just completed my 10th donation! The team at Acıbadem was amazing. Feeling great about contributing to the community. 🩸❤️',
    likes: 47,
    comments: 12,
    tag: 'Milestone',
    tagColor: 'success' as const,
  },
  {
    id: 2,
    user: 'Mehmet K.',
    handle: 'mehmetk',
    avatar: undefined,
    time: '5h ago',
    content: 'Heads up to all O+ donors in Kadıköy — the Red Crescent has an urgent need! They are offering extended hours this weekend.',
    likes: 128,
    comments: 34,
    tag: 'Urgent',
    tagColor: 'danger' as const,
  },
  {
    id: 3,
    user: 'Elif T.',
    handle: 'elift',
    avatar: undefined,
    time: '1d ago',
    content: 'Completed the Summer Challenge! 3 donations in 2 months. The XP boost is real 💪 Who else is on track?',
    likes: 89,
    comments: 21,
    tag: 'Challenge',
    tagColor: 'warning' as const,
  },
];

export default function Community() {
  const { navigate } = useNav();
  const { theme } = useTheme();
  const T = theme === 'dark' ? DARK : LIGHT;
  const [likedPosts, setLikedPosts] = useState<Set<number>>(new Set());

  const toggleLike = (id: number) => {
    setLikedPosts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '8px 20px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 27, fontWeight: 700, color: T.text, letterSpacing: '-0.03em' }}>Community</h1>
          <p style={{ fontSize: 13, color: T.textMuted, marginTop: 2 }}>Your donor network</p>
        </div>
        <button style={{ background: 'none' }}>
          <Search size={20} color={T.textMuted} />
        </button>
      </div>

      {/* Leaderboard Teaser */}
      <div style={{ padding: '0 16px 16px' }}>
        <GlassCard onClick={() => navigate('leaderboard')} elevated style={{ cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(229, 184, 109, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Award size={20} color="#E5B86D" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>This month's leaderboard</div>
              <div style={{ fontSize: 12, color: T.textMuted }}>You're ranked #14 — keep going!</div>
            </div>
            <Badge color="warning">#14</Badge>
          </div>
        </GlassCard>
      </div>

      {/* Feed */}
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 110 }}>
        {POSTS.map((post) => (
          <GlassCard key={post.id}>
            {/* Post header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <Avatar name={post.user} size={38} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{post.user}</span>
                  <Badge color={post.tagColor}>{post.tag}</Badge>
                </div>
                <div style={{ fontSize: 11, color: T.textMuted }}>{post.time}</div>
              </div>
            </div>

            {/* Content */}
            <p style={{ fontSize: 14, color: T.text, lineHeight: 1.55, marginBottom: 14 }}>{post.content}</p>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 20 }}>
              <button
                onClick={() => toggleLike(post.id)}
                style={{ background: 'none', display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: likedPosts.has(post.id) ? '#D85360' : T.textMuted, fontWeight: likedPosts.has(post.id) ? 600 : 400 }}
              >
                <Heart size={15} fill={likedPosts.has(post.id) ? '#D85360' : 'none'} color={likedPosts.has(post.id) ? '#D85360' : T.textMuted} />
                {post.likes + (likedPosts.has(post.id) ? 1 : 0)}
              </button>
              <button style={{ background: 'none', display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: T.textMuted }}>
                <MessageCircle size={15} />
                {post.comments}
              </button>
              <button style={{ background: 'none', display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: T.textMuted }}>
                <Share2 size={15} />
                Share
              </button>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
