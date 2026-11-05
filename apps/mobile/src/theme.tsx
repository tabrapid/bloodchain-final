import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { Platform, useColorScheme } from 'react-native';
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

/**
 * One complete glass material. `blur` is an expo-blur intensity (0-100), not a
 * CSS pixel radius — the reference's `blur(48/32/20px)` maps to the relative
 * strengths below, keeping the tiers distinguishable on device.
 */
export interface GlassTierTokens {
  fill: string;
  border: string;
  blur: number;
  shadowOpacity: number;
  /**
   * Gaussian sigma, NOT the CSS blur length. The reference states these as
   * `box-shadow: 0 12px 48px`, where 48 is a blur diameter clipped to outside
   * the border box; React Native takes a sigma and clips nothing, so these are
   * about half the reference's numbers to land on the same visual weight.
   */
  shadowRadius: number;
  shadowOffsetY: number;
  elevation: number;
}

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
  /**
   * The call-to-action gradient: rose on the left running to violet on the
   * right. Brighter and shorter than `heroGradient`, which ends in a plum dark
   * enough to swallow white label text at the right edge of a button.
   */
  ctaGradient: [string, string];
  /**
   * The three glass tiers of the Create Design system. Each tier is a complete
   * material — its own fill, border, blur strength and shadow — rather than a
   * single surface with an opacity knob, which is what makes "floating chrome"
   * read as physically closer to the viewer than "a settings row".
   *
   * `nav`      — floating chrome (the tab bar). Strongest blur and depth.
   * `elevated` — hero/identity/appointment cards. Carries the specular sheen.
   * `standard` — settings rows, secondary content. No sheen, lighter shadow.
   */
  glass: {
    nav: GlassTierTokens;
    elevated: GlassTierTokens;
    standard: GlassTierTokens;
  };
  /** Top-lit specular gradient painted inside `nav` and `elevated` panels only. */
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
  /** Dimmer than `textMuted` — timestamps, footnotes, disabled captions. */
  textSubtle: string;
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
  backgroundGradient: ['#0E1625', '#08101C', '#040609'],
  heroGradient: ['#D85360', '#8E3A59', '#5B3080'],
  ctaGradient: ['#E2495F', '#8B4BC8'],
  glass: {
    nav: {
      fill: 'rgba(255,255,255,0.11)',
      border: 'rgba(255,255,255,0.22)',
      blur: 70,
      shadowOpacity: 0.55,
      shadowRadius: 24,
      shadowOffsetY: 12,
      elevation: 12,
    },
    elevated: {
      fill: 'rgba(255,255,255,0.16)',
      border: 'rgba(255,255,255,0.18)',
      blur: 48,
      shadowOpacity: 0.45,
      shadowRadius: 16,
      shadowOffsetY: 8,
      elevation: 8,
    },
    standard: {
      fill: 'rgba(255,255,255,0.10)',
      border: 'rgba(255,255,255,0.10)',
      blur: 30,
      shadowOpacity: 0.3,
      shadowRadius: 8,
      shadowOffsetY: 4,
      elevation: 4,
    },
  },
  glassSheen: ['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.04)'],
  glassBorder: 'rgba(255,255,255,0.18)',
  surface: 'rgba(255,255,255,0.07)',
  surfaceElevated: 'rgba(255,255,255,0.13)',
  surfaceHighlight: 'rgba(255,255,255,0.18)',
  surfaceSolid: '#111A24',
  surfaceSolidElevated: '#182431',
  text: '#FFFFFF',
  textMuted: '#8FA3B4',
  textSubtle: '#5B7080',
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
  backgroundGradient: ['#F8F0FC', '#EEEEFC', '#E6EFF9'],
  heroGradient: ['#D85360', '#8E3A59', '#5B3080'],
  ctaGradient: ['#D8455B', '#7E43B8'],
  glass: {
    nav: {
      fill: 'rgba(255,255,255,0.88)',
      border: 'rgba(255,255,255,1)',
      blur: 85,
      shadowOpacity: 0.1,
      shadowRadius: 24,
      shadowOffsetY: 12,
      elevation: 12,
    },
    elevated: {
      fill: 'rgba(255,255,255,0.92)',
      border: 'rgba(255,255,255,0.95)',
      blur: 62,
      shadowOpacity: 0.1,
      shadowRadius: 14,
      shadowOffsetY: 6,
      elevation: 8,
    },
    standard: {
      fill: 'rgba(255,255,255,0.72)',
      border: 'rgba(255,255,255,0.80)',
      blur: 40,
      shadowOpacity: 0.07,
      shadowRadius: 6,
      shadowOffsetY: 3,
      elevation: 4,
    },
  },
  glassSheen: ['rgba(255,255,255,0.85)', 'rgba(255,255,255,0.40)'],
  glassBorder: 'rgba(255,255,255,0.95)',
  surface: 'rgba(255,255,255,0.72)',
  surfaceElevated: 'rgba(255,255,255,0.92)',
  surfaceHighlight: 'rgba(255,255,255,0.96)',
  surfaceSolid: '#FFFFFF',
  surfaceSolidElevated: '#FAFAFC',
  text: '#06080D',
  textMuted: '#4D6070',
  textSubtle: '#7A93A5',
  border: 'rgba(255,255,255,0.80)',
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

/**
 * The reference's scale is `sm 12 / md 18 / card 22 / hero 30 / pill 999`.
 * `lg` and `xl` carry the card and hero values so the ~40 existing call sites
 * pick up the new geometry without a rename churn.
 */
/**
 * Vertical rhythm for stacked content. Kept here rather than as numbers in
 * forty screens so the density of the whole app is one decision.
 *
 * `cardGap` is for a stack of cards; dense *row* lists (notifications, a
 * donation history, leaderboard places) stay tighter at `spacing.sm`, because
 * a row is not a card and reads better packed.
 */
/**
 * Whether glass surfaces use a real backdrop blur.
 *
 * `expo-blur` wraps the platform's backdrop-blur view, which samples what has
 * already been drawn beneath it. When that sample is unavailable -- and on a
 * screen that tiles a dozen of them over a navigator, it repeatedly is -- the
 * platform does not fall back to "no blur", it falls back to a flat tinted
 * plate. With `tint: 'dark'` that is a dark scrim, so a screenful of cards
 * dims the entire app uniformly: text, icons, the tab bar, everything. That
 * was reported four times across separate builds and survived moving the
 * backdrop to the root.
 *
 * So the effect is off for the surfaces that tile the screen. The design does
 * not actually rest on it -- the translucent fill, the hairline border, the
 * specular sheen and the color blooms behind carry the look, and now they
 * render the same way every launch. The tab bar keeps its blur: it is a single
 * surface, it is the one place the effect earns its cost, and a single failure
 * there is a slightly flat pill rather than a dimmed app.
 *
 * Flip this to `true` to get the blur back on cards.
 */
export const glassBlurOnCards = false;

/**
 * The elevation to use on a surface that is *see-through* -- every glass card,
 * the floating tab bar, any wrapper whose fill actually lives in a child.
 *
 * Android draws an elevation shadow underneath the view it belongs to, and
 * derives its shape from the view's outline. A view with no background of its
 * own offers no rounded outline, so Android falls back to the bounding box --
 * and because the surface above it is translucent, that shadow reads straight
 * through the fill as a hard, square-cornered grey rectangle sitting inside
 * the card. It showed up on every card in the app, worst wherever the backdrop
 * behind it was bright: over an ambient bloom, or under the emergency card's
 * rose halo. No elevation value avoids it -- the problem is the surface being
 * translucent, not the shadow being too strong.
 *
 * iOS computes its shadow from the rendered alpha of the whole subtree, so it
 * gets both the rounded shape and the occlusion right, and keeps its shadow.
 * On Android the hairline border carries the separation instead.
 */
export function translucentElevation(value: number): number {
  return Platform.OS === 'android' ? 0 : value;
}

export const layout = {
  cardGap: 10,
  sectionGapTop: 16,
  sectionGapBottom: 8,
} as const;

export const radius = {
  sm: 12,
  md: 18,
  /** The reference's `card` radius — the default for a GlassCard. */
  lg: 22,
  /** The reference's `hero` radius — full-bleed gradient cards. */
  xl: 30,
  pill: 999,
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
