import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import astroPlugin from 'eslint-plugin-astro';
import prettierConfig from 'eslint-config-prettier';

const config = [
  // Ignore patterns
  {
    ignores: [
      'dist/',
      'node_modules/',
      '.astro/',
      'coverage/',
      'public/',
      '*.min.js',
      'scripts/dist/',
      'scripts/.astro/',
    ],
  },

  // Base ESLint recommended rules
  eslint.configs.recommended,

  // TypeScript configuration - using the flat config helper
  ...tseslint.configs.recommended,

  // Astro files configuration
  ...astroPlugin.configs.recommended,

  // Prettier config to disable conflicting rules
  prettierConfig,

  // Custom rules for all files
  {
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
    },
  },
];

export default config;
