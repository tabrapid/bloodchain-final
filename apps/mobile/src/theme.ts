export const colors = {
  background: '#080D14',
  surface: '#111A24',
  surfaceElevated: '#182431',
  surfaceHighlight: '#1E2E3B',
  primary: '#D85360',
  primaryMuted: '#8A3A42',
  secondary: '#68B7D1',
  ai: '#8E82DF',
  aiGradient: { from: '#8E82DF', to: '#68B7D1' },
  success: '#63C29B',
  warning: '#E5B86D',
  danger: '#D85360',
  text: '#F2F5F7',
  textMuted: '#8495A3',
  border: '#253442',
  borderSubtle: '#1B2B34',
  white: '#FFFFFF',
  overlay: 'rgba(0,0,0,0.6)',
} as const;

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
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
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

export type ColorToken = keyof typeof colors;
export type SpacingToken = keyof typeof spacing;
