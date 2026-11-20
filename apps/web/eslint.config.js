import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores(['.svelte-kit/**', 'build/**']),
  {
    files: ['**/*.{js,ts,svelte}'],
    extends: [js.configs.recommended, tseslint.configs.recommended, svelte.configs.recommended],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { extraFileExtensions: ['.svelte'] },
    },
  },
  {
    // Sidebar links already resolve their base; Button forwards caller-owned hrefs.
    files: ['src/lib/components/app-sidebar.svelte', 'src/lib/components/ui/button/button.svelte'],
    rules: { 'svelte/no-navigation-without-resolve': ['error', { ignoreLinks: true }] },
  },
  {
    // Path guards deliberately reject ASCII control characters.
    files: ['src/lib/server/resource-files.ts', 'src/lib/source-fields.ts'],
    rules: { 'no-control-regex': 'off' },
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
    languageOptions: {
      parserOptions: { parser: tseslint.parser },
    },
  },
);
