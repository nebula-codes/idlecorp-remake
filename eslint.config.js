import js from '@eslint/js';
import tseslint from 'typescript-eslint';
export default [
  { ignores: ['**/dist/**', '**/public/**', '**/node_modules/**', '**/data/**', 'release/**'] },
  { ...js.configs.recommended, files: ['**/*.js', '**/*.mjs', '**/*.cjs'], languageOptions: { globals: { process:'readonly', console:'readonly', Buffer:'readonly', URL:'readonly', fetch:'readonly', Response:'readonly', Headers:'readonly', AbortSignal:'readonly', setTimeout:'readonly', clearTimeout:'readonly', setInterval:'readonly', clearInterval:'readonly', __dirname:'readonly', require:'readonly', module:'readonly' } } },
  ...tseslint.configs.recommended.map(c => ({ ...c, files: ['**/*.ts', '**/*.tsx'] })),
  { files: ['scripts/test-*.mjs', 'apps/web/verify-ui.mjs'], languageOptions: { globals: { window:'readonly',document:'readonly' } } },
  { files: ['**/*.ts','**/*.tsx'], rules: { '@typescript-eslint/no-explicit-any': 'off', '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }], '@typescript-eslint/no-empty-object-type':'off' } }
];
