module.exports = {
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
  ],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  env: {
    node: true,
    es6: true,
  },
  globals: {
    NodeJS: 'readonly',
  },
  rules: {
    // Only keep critical errors that break functionality
    'no-unused-vars': 'warn',
    'no-unreachable': 'error',
    'no-undef': 'off', // TypeScript handles this better
  },
};