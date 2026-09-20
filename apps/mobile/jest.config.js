module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/src/**/*.spec.tsx', '**/src/**/*.spec.ts'],
  setupFiles: ['<rootDir>/jest.setup.js'],
  // Runs inside the sandbox, after the test framework, so it can register an
  // afterAll hook. It disposes the React Query caches each spec creates; see
  // the file for why the suite cannot exit without it.
  setupFilesAfterEnv: ['<rootDir>/jest.teardown-query.js'],
  // The first test to mount a screen pays a one-off cost: Babel transforming the
  // whole React Native module graph. With a warm jest cache that is milliseconds,
  // but CI starts cold every run, where it measured ~8.4s -- over the default 5s
  // per-test budget, so the first test timed out while the other 15 passed in
  // ~10ms each. The work is real setup cost rather than a slow test, so give the
  // suite a budget that covers a cold start instead of letting run order decide
  // which test absorbs it.
  testTimeout: 30000,
  // jest-expo's default transformIgnorePatterns assume npm/yarn's flat layout
  // (`node_modules/react-native/...`). Under pnpm every package actually lives at
  // `node_modules/.pnpm/<name>@<version>/node_modules/<name>/...`, so the stock
  // `node_modules/(?!react-native|expo|...)` negative lookahead sees `.pnpm` and
  // ignores the whole tree — leaving React Native's own Flow-typed sources
  // untransformed. Match pnpm's directory naming instead: a scoped package is
  // encoded as `@scope+name@version`, an unscoped one as `name@version`.
  transformIgnorePatterns: [
    'node_modules/\\.pnpm/(?!(@react-native|react-native|@react-navigation|@expo|expo|@testing-library|lucide-react-native)[@+-])',
  ],
};
