import type { Config } from 'tailwindcss';

/**
 * Shared clinical workspace palette for all three portals.
 * Semantic donor-* utilities preserve existing actions and status semantics;
 * surfaces use RGB variables so opacity modifiers and explicit dark mode work.
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
          // Opaque surfaces keep dense tables and fields legible.
          surface: surface('--bc-surface-solid'),
          elevated: surface('--bc-surface-solid-elevated'),
          solid: surface('--bc-surface-solid'),
          text: surface('--bc-text'),
          muted: surface('--bc-muted'),
          border: surface('--bc-border'),

          // Brand accents — constant across themes.
          primary: '#A3294B',
          secondary: '#2875AE',
          ai: '#8E82DF',
          success: '#21845E',
          warning: '#A36B16',
          danger: '#C73E50',

          // Muted variant surfaces (badges, stat cards) and the text color
          // that sits on top of them. The raw accent above fails 4.5:1 small
          // text contrast against its own tint in both themes, so "on*"
          // reads from a per-theme-shifted CSS variable instead — same fix
          // as the mobile app's `onMuted` tokens, same values.
          primaryMuted: 'var(--bc-tint-primary)',
          secondaryMuted: 'var(--bc-tint-secondary)',
          successMuted: 'var(--bc-tint-success)',
          warningMuted: 'var(--bc-tint-warning)',
          dangerMuted: 'var(--bc-tint-danger)',
          aiMuted: 'var(--bc-tint-ai)',
          onPrimaryMuted: surface('--bc-on-primary'),
          onSecondaryMuted: surface('--bc-on-secondary'),
          onSuccessMuted: surface('--bc-on-success'),
          onWarningMuted: surface('--bc-on-warning'),
          onDangerMuted: surface('--bc-on-danger'),
          onAiMuted: surface('--bc-on-ai'),
        },
      },
      fontFamily: {
        sans: ['var(--font-portal, system-ui)', 'system-ui', 'sans-serif'],
        display: ['var(--font-portal, system-ui)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        // One rounded-geometry scale instead of ad-hoc values per screen.
        card: '0.375rem',
        panel: '0.5rem',
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
