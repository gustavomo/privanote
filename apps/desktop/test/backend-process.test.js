const { formatBackendStartupError } = require('../src/main/backend-process.js');

describe('formatBackendStartupError', () => {
  it('turns better-sqlite3 ABI mismatches into an actionable rebuild message', () => {
    const message = formatBackendStartupError(
      new Error('Timed out waiting for backend health.'),
      [
        "The module '/tmp/better_sqlite3.node' was compiled against a different Node.js version using NODE_MODULE_VERSION 115.",
        'This version of Node.js requires NODE_MODULE_VERSION 127.',
      ].join(' ')
    );

    expect(message).toContain('better-sqlite3 is out of sync');
    expect(message).toContain('npm run rebuild:native');
  });

  it('falls back to the raw backend detail when the failure is unrelated', () => {
    expect(
      formatBackendStartupError(
        new Error('Timed out waiting for backend health at http://127.0.0.1:4310/health'),
        'listen EADDRINUSE: address already in use 127.0.0.1:4310'
      )
    ).toContain('listen EADDRINUSE');
  });
});
