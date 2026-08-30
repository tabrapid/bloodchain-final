import { useState, useCallback } from 'react';
import { Sun, Moon } from 'lucide-react';
import type { Theme, Screen, Tab } from './types';
import { DARK, LIGHT } from './types';
import { ThemeContext, NavContext } from './context';

import ColorBlooms from './components/ColorBlooms';
import StatusBar from './components/StatusBar';
import TabBar from './components/TabBar';

// Auth screens
import Welcome from './screens/auth/Welcome';
import Login from './screens/auth/Login';
import Register from './screens/auth/Register';
import CheckEmail from './screens/auth/CheckEmail';

// Main screens
import Home from './screens/main/Home';
import Health from './screens/main/Health';
import Donate from './screens/main/Donate';
import Community from './screens/main/Community';
import CalendarScreen from './screens/main/Calendar';
import Profile from './screens/main/Profile';

// Secondary screens
import Notifications from './screens/main/Notifications';
import SOS from './screens/main/SOS';
import Gamification from './screens/main/Gamification';
import Insights from './screens/main/Insights';
import Leaderboard from './screens/main/Leaderboard';
import DonationHistory from './screens/main/DonationHistory';
import ProfileDonor from './screens/main/ProfileDonor';
import ProfilePersonal from './screens/main/ProfilePersonal';
import ProfilePrivacy from './screens/main/ProfilePrivacy';
import ProfileSecurity from './screens/main/ProfileSecurity';
import AppointmentDetail from './screens/main/AppointmentDetail';

// Booking
import BookingWizard from './screens/booking/BookingWizard';

const MAIN_TABS: Screen[] = ['home', 'health', 'donate', 'community', 'calendar', 'profile'];

const TAB_SCREEN_MAP: Record<Tab, Screen> = {
  home: 'home',
  health: 'health',
  donate: 'donate',
  community: 'community',
  calendar: 'calendar',
  profile: 'profile',
};

function ScreenRenderer({ screen }: { screen: Screen }) {
  switch (screen) {
    case 'welcome': return <Welcome />;
    case 'login': return <Login />;
    case 'register': return <Register />;
    case 'check-email': return <CheckEmail />;
    case 'home': return <Home />;
    case 'health': return <Health />;
    case 'donate': return <Donate />;
    case 'community': return <Community />;
    case 'calendar': return <CalendarScreen />;
    case 'profile': return <Profile />;
    case 'notifications': return <Notifications />;
    case 'sos': return <SOS />;
    case 'gamification': return <Gamification />;
    case 'insights': return <Insights />;
    case 'leaderboard': return <Leaderboard />;
    case 'donation-history': return <DonationHistory />;
    case 'profile-donor': return <ProfileDonor />;
    case 'profile-personal': return <ProfilePersonal />;
    case 'profile-privacy': return <ProfilePrivacy />;
    case 'profile-security': return <ProfileSecurity />;
    case 'appointment-detail': return <AppointmentDetail />;
    default: return <Home />;
  }
}

export default function App() {
  const [theme, setTheme] = useState<Theme>('dark');
  const [screen, setScreen] = useState<Screen>('welcome');
  const [history, setHistory] = useState<Screen[]>(['welcome']);
  const [activeTab, setActiveTab] = useState<Tab>('home');

  const T = theme === 'dark' ? DARK : LIGHT;

  const navigate = useCallback((dest: Screen) => {
    setScreen(dest);
    setHistory((h) => [...h, dest]);
    if (MAIN_TABS.includes(dest)) {
      setActiveTab(dest as Tab);
    }
  }, []);

  const back = useCallback(() => {
    setHistory((h) => {
      if (h.length <= 1) return h;
      const next = h.slice(0, -1);
      setScreen(next[next.length - 1]);
      return next;
    });
  }, []);

  const handleTabChange = useCallback((tab: Tab) => {
    setActiveTab(tab);
    setScreen(TAB_SCREEN_MAP[tab]);
    setHistory((h) => [...h, TAB_SCREEN_MAP[tab]]);
  }, []);

  const showTabBar = MAIN_TABS.includes(screen);
  const showStatusBar = screen !== 'booking';
  const isBooking = screen === 'booking';

  const bgStyle = {
    background: T.bgGrad,
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme: () => setTheme((t) => t === 'dark' ? 'light' : 'dark') }}>
      <NavContext.Provider value={{ screen, navigate, back, activeTab, setActiveTab: handleTabChange }}>
        {/* Outer wrapper */}
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...bgStyle,
          position: 'relative',
          overflow: 'hidden',
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        }}>
          {/* Outer blooms */}
          <ColorBlooms />

          {/* Phone frame */}
          <div style={{
            width: 390,
            height: 844,
            borderRadius: 50,
            overflow: 'hidden',
            position: 'relative',
            flexShrink: 0,
            boxShadow: theme === 'dark'
              ? '0 48px 96px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.08), inset 0 0 0 1px rgba(255,255,255,0.04)'
              : '0 48px 96px rgba(0,0,0,0.2), 0 0 0 1px rgba(255,255,255,0.9)',
          }}>
            {/* Phone background */}
            <div style={{ position: 'absolute', inset: 0, ...bgStyle }} />

            {/* Inner blooms */}
            <ColorBlooms />

            {/* Status bar */}
            {showStatusBar && (
              <div style={{ position: 'relative', zIndex: 10, flexShrink: 0 }}>
                <StatusBar />
              </div>
            )}

            {/* Screen content */}
            <div style={{
              position: 'absolute',
              top: showStatusBar ? 44 : 0,
              left: 0,
              right: 0,
              bottom: 0,
              overflowY: 'auto',
              overflowX: 'hidden',
              zIndex: 5,
            }}>
              <ScreenRenderer screen={screen} />
            </div>

            {/* Booking wizard overlay */}
            {isBooking && (
              <div style={{ position: 'absolute', inset: 0, zIndex: 50 }}>
                <BookingWizard />
              </div>
            )}

            {/* Tab bar overlay */}
            {showTabBar && !isBooking && (
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 20 }}>
                <div style={{ pointerEvents: 'all' }}>
                  <TabBar activeTab={activeTab} onTabChange={handleTabChange} />
                </div>
              </div>
            )}

            {/* Home indicator */}
            <div style={{
              position: 'absolute',
              bottom: 8,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 130,
              height: 5,
              borderRadius: 999,
              background: theme === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)',
              zIndex: 30,
            }} />
          </div>

          {/* Theme toggle — outside phone */}
          <button
            onClick={() => setTheme((t) => t === 'dark' ? 'light' : 'dark')}
            style={{
              position: 'fixed',
              top: 24,
              right: 24,
              width: 44,
              height: 44,
              borderRadius: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              background: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.7)',
              border: `1px solid ${T.border}`,
              boxShadow: T.shadow,
              cursor: 'pointer',
              zIndex: 1000,
            }}
          >
            {theme === 'dark'
              ? <Sun size={18} color="#F2F5F7" />
              : <Moon size={18} color="#12161C" />
            }
          </button>

          {/* Screen label */}
          <div style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: 11,
            fontWeight: 500,
            color: T.textMuted,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            zIndex: 1000,
            backdropFilter: 'blur(10px)',
            background: theme === 'dark' ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.5)',
            padding: '5px 12px',
            borderRadius: 999,
            border: `1px solid ${T.border}`,
          }}>
            {theme === 'dark' ? '🌙 Dark' : '☀️ Light'} · {screen}
          </div>
        </div>
      </NavContext.Provider>
    </ThemeContext.Provider>
  );
}
