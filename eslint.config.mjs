import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'

/**
 * Lint only TypeScript sources. Config files (vite/tailwind/metro) and build
 * output are skipped: they are either generated or run under bundler-specific
 * module semantics the TS rules would false-positive on.
 */
export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.expo/**',
      '**/coverage/**',
      '**/*.config.{js,ts,mjs,cjs}',
      // Generated deployment artefacts: an esbuild bundle and a Vite build,
      // committed so the edge functions can load them (see deploy/README.md).
      'deploy/api/**',
      'deploy/web/assets/**',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [eslint.configs.recommended, tseslint.configs.recommended],
    rules: {
      // Express handlers and test stubs legitimately name unused params (req,
      // _res, next); the underscore convention keeps intent visible.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
)
