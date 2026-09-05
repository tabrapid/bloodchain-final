import { useState, useCallback } from 'react';
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
  const isBooking = screen === 'booking';

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme: () => setTheme((t) => t === 'dark' ? 'light' : 'dark') }}>
      <NavContext.Provider value={{ screen, navigate, back, activeTab, setActiveTab: handleTabChange }}>
        {/* Outer shell — ambient background */}
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: T.bgGrad,
          position: 'relative',
          overflow: 'hidden',
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        }}>
          <ColorBlooms />

          {/* Phone frame */}
          <div style={{
            width: 390,
            height: 844,
            borderRadius: 52,
            overflow: 'hidden',
            position: 'relative',
            flexShrink: 0,
            boxShadow: theme === 'dark'
              ? '0 56px 110px rgba(0,0,0,0.85), 0 0 0 1.5px rgba(255,255,255,0.13), inset 0 0 0 1px rgba(255,255,255,0.05)'
              : '0 56px 110px rgba(0,0,0,0.22), 0 0 0 1.5px rgba(255,255,255,1), inset 0 0 0 1px rgba(255,255,255,0.6)',
          }}>
            {/* Inner background */}
            <div style={{ position: 'absolute', inset: 0, background: T.bgGrad }} />
            <ColorBlooms />

            {/* Status bar with theme toggle baked in */}
            <div style={{ position: 'relative', zIndex: 10, flexShrink: 0 }}>
              <StatusBar />
            </div>

            {/* Scrollable screen content */}
            <div style={{
              position: 'absolute',
              top: 44,
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

            {/* Floating tab bar */}
            {showTabBar && !isBooking && (
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 20,
                pointerEvents: 'none',
              }}>
                <div style={{ pointerEvents: 'all' }}>
                  <TabBar activeTab={activeTab} onTabChange={handleTabChange} />
                </div>
              </div>
            )}

            {/* Home indicator */}
            <div style={{
              position: 'absolute',
              bottom: 6,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 120,
              height: 4,
              borderRadius: 999,
              background: theme === 'dark' ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.18)',
              zIndex: 30,
              pointerEvents: 'none',
            }} />
          </div>
        </div>
      </NavContext.Provider>
    </ThemeContext.Provider>
  );
}
