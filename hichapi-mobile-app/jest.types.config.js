/**
 * Minimal Jest configuration for pure TypeScript tests (no React Native).
 * Used for type guard, utility, and property-based tests that don't require
 * the jest-expo preset.
 */
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: [
    '**/__tests__/types/**/*.test.ts',
    '**/__tests__/properties/**/*.test.ts',
    '**/__tests__/services/**/*.test.ts',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@types/(.*)$': '<rootDir>/types/$1',
    '^@utils/(.*)$': '<rootDir>/utils/$1',
  },
};
