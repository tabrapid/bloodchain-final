import { Home, Heart, Droplet, Users, Calendar, User } from 'lucide-react';
import type { Tab } from '../types';
import { useTheme } from '../context';
import { DARK, LIGHT, COLORS, RADIUS } from '../types';

const TABS: { id: Tab; icon: typeof Home; label: string }[] = [
  { id: 'home',      icon: Home,     label: 'Home'      },
  { id: 'health',    icon: Heart,    label: 'Health'    },
  { id: 'donate',    icon: Droplet,  label: 'Donate'    },
  { id: 'community', icon: Users,    label: 'Community' },
  { id: 'calendar',  icon: Calendar, label: 'Calendar'  },
  { id: 'profile',   icon: User,     label: 'Profile'   },
];

interface Props {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export default function TabBar({ activeTab, onTabChange }: Props) {
  const { theme } = useTheme();
  const T = theme === 'dark' ? DARK : LIGHT;

  return (
    /* Safe-area bottom clearance: 16px above home indicator zone */
    <div style={{ padding: '0 14px 22px' }}>
      <div
        role="tablist"
        aria-label="Main navigation"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          padding: '10px 6px 10px',
          borderRadius: RADIUS.pill,
          backdropFilter: T.navBlur,
          WebkitBackdropFilter: T.navBlur,
          background: T.navGlass,
          border: `1px solid ${T.navBorder}`,
          boxShadow: T.navShadow,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Specular */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0,
            height: '50%',
            background: T.specular,
            borderRadius: `${RADIUS.pill}px ${RADIUS.pill}px 0 0`,
            pointerEvents: 'none',
          }}
        />

        {TABS.map(({ id, icon: Icon, label }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              role="tab"
              aria-selected={isActive}
              aria-label={label}
              onClick={() => onTabChange(id)}
              style={{
                position: 'relative',
                zIndex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                minWidth: 44,
                minHeight: 44,
                padding: '6px 10px',
                borderRadius: RADIUS.pill,
                background: isActive ? COLORS.primary : 'transparent',
                boxShadow: isActive ? '0 2px 10px rgba(216, 83, 96, 0.38)' : 'none',
                transition: 'background 0.2s, box-shadow 0.2s',
              }}
            >
              <Icon
                size={isActive ? 17 : 20}
                color={isActive ? '#fff' : T.textMuted}
                strokeWidth={isActive ? 2.5 : 1.8}
                aria-hidden="true"
              />
              {isActive && (
                <span style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: '#fff',
                  letterSpacing: '0.04em',
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                }}>
                  {label}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
