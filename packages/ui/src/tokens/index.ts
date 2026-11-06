export const colors = {
  background: '#EFF1F5',
  surface: '#FFFFFF',
  surfaceElevated: '#F6F8FB',
  surfaceHighlight: '#1E2E3B',
  primary: '#A3294B',
  primaryMuted: '#FBECEF',
  secondary: '#2875AE',
  ai: '#8E82DF',
  aiGradient: { from: '#8E82DF', to: '#68B7D1' },
  success: '#63C29B',
  warning: '#E5B86D',
  danger: '#C73E50',
  text: '#303E50',
  textMuted: '#606F82',
  border: '#D8DFE8',
  borderSubtle: '#E7EBF1',
  white: '#FFFFFF',
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
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
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
export type RadiusToken = keyof typeof radius;
export type TypographyToken = keyof typeof typography;
