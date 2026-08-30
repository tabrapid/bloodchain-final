import { Home, Heart, Droplet, Users, Calendar, User } from 'lucide-react';
import type { Tab } from '../types';
import { useTheme } from '../context';
import { DARK, LIGHT, COLORS } from '../types';

const TABS: { id: Tab; icon: typeof Home }[] = [
  { id: 'home', icon: Home },
  { id: 'health', icon: Heart },
  { id: 'donate', icon: Droplet },
  { id: 'community', icon: Users },
  { id: 'calendar', icon: Calendar },
  { id: 'profile', icon: User },
];

interface Props {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export default function TabBar({ activeTab, onTabChange }: Props) {
  const { theme } = useTheme();
  const T = theme === 'dark' ? DARK : LIGHT;

  return (
    <div style={{
      position: 'absolute',
      bottom: 24,
      left: 16,
      right: 16,
      zIndex: 100,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        padding: '10px 8px',
        borderRadius: 999,
        backdropFilter: 'blur(40px)',
        WebkitBackdropFilter: 'blur(40px)',
        background: theme === 'dark'
          ? 'rgba(255,255,255,0.1)'
          : 'rgba(255,255,255,0.75)',
        border: `1px solid ${T.border}`,
        boxShadow: theme === 'dark'
          ? '0 8px 40px rgba(0,0,0,0.5)'
          : '0 8px 40px rgba(0,0,0,0.1)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Specular */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '50%',
          background: T.specular,
          borderRadius: '999px 999px 0 0',
          pointerEvents: 'none',
        }} />

        {TABS.map(({ id, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              style={{
                position: 'relative',
                zIndex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 44,
                height: 36,
                borderRadius: 999,
                background: isActive
                  ? COLORS.primary
                  : 'transparent',
                boxShadow: isActive ? '0 3px 12px rgba(216, 83, 96, 0.4)' : 'none',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              <Icon
                size={isActive ? 18 : 20}
                color={isActive ? '#fff' : T.textMuted}
                strokeWidth={isActive ? 2.5 : 1.8}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
