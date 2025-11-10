import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import prettier from 'eslint-plugin-prettier';

export default [
  js.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs,ts}'],
    languageOptions: {
      parser: typescriptParser,
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
      prettier: prettier,
    },
    rules: {
      ...typescript.configs.recommended.rules,
      semi: ['error', 'always'],
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'prefer-const': 'error',
      'no-duplicate-imports': 'error',
      'no-unneeded-ternary': 'error',
      'no-shadow': 'off',
      '@typescript-eslint/no-shadow': ['error'],
      'require-await': 'error',
      'no-nested-ternary': 'error',
      'no-undef': 'off',
      'no-console': 'warn',
      eqeqeq: ['error', 'always'],
      '@typescript-eslint/no-unused-expressions': 'off',
      'prettier/prettier': 'error',
    },
  },
  {
    ignores: ['deprecated/**/*', 'dist/**/*', 'node_modules/**/*', 'scripts/**/*'],
  },
];
