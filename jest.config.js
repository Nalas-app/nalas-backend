module.exports = {
  testEnvironment: 'node',
  clearMocks: true,
  roots: ['<rootDir>/src/'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/modules/**/*.js',
    '!src/modules/**/validators.js',
    '!src/modules/**/routes.js'
  ],
  setupFilesAfterEnv: ['<rootDir>/src/tests/setup.js'],
  testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)'],
};
