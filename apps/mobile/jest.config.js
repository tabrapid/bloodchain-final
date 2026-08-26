module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/src/**/*.spec.tsx', '**/src/**/*.spec.ts'],
  setupFiles: ['<rootDir>/jest.setup.js'],
  // jest-expo's default transformIgnorePatterns assume npm/yarn's flat layout
  // (`node_modules/react-native/...`). Under pnpm every package actually lives at
  // `node_modules/.pnpm/<name>@<version>/node_modules/<name>/...`, so the stock
  // `node_modules/(?!react-native|expo|...)` negative lookahead sees `.pnpm` and
  // ignores the whole tree — leaving React Native's own Flow-typed sources
  // untransformed. Match pnpm's directory naming instead: a scoped package is
  // encoded as `@scope+name@version`, an unscoped one as `name@version`.
  transformIgnorePatterns: [
    'node_modules/\\.pnpm/(?!(@react-native|react-native|@expo|expo|@testing-library|lucide-react-native)[@+-])',
  ],
};
