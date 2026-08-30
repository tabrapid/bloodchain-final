export type Theme = 'dark' | 'light';

export type Screen =
  | 'welcome'
  | 'login'
  | 'register'
  | 'check-email'
  | 'home'
  | 'health'
  | 'donate'
  | 'community'
  | 'calendar'
  | 'profile'
  | 'profile-donor'
  | 'profile-personal'
  | 'profile-privacy'
  | 'profile-security'
  | 'notifications'
  | 'sos'
  | 'gamification'
  | 'leaderboard'
  | 'achievements'
  | 'badges'
  | 'insights'
  | 'donation-history'
  | 'donation-detail'
  | 'education'
  | 'campaigns'
  | 'challenges'
  | 'health-trends'
  | 'laboratory'
  | 'appointment-detail'
  | 'booking'
  | 'courier-active'
  | 'courier-history'
  | 'courier-profile';

export type Tab = 'home' | 'health' | 'donate' | 'community' | 'calendar' | 'profile';

export const COLORS = {
  primary: '#D85360',
  secondary: '#68B7D1',
  ai: '#8E82DF',
  success: '#63C29B',
  warning: '#E5B86D',
  danger: '#D85360',
  white: '#FFFFFF',
} as const;

export const DARK = {
  bg: '#070B12',
  bgGrad: 'linear-gradient(135deg, #141C2E 0%, #0B1119 55%, #06090F 100%)',
  surface: 'rgba(255, 255, 255, 0.08)',
  surfaceHigh: 'rgba(255, 255, 255, 0.13)',
  border: 'rgba(255, 255, 255, 0.12)',
  borderHigh: 'rgba(255, 255, 255, 0.18)',
  shadow: '0 8px 32px rgba(0,0,0,0.45)',
  specular: 'linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.03) 100%)',
  text: '#F2F5F7',
  textMuted: '#8495A3',
} as const;

export const LIGHT = {
  bg: '#EFF1F9',
  bgGrad: 'linear-gradient(135deg, #FBF2FA 0%, #F1F1FC 55%, #E9F1FB 100%)',
  surface: 'rgba(255, 255, 255, 0.65)',
  surfaceHigh: 'rgba(255, 255, 255, 0.80)',
  border: 'rgba(255, 255, 255, 0.85)',
  borderHigh: 'rgba(255, 255, 255, 0.95)',
  shadow: '0 4px 24px rgba(0,0,0,0.08)',
  specular: 'linear-gradient(180deg, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0.35) 100%)',
  text: '#12161C',
  textMuted: '#5B6674',
} as const;
