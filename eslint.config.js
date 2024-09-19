import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

export default [
    eslint.configs.recommended,
    {
        files: ['**/*.{js,jsx,ts,tsx}'],
        plugins: {
            react: reactPlugin,
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
                navigator: 'readonly',
                clearInterval: 'readonly',
                setInterval: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                localStorage: 'readonly',
                crypto: 'readonly',
                TextEncoder: 'readonly',
                CompressionStream: 'readonly',
                DecompressionStream: 'readonly',
                Blob: 'readonly',
                Response: 'readonly',
                location: 'readonly',
                __dirname: 'readonly',
            },
        },
        settings: {
            react: {
                version: 'detect',
            },
        },
        rules: {
            'react/react-in-jsx-scope': 'off',
            'react-hooks/rules-of-hooks': 'error',
            // Remove the 'exhaustive-deps' rule for now
            // 'react-hooks/exhaustive-deps': 'warn',
        },
    },
    {
        files: ['**/*.{ts,tsx}'],
        extends: [
            'plugin:@typescript-eslint/recommended',
        ],
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
