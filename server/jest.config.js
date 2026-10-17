module.exports = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/setupEnv.js'], // sets NODE_ENV=test, secrets, BCRYPT_ROUNDS before any module loads
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  testTimeout: 120000,
};
