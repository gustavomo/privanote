function resolveBackendErrorMessage(body, status) {
  if (body && typeof body === 'object') {
    const message = String(body.message || '').trim();
    if (message) {
      return message;
    }

    const error = String(body.error || '').trim();
    if (error) {
      return error;
    }
  }

  if (typeof body === 'string' && body.trim()) {
    return body;
  }

  return `Backend request failed: ${status}`;
}

module.exports = {
  resolveBackendErrorMessage,
};
