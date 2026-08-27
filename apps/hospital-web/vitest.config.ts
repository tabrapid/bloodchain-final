import { defineConfig } from 'vitest/config';

export default defineConfig({
  // These apps set `"jsx": "preserve"` for Next, so esbuild would otherwise
  // fall back to the classic runtime and require React in scope in every spec.
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'jsdom',
    include: ['lib/**/*.spec.ts', 'lib/**/*.spec.tsx', 'components/**/*.spec.tsx'],
    setupFiles: ['./vitest.setup.ts'],
  },
});
