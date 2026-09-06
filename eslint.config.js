import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', '.cache/**', 'public/**', 'test-results/**', 'playwright-report/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // The simulation, content and i18n layers must stay Phaser-free and deterministic.
    files: ['src/core/**/*.ts', 'src/data/**/*.ts', 'src/i18n/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { paths: [{ name: 'phaser', message: 'src/core, src/data and src/i18n must not import phaser.' }] }],
      'no-restricted-properties': ['error', { object: 'Math', property: 'random', message: 'Use the seeded Rng instead of Math.random.' }],
    },
  },
);
