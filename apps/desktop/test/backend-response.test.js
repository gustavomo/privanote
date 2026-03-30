const { resolveBackendErrorMessage } = require('../src/main/backend-response');

describe('resolveBackendErrorMessage', () => {
  it('prefers the backend message when Fastify returns a structured 500 payload', () => {
    expect(
      resolveBackendErrorMessage(
        {
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'SQLITE_ERROR: no such column: tags',
        },
        500
      )
    ).toBe('SQLITE_ERROR: no such column: tags');
  });

  it('falls back to the error field when no specific message is present', () => {
    expect(
      resolveBackendErrorMessage(
        {
          statusCode: 500,
          error: 'Internal Server Error',
        },
        500
      )
    ).toBe('Internal Server Error');
  });

  it('falls back to a generic status message when neither body field is useful', () => {
    expect(resolveBackendErrorMessage(null, 503)).toBe('Backend request failed: 503');
  });
});
