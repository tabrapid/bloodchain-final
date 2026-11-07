import type { Config } from 'tailwindcss';
import { bloodchaingaPreset } from '@bloodchain/ui/tailwind-preset';

/**
 * Colors, fonts and radii come from the shared Bloodchainga preset so this
 * dashboard, its sibling dashboards and the donor mobile app stay one visual
 * system. Add app-specific extensions here, not a second palette.
 */
export default {
  presets: [bloodchaingaPreset],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
} satisfies Config;
