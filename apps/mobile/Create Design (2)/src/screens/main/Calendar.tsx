import { useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, MapPin, Plus } from 'lucide-react';
import GlassCard from '../../components/GlassCard';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import { useNav, useTheme } from '../../context';
import { DARK, LIGHT } from '../../types';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const EVENTS: Record<number, { type: string; status: string; color: string }> = {
  3: { type: 'donation', status: 'Confirmed', color: '#D85360' },
  15: { type: 'checkup', status: 'Pending', color: '#68B7D1' },
  22: { type: 'donation', status: 'Available', color: '#63C29B' },
};

const APPOINTMENTS = [
  { id: 1, title: 'Whole Blood Donation', org: 'Acıbadem Blood Center', date: 'Tue, Sep 3', time: '10:30 AM', status: 'success' as const },
  { id: 2, title: 'General Health Checkup', org: 'Florence Nightingale Clinic', date: 'Mon, Sep 15', time: '2:00 PM', status: 'warning' as const },
];

export default function CalendarScreen() {
  const { navigate } = useNav();
  const { theme } = useTheme();
  const T = theme === 'dark' ? DARK : LIGHT;
  const [selectedDay, setSelectedDay] = useState(3);

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '8px 20px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 27, fontWeight: 700, color: T.text, letterSpacing: '-0.03em' }}>Calendar</h1>
          <p style={{ fontSize: 13, color: T.textMuted, marginTop: 2 }}>Appointments & donations</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => navigate('booking')}>
          <Plus size={14} /> Schedule
        </Button>
      </div>

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 110 }}>

        {/* Month + Calendar */}
        <GlassCard tier="elevated">
          {/* Month nav */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <button style={{ background: 'none', color: T.textMuted }}><ChevronLeft size={18} /></button>
            <span style={{ fontSize: 16, fontWeight: 700, color: T.text, letterSpacing: '-0.01em' }}>September 2026</span>
            <button style={{ background: 'none', color: T.textMuted }}><ChevronRight size={18} /></button>
          </div>

          {/* Day labels */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 8 }}>
            {DAYS.map((d) => (
              <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, color: T.textMuted, letterSpacing: '0.05em' }}>{d}</div>
            ))}
          </div>

          {/* Date cells */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {/* Offset for Sep 1 = Tuesday (index 1) */}
            <div />
            {Array.from({ length: 30 }, (_, i) => i + 1).map((day) => {
              const event = EVENTS[day];
              const isSelected = day === selectedDay;
              const isToday = day === 30;
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  style={{
                    width: '100%',
                    aspectRatio: '1',
                    borderRadius: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isSelected ? '#D85360' : isToday ? 'rgba(216, 83, 96, 0.12)' : 'transparent',
                    border: isToday && !isSelected ? '1px solid rgba(216, 83, 96, 0.4)' : '1px solid transparent',
                    cursor: 'pointer',
                    gap: 2,
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: isSelected || isToday ? 700 : 400, color: isSelected ? '#fff' : T.text }}>
                    {day}
                  </span>
                  {event && !isSelected && (
                    <div style={{ width: 4, height: 4, borderRadius: '50%', background: event.color }} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 14, marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#D85360' }} />
              <span style={{ fontSize: 11, color: T.textMuted }}>Donation</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#68B7D1' }} />
              <span style={{ fontSize: 11, color: T.textMuted }}>Checkup</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#63C29B' }} />
              <span style={{ fontSize: 11, color: T.textMuted }}>Available</span>
            </div>
          </div>
        </GlassCard>

        {/* Upcoming */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.textMuted, marginBottom: 12 }}>
            Upcoming Appointments
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {APPOINTMENTS.map((apt) => (
              <GlassCard key={apt.id} padding="14px" onClick={() => navigate('appointment-detail')}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{apt.title}</span>
                      <Badge color={apt.status}>{apt.status === 'success' ? 'Confirmed' : 'Pending'}</Badge>
                    </div>
                    <div style={{ fontSize: 12, color: T.textMuted, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={11} /> {apt.date} · {apt.time}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <MapPin size={11} /> {apt.org}
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={16} color={T.textMuted} />
                </div>
              </GlassCard>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
