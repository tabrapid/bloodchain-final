import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // These apps set `"jsx": "preserve"` for Next, so esbuild would otherwise
  // fall back to the classic runtime and require React in scope in every spec.
  esbuild: { jsx: 'automatic' },
  resolve: {
    // Mirrors the `paths` in tsconfig.json; vitest does not read them.
    alias: {
      '@lib': fileURLToPath(new URL('./lib', import.meta.url)),
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['app/**/*.spec.tsx', 'lib/**/*.spec.ts', 'lib/**/*.spec.tsx', 'components/**/*.spec.tsx'],
    setupFiles: ['./vitest.setup.ts'],
  },
});
