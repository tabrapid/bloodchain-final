import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Brand accent colors stay constant across light and dark -- they're the
 * app's identity, not surface chrome, and this soft/muted palette already
 * reads cleanly on both a near-black and a near-white background.
 */
const accent = {
  primary: '#D85360',
  secondary: '#68B7D1',
  ai: '#8E82DF',
  success: '#63C29B',
  warning: '#E5B86D',
  danger: '#D85360',
  white: '#FFFFFF',
} as const;

export type ColorScheme = 'light' | 'dark';
export type ColorSchemePreference = ColorScheme | 'system';

export interface ThemeColors {
  primary: string;
  secondary: string;
  ai: string;
  success: string;
  warning: string;
  danger: string;
  white: string;
  background: string;
  backgroundGradient: [string, string, string];
  /** The monochrome rose/plum hero gradient used on every "featured" GradientCard (blood type, donate CTA, health trend). */
  heroGradient: [string, string, string];
  /** Soft ambient color blooms painted behind content, so blur has depth to pick up. */
  ambientOrbs: { color: string; size: number; top: number; left: number }[];
  /** Top-lit specular gradient painted inside every glass panel. */
  glassSheen: [string, string];
  /** Brighter than `border` — the lit edge of a glass panel. */
  glassBorder: string;
  surface: string;
  surfaceElevated: string;
  surfaceHighlight: string;
  surfaceSolid: string;
  surfaceSolidElevated: string;
  text: string;
  textMuted: string;
  border: string;
  borderSubtle: string;
  overlay: string;
  blurTint: 'light' | 'dark';
  primaryMuted: string;
  secondaryMuted: string;
  successMuted: string;
  warningMuted: string;
  dangerMuted: string;
  aiMuted: string;
  /**
   * Text/icon color to use *on top of* the matching `*Muted` tint.
   *
   * The raw accent is a mid-tone, so it fails contrast against its own tint
   * in both directions: on dark it lands ~1.9:1, on light ~3.0:1, where small
   * text needs 4.5:1. These are shifted per mode -- lighter on dark, darker
   * on light -- to clear it.
   */
  onMuted: {
    primary: string;
    secondary: string;
    success: string;
    warning: string;
    danger: string;
    ai: string;
  };
}

const darkColors: ThemeColors = {
  ...accent,
  background: '#070B12',
  backgroundGradient: ['#141C2E', '#0B1119', '#06090F'],
  heroGradient: ['#D85360', '#8E3A59', '#5B3080'],
  // Matches the Create Design reference's ColorBlooms spec exactly: 3
  // blooms ~280-320px, ~24% opacity in dark mode.
  ambientOrbs: [
    { color: 'rgba(216,83,96,0.24)', size: 320, top: -80, left: -60 },
    { color: 'rgba(104,183,209,0.24)', size: 300, top: 300, left: 220 },
    { color: 'rgba(142,130,223,0.24)', size: 280, top: 620, left: -70 },
  ],
  glassSheen: ['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.03)'],
  glassBorder: 'rgba(255,255,255,0.26)',
  surface: 'rgba(255,255,255,0.08)',
  surfaceElevated: 'rgba(255,255,255,0.13)',
  surfaceHighlight: 'rgba(255,255,255,0.18)',
  surfaceSolid: '#111A24',
  surfaceSolidElevated: '#182431',
  text: '#F2F5F7',
  textMuted: '#8495A3',
  border: 'rgba(255,255,255,0.10)',
  borderSubtle: 'rgba(255,255,255,0.06)',
  overlay: 'rgba(0,0,0,0.6)',
  blurTint: 'dark',
  // Alpha tints rather than opaque swatches: these sit *inside* glass panels,
  // and a solid fill reads as a sticker pasted onto the glass instead of part
  // of it. Raised from the first pass's 0.16-0.20 -- those read as tinted
  // grey rather than a clearly identifiable color once composited over the
  // blur; this is the lowest alpha at which red/blue/amber/purple are each
  // unambiguous at a glance instead of merely implied.
  primaryMuted: 'rgba(216,83,96,0.30)',
  secondaryMuted: 'rgba(104,183,209,0.28)',
  successMuted: 'rgba(99,194,155,0.28)',
  warningMuted: 'rgba(229,184,109,0.28)',
  dangerMuted: 'rgba(216,83,96,0.30)',
  aiMuted: 'rgba(142,130,223,0.30)',
  onMuted: {
    primary: '#F2919A',
    secondary: '#A8DCEE',
    success: '#8FDCBC',
    warning: '#F2D49B',
    danger: '#F2919A',
    ai: '#B3AAEE',
  },
};

const lightColors: ThemeColors = {
  ...accent,
  background: '#EFF1F9',
  backgroundGradient: ['#FBF2FA', '#F1F1FC', '#E9F1FB'],
  heroGradient: ['#D85360', '#8E3A59', '#5B3080'],
  ambientOrbs: [
    { color: 'rgba(216,83,96,0.16)', size: 320, top: -80, left: -60 },
    { color: 'rgba(104,183,209,0.16)', size: 300, top: 300, left: 220 },
    { color: 'rgba(142,130,223,0.16)', size: 280, top: 620, left: -70 },
  ],
  glassSheen: ['rgba(255,255,255,0.8)', 'rgba(255,255,255,0.4)'],
  glassBorder: 'rgba(255,255,255,0.9)',
  surface: 'rgba(255,255,255,0.62)',
  surfaceElevated: 'rgba(255,255,255,0.8)',
  surfaceHighlight: 'rgba(255,255,255,0.92)',
  surfaceSolid: '#FFFFFF',
  surfaceSolidElevated: '#FAFAFC',
  text: '#12161C',
  textMuted: '#5B6674',
  border: 'rgba(15,23,42,0.09)',
  borderSubtle: 'rgba(15,23,42,0.05)',
  overlay: 'rgba(15,23,42,0.45)',
  blurTint: 'light',
  primaryMuted: 'rgba(216,83,96,0.20)',
  secondaryMuted: 'rgba(104,183,209,0.26)',
  successMuted: 'rgba(99,194,155,0.26)',
  warningMuted: 'rgba(229,184,109,0.30)',
  dangerMuted: 'rgba(216,83,96,0.20)',
  aiMuted: 'rgba(142,130,223,0.24)',
  onMuted: {
    primary: '#A32C38',
    secondary: '#1F6A83',
    success: '#1F7355',
    warning: '#8A6318',
    danger: '#A32C38',
    ai: '#4E42A8',
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
} as const;

export const radius = {
  sm: 12,
  md: 18,
  lg: 26,
  xl: 34,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 38, fontWeight: '700' as const, lineHeight: 44, letterSpacing: -0.5 },
  title: { fontSize: 32, fontWeight: '700' as const, lineHeight: 38, letterSpacing: -0.6 },
  heading: { fontSize: 19, fontWeight: '600' as const, lineHeight: 26, letterSpacing: -0.2 },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  bodySmall: { fontSize: 13, fontWeight: '400' as const, lineHeight: 19 },
  caption: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.2 },
  button: { fontSize: 15, fontWeight: '700' as const },
  numeric: { fontSize: 36, fontWeight: '700' as const, lineHeight: 42, letterSpacing: -0.5 },
  /** Reserved for the blood-type value itself -- the single strongest number in the app. */
  bloodType: { fontSize: 58, fontWeight: '800' as const, lineHeight: 60, letterSpacing: -1.5 },
} as const;

export type ColorToken = keyof typeof darkColors;
export type SpacingToken = keyof typeof spacing;

/** Backward-compatible static export -- the dark palette, for any code that hasn't adopted `useTheme()`. */
export const colors = darkColors;

const THEME_PREFERENCE_KEY = 'theme_preference';

interface ThemeContextValue {
  colors: ThemeColors;
  scheme: ColorScheme;
  preference: ColorSchemePreference;
  isDark: boolean;
  setPreference: (preference: ColorSchemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ColorSchemePreference>('system');

  useEffect(() => {
    SecureStore.getItemAsync(THEME_PREFERENCE_KEY)
      .then((stored) => {
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setPreferenceState(stored);
        }
      })
      .catch(() => undefined);
  }, []);

  const setPreference = (next: ColorSchemePreference) => {
    setPreferenceState(next);
    SecureStore.setItemAsync(THEME_PREFERENCE_KEY, next).catch(() => undefined);
  };

  const scheme: ColorScheme = preference === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : preference;

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors: scheme === 'light' ? lightColors : darkColors,
      scheme,
      preference,
      isDark: scheme === 'dark',
      setPreference,
    }),
    [scheme, preference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
