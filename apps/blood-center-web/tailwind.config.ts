import type { Config } from 'tailwindcss';

export default {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        donor: {
          background: '#081018',
          surface: '#111A24',
          elevated: '#182431',
          primary: '#D85360',
          secondary: '#68B7D1',
          ai: '#8E82DF',
          success: '#63C29B',
          warning: '#E5B86D',
          danger: '#D85360',
          text: '#F2F5F7',
          muted: '#8495A3',
          border: '#253442',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        display: ['Space Grotesk', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
