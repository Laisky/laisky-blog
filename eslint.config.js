import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

export default [
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  eslint.configs.recommended,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      'react-hooks': reactHooksPlugin,
      '@typescript-eslint': tseslint,
    },
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        navigator: 'readonly',
        clearInterval: 'readonly',
        setInterval: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        crypto: 'readonly',
        TextEncoder: 'readonly',
        CompressionStream: 'readonly',
        DecompressionStream: 'readonly',
        Blob: 'readonly',
        Response: 'readonly',
        location: 'readonly',
        __dirname: 'readonly',
        MutationObserver: 'readonly',
        Node: 'readonly',
        requestAnimationFrame: 'readonly',
        Buffer: 'readonly',
        Intl: 'readonly',
        google: 'readonly',
      },
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      // Remove the 'exhaustive-deps' rule for now
      // 'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: ['plugin:@typescript-eslint/recommended'],
    languageOptions: {
      parser: tsParser,
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      // TypeScript-specific rules
    },
  },
];
