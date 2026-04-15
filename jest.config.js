module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/integration/**/*.test.js', '**/?(*.)+(spec|test).[jt]s?(x)'],
  verbose: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  roots: ['<rootDir>/src/'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/modules/**/*.js',
    '!src/modules/**/validators.js',
    '!src/modules/**/routes.js'
  ]
};
