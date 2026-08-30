import type { Config } from 'tailwindcss';

/**
 * Bloodchainga — shared Tailwind preset (web).
 *
 * The three dashboards already speak in semantic `donor-*` class names
 * (`text-donor-text`, `bg-donor-surface`, `border-donor-border`, ~630 usages).
 * Rather than rewrite that markup, this preset re-points those same names at
 * the Liquid Glass CSS variables, so the apps restyle — and gain light mode —
 * without touching the pages.
 *
 * Two kinds of token, deliberately handled differently:
 *
 *  - Surfaces/text/border shift between light and dark, so they read from CSS
 *    variables. They are declared `rgb(var(--x) / <alpha-value>)` so Tailwind
 *    can still compose opacity modifiers; `border-donor-border/60` and friends
 *    keep working.
 *  - Brand accents are the same in both themes, so they stay literal hex.
 *    Tailwind handles alpha on those natively, which keeps
 *    `bg-donor-primary/80` working too.
 */

const surface = (v: string) => `rgb(var(${v}) / <alpha-value>)`;

export const bloodchaingaPreset = {
  content: [],
  theme: {
    extend: {
      colors: {
        donor: {
          // Theme-aware surfaces.
          background: surface('--bc-bg'),
          bg: surface('--bc-bg'),
          surface: surface('--bc-surface'),
          elevated: surface('--bc-surface-elevated'),
          solid: surface('--bc-surface-solid'),
          text: surface('--bc-text'),
          muted: surface('--bc-muted'),
          border: surface('--bc-border'),

          // Brand accents — constant across themes.
          primary: '#D85360',
          secondary: '#68B7D1',
          ai: '#8E82DF',
          success: '#63C29B',
          warning: '#E5B86D',
          danger: '#D85360',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        // One rounded-geometry scale instead of ad-hoc values per screen.
        card: '1.25rem',
        panel: '1.75rem',
      },
      backdropBlur: {
        glass: '20px',
      },
      boxShadow: {
        glass: 'var(--bc-shadow)',
        'glass-lg': 'var(--bc-shadow-lg)',
      },
    },
  },
} satisfies Partial<Config>;

export default bloodchaingaPreset;
