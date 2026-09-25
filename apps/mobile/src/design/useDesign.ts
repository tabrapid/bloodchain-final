/**
 * The V2 token set for the scheme currently in force.
 *
 * Deliberately NOT a second provider. `ThemeProvider` in `src/theme.tsx` already
 * owns the light/dark decision -- it reads the device, remembers the donor's
 * preference in SecureStore, and re-renders the tree when either changes. A
 * second provider would mean two sources of truth for the same fact, which is
 * the exact failure mode this rebuild exists to remove. This reads that
 * decision and answers with V2 values.
 *
 * It also means V1 and V2 screens can sit in the same app during the rebuild
 * and agree about whether it is dark, which is what lets the migration happen a
 * screen at a time instead of all at once.
 */
import { useMemo } from 'react';
import { useTheme } from '../theme';
import { themes, type DesignColors } from './tokens';

export interface Design {
  colors: DesignColors;
  isDark: boolean;
}

export function useDesign(): Design {
  const { isDark } = useTheme();
  return useMemo(() => ({ colors: isDark ? themes.dark : themes.light, isDark }), [isDark]);
}

export { space, radius, elevation, type, icon, hitTarget, motion, layout } from './tokens';
export type { DesignColors, Accent, AccentName, TypeVariant, ElevationName } from './tokens';
