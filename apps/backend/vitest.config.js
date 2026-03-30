const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.js'],
    clearMocks: true,
    globals: true,
    restoreMocks: true,
  },
});
