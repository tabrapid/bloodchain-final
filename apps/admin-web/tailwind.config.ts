import type { Config } from 'tailwindcss';
import { bloodchaingaPreset } from '@bloodchain/ui/tailwind-preset';

// This used to also extend a second, shadcn-shaped color/radius layer
// (border/input/ring/background/foreground/primary/secondary/destructive/
// muted/accent/card, all reading `var(--x)`) left over from a starter
// template. Nothing in this app ever rendered those class names -- admin-web
// used raw gray-*/white/red-* literals instead -- and the CSS variables they
// pointed at were never defined, so it was dead weight sitting alongside the
// bloodchaingaPreset donor-* tokens as a second, unused design language.
// Removed now that every page has been moved onto the shared token system.
const config: Config = {
  presets: [bloodchaingaPreset],
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  plugins: [],
};
export default config;
