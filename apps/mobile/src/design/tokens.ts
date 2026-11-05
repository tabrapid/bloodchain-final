/**
 * Bloodchain Mobile V4 — design tokens.
 *
 * Every value the interface is allowed to use lives here. A screen that needs a
 * colour, a size, a corner or a duration takes it from this file; a screen that
 * writes a hex code or a magic number is a bug, because the thing that makes an
 * app feel like one product rather than sixty screens is that nothing is
 * decided twice.
 *
 * WHAT V4 IS
 *
 * Three previous systems were built on the same near-black page with the same
 * bordered card as the unit of everything, and each was a little calmer than
 * the last. None of them had an identity. V4 is the first one designed from a
 * material rather than from a component:
 *
 *   The page is a deep navy-plum, not a black. Surfaces are lighter tones of
 *   the same material and are never outlined -- a border is a signal reserved
 *   for controls that take input. Depth comes from tone and from a hairline of
 *   light along the top edge of a raised surface, the way a physical panel
 *   catches light, and never from a black shadow cast onto a black page.
 *
 *   Two typefaces. Manrope carries every title and every number, Inter carries
 *   everything read as a sentence. A single family cannot be both a reading
 *   face and a display face, and three scales built on Inter alone proved it.
 *
 *   Colour is scarce. Rose is the brand and the primary action; clinical blue
 *   is factual information; violet appears only where a model produced
 *   something; green, amber and red mean a status and nothing else. One
 *   gradient exists in the system -- the identity hero -- and it is drawn
 *   nowhere else.
 */

import { fonts } from './fonts';

/* ------------------------------------------------------------------ palette */

/**
 * Neutrals. Hue ~232 -- a navy with a little plum in it. The steps are chosen
 * on an OLED panel at normal brightness rather than in a colour picker: each
 * level is visibly lighter than the one below without any of them reading as
 * grey.
 */
const ink = {
  /** App background. */
  950: '#0A0C16',
  /** Sunken wells: input interiors, code-like value blocks. */
  925: '#070810',
  /** The default surface: a card, a sheet, a grouped list. */
  900: '#141829',
  /** A surface on a surface, and the tab bar. */
  850: '#1C2137',
  /** Pressed state of a surface. */
  800: '#20253E',
  /** Hairline separators inside a surface. */
  750: 'rgba(255,255,255,0.07)',
  /** Visible borders: inputs at rest, outlined buttons. */
  700: 'rgba(255,255,255,0.13)',
  /** Disabled fills and progress tracks. */
  600: '#303756',
  /** Tertiary text: timestamps, units, footnotes. The darkest value that still
   *  clears 4.5:1 on the lightest dark surface. Measured, not picked. */
  500: '#9399B6',
  /** Secondary text. */
  400: '#ADB2CC',
  /** Primary text. Not pure white: #FFF on this page vibrates. */
  100: '#F3F4FA',
  /** The light catching the top edge of a raised surface. */
  highlight: 'rgba(255,255,255,0.055)',
} as const;

const paper = {
  950: '#F4F5F9',
  925: '#FFFFFF',
  900: '#FFFFFF',
  850: '#F8F8FC',
  800: '#EEEFF5',
  750: 'rgba(18,20,40,0.08)',
  700: 'rgba(18,20,40,0.16)',
  600: '#C6C9D8',
  500: '#666B85',
  400: '#4E536B',
  100: '#12141F',
  highlight: 'rgba(255,255,255,0.6)',
} as const;

/**
 * Accents. Four values each, because one colour cannot do four jobs:
 *
 *   base  indicators, icons, dots, chart marks — non-text, >=3:1 on every surface.
 *   text  the same meaning as a label — >=4.5:1 on every surface.
 *   fill  the accent as a SOLID surface with `textOnAccent` on top of it.
 *   soft  a tint used as a ground behind `text`.
 *
 * Every number was computed against the surface set rather than chosen by eye,
 * and `tokens.spec.ts` recomputes all of them on every run.
 */
const accentDark = {
  /** Brand and blood domain: identity, donation, the primary action. */
  rose: { base: '#E44E6B', text: '#FF8DA4', fill: '#D13A58', soft: 'rgba(228,78,107,0.14)' },
  /** EMERGENCY ONLY. Hotter and more orange than rose, so the two never blur. */
  critical: { base: '#FF5644', text: '#FF9284', fill: '#E0301F', soft: 'rgba(255,86,68,0.16)' },
  /** Clinical information: laboratory values, appointments, anything factual. */
  clinical: { base: '#4F9EFF', text: '#95C5FF', fill: '#2470D0', soft: 'rgba(79,158,255,0.14)' },
  /** AI and inference. Nothing that is not a model's output may use it. */
  insight: { base: '#A393FF', text: '#C6BBFF', fill: '#7263D6', soft: 'rgba(163,147,255,0.14)' },
  success: { base: '#3DCB8F', text: '#80E0B7', fill: '#0E8550', soft: 'rgba(61,203,143,0.14)' },
  warning: { base: '#F2B443', text: '#F8D083', fill: '#A56700', soft: 'rgba(242,180,67,0.14)' },
} as const;

const accentLight = {
  rose: { base: '#C63652', text: '#A82843', fill: '#C63652', soft: 'rgba(198,54,82,0.10)' },
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
  /** Inset areas: input wells, inline value blocks. */
  sunken: string;
  /** The default surface. */
  surface: string;
  /** A surface on a surface — a row inside a card, a selected option, the tab bar. */
  surfaceRaised: string;
  /** Pressed. */
  surfacePressed: string;
  /** Hairline inside a surface. */
  divider: string;
  /** A visible edge: inputs, outlined buttons. */
  border: string;
  /** Disabled fills, progress tracks. */
  track: string;
  /** The light along the top edge of a raised surface. */
  highlight: string;

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
  /**
   * The one gradient in the system: the identity hero. A deep rose-plum that
   * fades into the surface colour, so the hero belongs to the same material as
   * the cards under it rather than sitting on the page like a poster.
   */
  heroGradient: readonly [string, string];
  /** The bottom tab bar: an opaque tone with a hairline above it. */
  chrome: { fill: string; border: string };
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
  highlight: ink.highlight,
  textPrimary: ink[100],
  textSecondary: ink[400],
  textTertiary: ink[500],
  textOnAccent: '#FFFFFF',
  ...accentDark,
  scrim: 'rgba(4,5,12,0.72)',
  heroGradient: ['#3B1530', '#141829'],
  chrome: { fill: '#0F1222', border: 'rgba(255,255,255,0.08)' },
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
  highlight: paper.highlight,
  textPrimary: paper[100],
  textSecondary: paper[400],
  textTertiary: paper[500],
  textOnAccent: '#FFFFFF',
  ...accentLight,
  scrim: 'rgba(18,20,31,0.42)',
  heroGradient: ['#FBE3E9', '#FFFFFF'],
  chrome: { fill: '#FFFFFF', border: 'rgba(18,20,40,0.08)' },
};

/* ------------------------------------------------------------------- scales */

/**
 * A 4pt grid. Seven steps, because a scale nobody can hold in their head is a
 * scale whose eighth step gets invented at a call site.
 */
export const space = {
  /** Between an icon and its label. */
  xs: 4,
  /** Inside a compact control; between rows that read as one thing. */
  sm: 8,
  /** Between related lines of text. */
  md: 12,
  /** The default padding inside a surface. */
  lg: 16,
  /** Between sections that belong to the same subject. */
  xl: 24,
  /** Between subjects. */
  xxl: 32,
  /** A genuine break between two halves of a screen. Rare on purpose. */
  xxxl: 48,
} as const;

export const radius = {
  /** Badges, small chips, inline markers. */
  xs: 8,
  /** Inputs, buttons, small controls. */
  sm: 12,
  /** Rows inside a group, option cells. */
  md: 16,
  /** The default surface corner. */
  lg: 20,
  /** Sheets, the hero, anything full-bleed. */
  xl: 28,
  /** Pills and circles. */
  full: 999,
} as const;

/**
 * Elevation is a pair, not a number: a level names both a surface tone and a
 * shadow, so "raise this" cannot be half-done.
 *
 * A black shadow cast onto a near-black page is invisible, so on the page tone
 * does all the work. A real shadow is spent only where it lands on content:
 * a sheet, a menu, the tab bar. iOS composites shadows well and gets a soft
 * one on cards too; Android draws a hard grey rectangle from a child-filled
 * view's outline, and gets none there.
 */
export const elevation = {
  /** Flush with the page. Lists, inline groups. */
  flat: { shadowOpacity: 0, shadowRadius: 0, shadowOffsetY: 0, android: 0 },
  /** A card. Tone and a top highlight on Android; a soft shadow on iOS. */
  raised: { shadowOpacity: 0.28, shadowRadius: 18, shadowOffsetY: 6, android: 0 },
  /** Sheets, menus, the tab bar — over content, where a shadow reads. */
  floating: { shadowOpacity: 0.4, shadowRadius: 30, shadowOffsetY: 12, android: 14 },
} as const;

export type ElevationName = keyof typeof elevation;

/**
 * The type scale.
 *
 *   display   40  Manrope ExtraBold   the welcome headline, one number on a screen
 *   h1        28  Manrope Bold        the title of a root screen
 *   h2        22  Manrope Bold        a sheet title, the title of a pushed screen
 *   h3        18  Manrope SemiBold    a section title
 *   title     16  Inter SemiBold      a card, row or record title
 *   body      15  Inter Regular       sentences
 *   bodyMedium 15 Inter Medium        row titles, key-value values
 *   bodyStrong 15 Inter SemiBold      emphasis inside a sentence; button labels
 *   label     13  Inter Medium        form labels, row values, tab labels
 *   caption   12  Inter Regular       timestamps, hints, units
 *   overline  11  Inter SemiBold      an uppercase micro-label above a value
 *   value     30  Manrope Bold        a clinical value, a count, a countdown
 *   valueSm   20  Manrope Bold        a value inside a row
 *   hero      56  Manrope ExtraBold   the blood type, and nothing else
 *
 * Every adjacent pair on the ladder differs in size AND face, so hierarchy
 * survives a renderer that disagrees about weight. `fontWeight` appears
 * nowhere: the face carries the weight (see `fonts.ts`).
 *
 * Line heights are explicit because `includeFontPadding: false` is set on every
 * Text; Manrope and Inter both have tall x-heights, so these run a little loose.
 */
export const type = {
  display: { fontSize: 40, lineHeight: 46, fontFamily: fonts.displayExtraBold, letterSpacing: -1.2 },
  h1: { fontSize: 28, lineHeight: 34, fontFamily: fonts.displayBold, letterSpacing: -0.7 },
  h2: { fontSize: 22, lineHeight: 28, fontFamily: fonts.displayBold, letterSpacing: -0.4 },
  h3: { fontSize: 18, lineHeight: 24, fontFamily: fonts.displaySemibold, letterSpacing: -0.2 },
  title: { fontSize: 16, lineHeight: 22, fontFamily: fonts.semibold, letterSpacing: -0.1 },
  body: { fontSize: 15, lineHeight: 22, fontFamily: fonts.regular, letterSpacing: 0 },
  /** A row title, a key-value value: read as a sentence, weighted as a name. */
  bodyMedium: { fontSize: 15, lineHeight: 22, fontFamily: fonts.medium, letterSpacing: 0 },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontFamily: fonts.semibold, letterSpacing: 0 },
  label: { fontSize: 13, lineHeight: 18, fontFamily: fonts.medium, letterSpacing: 0 },
  caption: { fontSize: 12, lineHeight: 16, fontFamily: fonts.regular, letterSpacing: 0 },
  /** Uppercase is applied by the component, not by the caller. */
  overline: { fontSize: 11, lineHeight: 14, fontFamily: fonts.semibold, letterSpacing: 0.8 },
  value: { fontSize: 30, lineHeight: 36, fontFamily: fonts.displayBold, letterSpacing: -0.8 },
  valueSm: { fontSize: 20, lineHeight: 26, fontFamily: fonts.displayBold, letterSpacing: -0.4 },
  hero: { fontSize: 56, lineHeight: 60, fontFamily: fonts.displayExtraBold, letterSpacing: -2.4 },
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
 * Motion. Short and few: the brief for this product is calm, and an interface
 * that moves constantly is anxious. Durations are the time a transition takes
 * to become invisible, not the time it takes to be admired.
 */
export const motion = {
  /** Press feedback, colour changes. */
  instant: 120,
  /** The default: sections appearing, values changing. */
  quick: 200,
  /** Sheets and modals entering. */
  gentle: 280,
  /** Press-in scale. Enough to feel, not enough to see. */
  pressScale: 0.975,
} as const;

/** The reading width beyond which lines get hard to track, on a tablet. */
export const layout = {
  maxContentWidth: 560,
  /** The screen gutter. 20 rather than 16: the extra 4pt of air at the edges is
   *  most of what separates "composed" from "filled". */
  gutter: 20,
  /** Space left under a scroll view so the tab bar never covers content, on
   *  screens outside a tab navigator. */
  tabBarClearance: 84,
} as const;

export const palette = { ink, paper, accentDark, accentLight } as const;
export const themes = { dark: darkColors, light: lightColors } as const;
