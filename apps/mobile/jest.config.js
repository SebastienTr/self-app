/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@self/module-schema$': '<rootDir>/../../packages/module-schema/src',
  },
};
