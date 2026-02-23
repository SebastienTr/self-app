/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^expo-sqlite$': '<rootDir>/__mocks__/expo-sqlite.ts',
    '^expo-secure-store$': '<rootDir>/__mocks__/expo-secure-store.ts',
    '^@self/module-schema$': '<rootDir>/../../packages/module-schema/src',
  },
};
