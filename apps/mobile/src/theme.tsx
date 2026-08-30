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
  backgroundGradient: [string, string];
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
}

const darkColors: ThemeColors = {
  ...accent,
  background: '#080D14',
  backgroundGradient: ['#0D1420', '#05080D'],
  surface: 'rgba(255,255,255,0.06)',
  surfaceElevated: 'rgba(255,255,255,0.10)',
  surfaceHighlight: 'rgba(255,255,255,0.15)',
  surfaceSolid: '#111A24',
  surfaceSolidElevated: '#182431',
  text: '#F2F5F7',
  textMuted: '#8495A3',
  border: 'rgba(255,255,255,0.10)',
  borderSubtle: 'rgba(255,255,255,0.06)',
  overlay: 'rgba(0,0,0,0.6)',
  blurTint: 'dark',
  primaryMuted: '#8A3A42',
  secondaryMuted: '#10202A',
  successMuted: '#10221F',
  warningMuted: '#1F1A12',
  dangerMuted: '#26191F',
  aiMuted: '#201C36',
};

const lightColors: ThemeColors = {
  ...accent,
  background: '#F2F3F8',
  backgroundGradient: ['#F7F1FA', '#EDF2FB'],
  surface: 'rgba(255,255,255,0.55)',
  surfaceElevated: 'rgba(255,255,255,0.72)',
  surfaceHighlight: 'rgba(255,255,255,0.88)',
  surfaceSolid: '#FFFFFF',
  surfaceSolidElevated: '#FAFAFC',
  text: '#12161C',
  textMuted: '#5B6674',
  border: 'rgba(15,23,42,0.09)',
  borderSubtle: 'rgba(15,23,42,0.05)',
  overlay: 'rgba(15,23,42,0.45)',
  blurTint: 'light',
  primaryMuted: '#FBE1E4',
  secondaryMuted: '#E1F0F6',
  successMuted: '#E1F5EC',
  warningMuted: '#FBF0DD',
  dangerMuted: '#FBE1E4',
  aiMuted: '#ECE9FB',
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
  display: { fontSize: 38, fontWeight: '700' as const, lineHeight: 44 },
  title: { fontSize: 27, fontWeight: '700' as const, lineHeight: 34 },
  heading: { fontSize: 18, fontWeight: '600' as const, lineHeight: 26 },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  bodySmall: { fontSize: 13, fontWeight: '400' as const, lineHeight: 19 },
  caption: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 1.5 },
  button: { fontSize: 15, fontWeight: '700' as const },
  numeric: { fontSize: 36, fontWeight: '700' as const, lineHeight: 42 },
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
