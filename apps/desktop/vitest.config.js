const react = require('@vitejs/plugin-react');
const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.{js,jsx}'],
    setupFiles: ['./test/setup.mjs'],
    clearMocks: true,
    globals: true,
    restoreMocks: true,
  },
});
