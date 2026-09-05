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

// ─── Brand colours ────────────────────────────────────────────────────────────
export const COLORS = {
  primary: '#D85360',
  secondary: '#68B7D1',
  ai: '#8E82DF',
  success: '#63C29B',
  warning: '#E5B86D',
  danger: '#D85360',
  white: '#FFFFFF',
  // Hero gradient family
  heroStart: '#D85360',
  heroMid: '#8E3A59',
  heroEnd: '#5B3080',
} as const;

// ─── Spacing scale ────────────────────────────────────────────────────────────
export const SPACE = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
} as const;

// ─── Radius scale ─────────────────────────────────────────────────────────────
export const RADIUS = {
  sm: 12,
  md: 18,
  card: 22,
  hero: 30,
  pill: 999,
} as const;

// ─── Typography scale ─────────────────────────────────────────────────────────
export const TYPE = {
  screenTitle: { fontSize: 32, fontWeight: 700, letterSpacing: -0.6 },
  heroNumber: { fontSize: 56, fontWeight: 800, letterSpacing: -2 },
  sectionLabel: { fontSize: 12, fontWeight: 600, letterSpacing: 1.2 },
  cardTitle: { fontSize: 16, fontWeight: 600 },
  body: { fontSize: 15, fontWeight: 400 },
  bodySmall: { fontSize: 13, fontWeight: 400 },
  caption: { fontSize: 12, fontWeight: 400 },
  button: { fontSize: 15, fontWeight: 700 },
  numeric: { fontSize: 28, fontWeight: 700, letterSpacing: -0.5 },
} as const;

// ─── Dark theme ───────────────────────────────────────────────────────────────
export const DARK = {
  bg: '#070B12',
  bgGrad: 'linear-gradient(160deg, #0E1625 0%, #08101C 55%, #040609 100%)',

  // Three glass tiers
  navGlass: 'rgba(255, 255, 255, 0.11)',      // tab bar / floating chrome
  elevatedGlass: 'rgba(255, 255, 255, 0.13)', // hero cards, identity, key content
  standardGlass: 'rgba(255, 255, 255, 0.07)', // rows, secondary content

  navBorder: 'rgba(255, 255, 255, 0.22)',
  elevatedBorder: 'rgba(255, 255, 255, 0.18)',
  standardBorder: 'rgba(255, 255, 255, 0.10)',

  navBlur: 'blur(48px)',
  elevatedBlur: 'blur(32px)',
  standardBlur: 'blur(20px)',

  navShadow: '0 12px 48px rgba(0,0,0,0.55)',
  elevatedShadow: '0 8px 32px rgba(0,0,0,0.45)',
  standardShadow: '0 4px 16px rgba(0,0,0,0.30)',

  // Specular — only on elevated+ surfaces
  specular: 'linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.04) 100%)',

  text: '#FFFFFF',
  textMuted: '#8FA3B4',
  textSubtle: '#5B7080',

  // Keep for backwards compat in a few places
  surface: 'rgba(255, 255, 255, 0.07)',
  surfaceHigh: 'rgba(255, 255, 255, 0.13)',
  border: 'rgba(255, 255, 255, 0.12)',
  borderHigh: 'rgba(255, 255, 255, 0.20)',
  shadow: '0 8px 32px rgba(0,0,0,0.45)',
} as const;

// ─── Light theme ──────────────────────────────────────────────────────────────
export const LIGHT = {
  bg: '#EFF1F9',
  bgGrad: 'linear-gradient(160deg, #F8F0FC 0%, #EEEEFc 55%, #E6EFF9 100%)',

  navGlass: 'rgba(255, 255, 255, 0.88)',
  elevatedGlass: 'rgba(255, 255, 255, 0.92)',
  standardGlass: 'rgba(255, 255, 255, 0.72)',

  navBorder: 'rgba(255, 255, 255, 1)',
  elevatedBorder: 'rgba(255, 255, 255, 0.95)',
  standardBorder: 'rgba(255, 255, 255, 0.80)',

  navBlur: 'blur(48px)',
  elevatedBlur: 'blur(32px)',
  standardBlur: 'blur(20px)',

  navShadow: '0 12px 48px rgba(0,0,0,0.10)',
  elevatedShadow: '0 6px 28px rgba(0,0,0,0.10)',
  standardShadow: '0 3px 12px rgba(0,0,0,0.07)',

  specular: 'linear-gradient(180deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.40) 100%)',

  text: '#06080D',
  textMuted: '#4D6070',
  textSubtle: '#7A93A5',

  surface: 'rgba(255, 255, 255, 0.72)',
  surfaceHigh: 'rgba(255, 255, 255, 0.92)',
  border: 'rgba(255, 255, 255, 0.85)',
  borderHigh: 'rgba(255, 255, 255, 1)',
  shadow: '0 6px 28px rgba(0,0,0,0.10)',
} as const;
