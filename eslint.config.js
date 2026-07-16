const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**', '.expo/**'],
  },
  {
    rules: {
      // All runtime logging goes through src/lib/logger.
      'no-console': 'error',
    },
  },
]);
