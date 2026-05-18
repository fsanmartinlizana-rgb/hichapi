/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
  ],
  moduleNameMapper: {
    // Fix for jest-expo setup.js requiring NativeModules directly (react-native 0.76+)
    'react-native/Libraries/BatchedBridge/NativeModules':
      '<rootDir>/__mocks__/NativeModules.js',
    '^@/(.*)$': '<rootDir>/$1',
    '^@screens/(.*)$': '<rootDir>/screens/$1',
    '^@components/(.*)$': '<rootDir>/components/$1',
    '^@services/(.*)$': '<rootDir>/services/$1',
    '^@hooks/(.*)$': '<rootDir>/hooks/$1',
    '^@contexts/(.*)$': '<rootDir>/contexts/$1',
    '^@navigation/(.*)$': '<rootDir>/navigation/$1',
    '^@types/(.*)$': '<rootDir>/types/$1',
    '^@utils/(.*)$': '<rootDir>/utils/$1',
    '^@config/(.*)$': '<rootDir>/config/$1',
  },
  setupFilesAfterEnv: ['./jest.setup.ts'],
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/index.{ts,tsx}',
    '!src/**/*.d.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
