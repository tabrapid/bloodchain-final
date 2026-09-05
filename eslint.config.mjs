import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      '**/ios/**',
      '**/android/**',
      // Figma Make exports: a separate web project kept only as a visual
      // reference, never built or shipped from here.
      'apps/mobile/Create Design/**',
      'apps/mobile/Create Design (2)/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['packages/*/src/**/*.{ts,tsx}', 'database/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    // The mobile app. `tsc` does not report unused imports, locals or dead
    // styles, and does not check hook dependency arrays -- both classes of
    // problem have shipped here before, so they are errors rather than
    // warnings and gate the build.
    files: ['apps/mobile/app/**/*.{ts,tsx}', 'apps/mobile/src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
      globals: {
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        fetch: 'readonly',
        __DEV__: 'readonly',
      },
    },
    plugins: { '@typescript-eslint': tsPlugin, 'react-hooks': reactHooks },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      // `no-undef` duplicates what the TypeScript compiler already proves,
      // and misfires on type-only names.
      'no-undef': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'react-hooks/rules-of-hooks': 'error',
    },
  },
  {
    // Jest specs legitimately `require()` a module *after* its mocks are
    // registered, which an import statement cannot express.
    files: ['apps/mobile/**/*.spec.{ts,tsx}'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  prettier,
];
