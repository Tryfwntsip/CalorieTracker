module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/src/test/jest.setup.js'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/test/**', '!src/**/__tests__/**'],
};
