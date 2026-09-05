import { Bell, Droplet, Award, AlertTriangle, Heart, ArrowLeft } from 'lucide-react';
import GlassCard from '../../components/GlassCard';
import Badge from '../../components/Badge';
import { useNav, useTheme } from '../../context';
import { DARK, LIGHT } from '../../types';

const NOTIFICATIONS = [
  { id: 1, icon: AlertTriangle, iconColor: '#D85360', iconBg: 'rgba(216, 83, 96, 0.15)', title: 'Urgent O+ request nearby', body: 'Göztepe Hospital needs 3 units — only 2 hours left', time: '5 min ago', unread: true, type: 'danger' as const },
  { id: 2, icon: Bell, iconColor: '#68B7D1', iconBg: 'rgba(104, 183, 209, 0.15)', title: 'Appointment reminder', body: 'Whole blood donation tomorrow at 10:30 AM — Acıbadem Blood Center', time: '1h ago', unread: true, type: 'secondary' as const },
  { id: 3, icon: Award, iconColor: '#E5B86D', iconBg: 'rgba(229, 184, 109, 0.15)', title: 'Badge unlocked!', body: 'You earned the "Lifesaver" badge. 10 donations completed!', time: '2h ago', unread: true, type: 'warning' as const },
  { id: 4, icon: Droplet, iconColor: '#63C29B', iconBg: 'rgba(99, 194, 155, 0.15)', title: 'Donation confirmed', body: 'Your appointment on Sep 3 has been confirmed by Acıbadem Blood Center', time: 'Yesterday', unread: false, type: 'success' as const },
  { id: 5, icon: Heart, iconColor: '#D85360', iconBg: 'rgba(216, 83, 96, 0.12)', title: 'Health check due', body: 'It has been 60 days since your last hemoglobin check. Schedule a lab test.', time: '2 days ago', unread: false, type: 'primary' as const },
  { id: 6, icon: Bell, iconColor: '#8495A3', iconBg: 'rgba(132, 149, 163, 0.12)', title: 'Weekly summary', body: 'You have donated 5.4L total and saved an estimated 36 lives. Keep going!', time: '3 days ago', unread: false, type: 'default' as const },
];

export default function Notifications() {
  const { back } = useNav();
  const { theme } = useTheme();
  const T = theme === 'dark' ? DARK : LIGHT;

  const unreadCount = NOTIFICATIONS.filter((n) => n.unread).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      {/* Header */}
      <div style={{ padding: '8px 20px 20px' }}>
        <button
          onClick={back}
          style={{ background: 'none', display: 'flex', alignItems: 'center', gap: 6, color: '#D85360', fontSize: 14, fontWeight: 600, marginBottom: 16 }}
        >
          <ArrowLeft size={16} /> Back
        </button>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 27, fontWeight: 700, color: T.text, letterSpacing: '-0.03em' }}>Notifications</h1>
            {unreadCount > 0 && <p style={{ fontSize: 13, color: T.textMuted, marginTop: 2 }}>{unreadCount} unread</p>}
          </div>
          <button style={{ background: 'none', fontSize: 13, color: '#D85360', fontWeight: 500 }}>Mark all read</button>
        </div>
      </div>

      {/* List */}
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 32 }}>
        {NOTIFICATIONS.map((n) => {
          const Icon = n.icon;
          return (
            <GlassCard key={n.id} tier={n.unread ? 'elevated' : 'standard'} padding="14px">
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{
                  width: 42,
                  height: 42,
                  borderRadius: 13,
                  background: n.iconBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  position: 'relative',
                }}>
                  <Icon size={18} color={n.iconColor} />
                  {n.unread && (
                    <div style={{
                      position: 'absolute',
                      top: -2,
                      right: -2,
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: '#D85360',
                      border: `2px solid ${theme === 'dark' ? '#070B12' : '#EFF1F9'}`,
                    }} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: n.unread ? 700 : 500, color: T.text, flex: 1 }}>{n.title}</span>
                    <span style={{ fontSize: 11, color: T.textMuted, whiteSpace: 'nowrap', flexShrink: 0 }}>{n.time}</span>
                  </div>
                  <p style={{ fontSize: 12, color: T.textMuted, marginTop: 3, lineHeight: 1.5 }}>{n.body}</p>
                </div>
              </div>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}
