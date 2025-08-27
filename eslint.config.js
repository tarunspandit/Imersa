// Minimal ESLint flat config for ESLint v9
export default [
  {
    ignores: [
      '**/node_modules/**',
      'BridgeEmulator/flaskUI/assets/**'
    ]
  },
  {
    files: ['BridgeEmulator/flaskUI/**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true }
      },
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        fetch: 'readonly',
        console: 'readonly'
      }
    },
    rules: {
      // Keep rules minimal to avoid noisy failures on legacy UI code
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-undef': 'warn',
      'no-console': 'off'
    }
  }
];
