/**
 * Bloodchain Mobile V2 — design tokens.
 *
 * Every value the interface is allowed to use lives here. A screen that needs a
 * colour, a size, a corner or a duration takes it from this file; a screen that
 * writes a hex code or a magic number is a bug, because the thing that makes an
 * app feel like one product rather than forty screens is that nothing is
 * decided twice.
 *
 * WHAT CHANGED FROM V1, AND WHY
 *
 * V1 was a faithful implementation of a "Liquid Glass" reference: frosted
 * panels everywhere, a specular highlight on every surface, ambient colour
 * blooms, and a single rose used for both the brand and for danger. Three
 * things were wrong with it in production, and two of them the codebase had
 * already half-admitted:
 *
 *   1. The blur did not survive contact with a real device. `expo-blur` samples
 *      what is drawn beneath it, and on a screen tiling a dozen panels over a
 *      navigator that sample is repeatedly unavailable -- at which point the
 *      platform draws a flat tinted plate rather than no blur, and a screenful
 *      of them dims the whole app. V1 ended up with `glassBlurOnCards = false`
 *      and a comment explaining that the look never really rested on the blur.
 *      V2 stops pretending: surfaces are opaque and layered, and translucency
 *      is spent in exactly one place, the floating tab bar, where there is one
 *      surface and the effect earns its cost.
 *
 *   2. `primary` and `danger` were the same colour. That is the single most
 *      consequential thing in a blood-service app: if the brand is red, then
 *      red means "Bloodchain", and an emergency has no voice left. V2 gives
 *      `critical` its own hue AND its own treatment -- it is the only colour in
 *      the system permitted to fill a surface -- so "urgent" is legible before
 *      a word is read.
 *
 *   3. Everything was a card. Uniform elevation on every element is the same as
 *      no elevation: nothing is more important than anything else, and the eye
 *      has nowhere to land. V2 has three surface levels and a rule for each.
 *
 * The personality this is aimed at is calm, precise and adult. Restraint is the
 * mechanism: colour is scarce, so it means something when it appears.
 */

/* ------------------------------------------------------------------ palette */

/**
 * Neutrals carry a slight plum cast (hue ~260) rather than the cold blue-grey
 * that the previous scheme used. It is the difference between "software" and
 * "a medical product made by people": barely nameable side by side, clearly
 * warmer over a whole screen.
 */
const ink = {
  /** App background. Near-black, not black: pure black makes every border shout. */
  950: '#0A0A12',
  /** Sunken wells — inputs, inset lists, the area behind a scroller. */
  925: '#0F0F1A',
  /** The default surface: cards, sheets, rows. */
  900: '#15151F',
  /** A surface sitting on another surface. */
  850: '#1C1C2A',
  /** Pressed state of a surface, and the highest level in the system. */
  800: '#242435',
  /** Hairline separators inside a surface. */
  750: '#2B2B3E',
  /** Visible borders — inputs at rest, outlined buttons. */
  700: '#363648',
  /** Disabled fills and tracks. */
  600: '#45455C',
  /** Tertiary text: timestamps, footnotes, units. Measured, not picked: this is
   *  the lightest value that still clears 4.5:1 on the lightest dark surface. */
  500: '#8A8AA6',
  /** Secondary text: everything supporting, and most body copy on a card. */
  400: '#A3A3BC',
  /** Primary text. Not pure white — #FFF on near-black vibrates. */
  100: '#F2F2F8',
} as const;

const paper = {
  950: '#F6F6FA',
  925: '#FFFFFF',
  900: '#FFFFFF',
  850: '#FAFAFD',
  800: '#F0F0F6',
  750: '#E9E9F1',
  700: '#DEDEE9',
  600: '#C3C3D4',
  500: '#6B6B83',
  400: '#55556B',
  100: '#12121C',
} as const;

/**
 * Accents. Four values each, because one colour cannot do four jobs and still
 * be legible:
 *
 *   base  indicators, icons, borders, chart marks — non-text, so >=3:1 against
 *         every surface it may sit on.
 *   text  the same meaning as a label — >=4.5:1 against every surface.
 *   fill  the accent as a SOLID surface, with `textOnAccent` on top of it —
 *         chosen so that white text clears 4.5:1, which `base` does not.
 *   soft  a tint used as a background behind `text`.
 *
 * Every number here was computed against the surface set rather than chosen by
 * eye, and `tokens.spec.ts` recomputes all of them on every run. Keeping the
 * four separate means a screen never has to decide whether a colour is safe for
 * the job it is doing — it takes the one named after the job.
 */
const accentDark = {
  /** Brand and blood domain: identity, donation records, impact. */
  rose: { base: '#D94A63', text: '#F08095', fill: '#D0415A', soft: 'rgba(217,74,99,0.16)' },
  /** EMERGENCY ONLY. Hotter and more orange than rose, so the two never blur. */
  critical: { base: '#FF4436', text: '#FF8577', fill: '#E4291B', soft: 'rgba(255,68,54,0.18)' },
  /** Clinical information: laboratory values, appointments, anything factual. */
  clinical: { base: '#4A9EFF', text: '#8CC2FF', fill: '#2074D5', soft: 'rgba(74,158,255,0.16)' },
  /** AI and inference. Nothing that is not a machine opinion may use it. */
  insight: { base: '#9B8CFF', text: '#BFB5FF', fill: '#7465D8', soft: 'rgba(155,140,255,0.16)' },
  success: { base: '#34C88A', text: '#6FDCAC', fill: '#008648', soft: 'rgba(52,200,138,0.16)' },
  warning: { base: '#F0B23E', text: '#F7CE7C', fill: '#A56700', soft: 'rgba(240,178,62,0.16)' },
} as const;

const accentLight = {
  rose: { base: '#C33A54', text: '#A82843', fill: '#C33A54', soft: 'rgba(195,58,84,0.10)' },
  critical: { base: '#E02D1B', text: '#B81F10', fill: '#E02D1B', soft: 'rgba(224,45,27,0.10)' },
  clinical: { base: '#1F6FD0', text: '#15599E', fill: '#1F6FD0', soft: 'rgba(31,111,208,0.10)' },
  insight: { base: '#6B5BD6', text: '#5546B5', fill: '#6B5BD6', soft: 'rgba(107,91,214,0.10)' },
  success: { base: '#12905F', text: '#0C7049', fill: '#098756', soft: 'rgba(18,144,95,0.10)' },
  warning: { base: '#A9741A', text: '#7E5608', fill: '#A06B11', soft: 'rgba(169,116,26,0.12)' },
} as const;

export type AccentName = keyof typeof accentDark;
export type Accent = { base: string; text: string; fill: string; soft: string };

export interface DesignColors {
  /** Behind everything. */
  background: string;
  /** Inset areas: input wells, inline lists, code-like value blocks. */
  sunken: string;
  /** The default surface. */
  surface: string;
  /** A surface on a surface — a row inside a card, a selected option. */
  surfaceRaised: string;
  /** Pressed. */
  surfacePressed: string;
  /** Hairline inside a surface. */
  divider: string;
  /** A visible edge: inputs, outlined buttons, focused fields at rest. */
  border: string;
  /** Disabled fills, progress tracks. */
  track: string;

  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  /** Text on an accent's `fill`. One value, because every `fill` is chosen so
   *  that this clears 4.5:1 on it. */
  textOnAccent: string;

  rose: Accent;
  critical: Accent;
  clinical: Accent;
  insight: Accent;
  success: Accent;
  warning: Accent;

  /** Dim behind a modal or sheet. */
  scrim: string;
  /** The one translucent surface in the system: the floating tab bar. */
  chrome: { fill: string; border: string; blurTint: 'light' | 'dark'; blurIntensity: number };
}

const darkColors: DesignColors = {
  background: ink[950],
  sunken: ink[925],
  surface: ink[900],
  surfaceRaised: ink[850],
  surfacePressed: ink[800],
  divider: ink[750],
  border: ink[700],
  track: ink[600],
  textPrimary: ink[100],
  textSecondary: ink[400],
  textTertiary: ink[500],
  textOnAccent: '#FFFFFF',
  ...accentDark,
  scrim: 'rgba(4,4,10,0.72)',
  chrome: {
    fill: 'rgba(24,24,36,0.82)',
    border: 'rgba(255,255,255,0.08)',
    blurTint: 'dark',
    blurIntensity: 40,
  },
};

const lightColors: DesignColors = {
  background: paper[950],
  sunken: paper[800],
  surface: paper[900],
  surfaceRaised: paper[850],
  surfacePressed: paper[800],
  divider: paper[750],
  border: paper[700],
  track: paper[600],
  textPrimary: paper[100],
  textSecondary: paper[400],
  textTertiary: paper[500],
  textOnAccent: '#FFFFFF',
  ...accentLight,
  scrim: 'rgba(18,18,28,0.40)',
  chrome: {
    fill: 'rgba(255,255,255,0.88)',
    border: 'rgba(18,18,28,0.06)',
    blurTint: 'light',
    blurIntensity: 40,
  },
};

/* ------------------------------------------------------------------- scales */

/**
 * A 4pt grid. Six steps, because a scale with ten steps is a scale nobody can
 * hold in their head, and the eleventh gets invented at a call site.
 */
export const space = {
  /** Between an icon and its label. */
  xs: 4,
  /** Inside a compact control. */
  sm: 8,
  /** Between related lines of text. */
  md: 12,
  /** The content gutter, and the default padding inside a surface. */
  lg: 16,
  /** Between cards in a stack. */
  xl: 24,
  /** Between sections of a screen. */
  xxl: 32,
} as const;

export const radius = {
  /** Badges, small chips, inline markers. */
  xs: 8,
  /** Inputs, rows, small controls. */
  sm: 12,
  /** The default surface corner. */
  md: 16,
  /** Sheets, hero surfaces, anything full-bleed. */
  lg: 24,
  /** Pills and circles. */
  full: 999,
} as const;

/**
 * Elevation is a pair, not a number: a level names both a surface colour and a
 * shadow, so "raise this" cannot be half-done.
 *
 * Android is given a flat value and leans on the border instead. It draws the
 * shadow from the view's outline, which on a translucent or child-filled
 * surface degrades into a hard grey rectangle inside the card -- a V1 finding
 * that cost four rounds of bug reports. Not worth re-earning.
 */
export const elevation = {
  /** Flush with the page. Lists, inline groups. */
  flat: { shadowOpacity: 0, shadowRadius: 0, shadowOffsetY: 0, android: 0 },
  /** A card. The common case. */
  raised: { shadowOpacity: 0.18, shadowRadius: 12, shadowOffsetY: 4, android: 0 },
  /** Sheets, menus, the tab bar. */
  floating: { shadowOpacity: 0.28, shadowRadius: 24, shadowOffsetY: 10, android: 0 },
} as const;

export type ElevationName = keyof typeof elevation;

/**
 * Type scale.
 *
 * Sizes are chosen so that adjacent steps are distinguishable at arm's length
 * on a phone, and line heights so that a two-line label never collides with
 * itself. Weights stop at 700: an 800 on a phone reads as shouting.
 *
 * `numeric` variants use tabular figures so a column of values does not
 * shimmer as it updates — which matters here, because the columns are
 * laboratory results.
 */
export const type = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: '700', letterSpacing: -0.6 },
  h1: { fontSize: 26, lineHeight: 32, fontWeight: '700', letterSpacing: -0.4 },
  h2: { fontSize: 20, lineHeight: 26, fontWeight: '600', letterSpacing: -0.2 },
  h3: { fontSize: 17, lineHeight: 23, fontWeight: '600', letterSpacing: -0.1 },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400', letterSpacing: 0 },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: '600', letterSpacing: 0 },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '500', letterSpacing: 0 },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400', letterSpacing: 0 },
  /** Section headers. Uppercase is applied by the component, not by the caller. */
  overline: { fontSize: 11, lineHeight: 14, fontWeight: '600', letterSpacing: 0.8 },
  /** A single prominent value: a lab result, a count, a countdown. */
  value: { fontSize: 28, lineHeight: 32, fontWeight: '700', letterSpacing: -0.5 },
  /** The blood type, and nothing else. */
  hero: { fontSize: 48, lineHeight: 52, fontWeight: '700', letterSpacing: -1.5 },
} as const;

export type TypeVariant = keyof typeof type;

export const icon = {
  /** Inline with label text. */
  sm: 16,
  /** The default. */
  md: 20,
  /** Leading a row, or inside a control. */
  lg: 24,
  /** Empty states and feature headers. */
  xl: 32,
} as const;

/**
 * The minimum a finger can reliably hit. Anything interactive is at least this
 * tall, and where the visual element is smaller the touch area is extended
 * rather than the element grown.
 */
export const hitTarget = {
  min: 44,
  /** Comfortable: primary buttons, list rows. */
  comfortable: 52,
} as const;

/**
 * Motion.
 *
 * Short and few. The brief for this product is calm, and an interface that
 * moves constantly is not calm — it is anxious. Durations are the time a
 * transition takes to become invisible, not the time it takes to be admired.
 */
export const motion = {
  /** Press feedback, ripples, colour changes. */
  instant: 120,
  /** The default: sections appearing, values changing. */
  quick: 200,
  /** Sheets and modals entering. */
  gentle: 280,
  /** Press-in scale. Enough to feel, not enough to see. */
  pressScale: 0.97,
} as const;

/** The reading width beyond which lines get hard to track, on a tablet. */
export const layout = {
  maxContentWidth: 560,
  gutter: space.lg,
  /** Space left under a scroll view so the floating tab bar never covers content. */
  tabBarClearance: 96,
} as const;

export const palette = { ink, paper, accentDark, accentLight } as const;
export const themes = { dark: darkColors, light: lightColors } as const;
