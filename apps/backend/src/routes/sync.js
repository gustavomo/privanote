const crypto = require('crypto');
const syncStateService = require('../services/sync-state-service');
const syncRunner = require('../services/sync-runner');
const googleDriveProvider = require('../services/providers/google-drive-provider');
const oneDriveProvider = require('../services/providers/onedrive-provider');

const authSessions = new Map();

function handleRouteError(reply, error) {
  const statusCode = Number(error.statusCode) || 400;
  reply.code(statusCode).send({ error: error.message });
}

function resolveBaseUrl(request) {
  const protocol = request.protocol || (request.headers['x-forwarded-proto'] || 'http');
  return `${protocol}://${request.headers.host}`;
}

function createPkcePair() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return {
    verifier,
    challenge,
  };
}

function buildCompletionPage({ provider, state }) {
  const title = state === 'connected' ? 'Connection complete' : 'Connection failed';
  const description =
    state === 'connected'
      ? `${provider} is now connected. You can return to Privanote.`
      : `${provider} could not be connected. Return to Privanote and review the provider card.`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      body { font-family: Inter, sans-serif; background: #f7f5f2; color: #1f1f1c; padding: 40px; }
      main { max-width: 520px; margin: 0 auto; background: white; border-radius: 24px; padding: 32px; border: 1px solid #e7e3dd; }
      h1 { margin: 0 0 12px; font-size: 24px; }
      p { margin: 0; line-height: 1.6; }
    </style>
  </head>
  <body>
    <main>
      <h1>${title}</h1>
      <p>${description}</p>
    </main>
  </body>
</html>`;
}

function resolveProviderAdapter(provider) {
  if (provider === 'google-drive') {
    return {
      buildAuthorizationUrl: googleDriveProvider.buildGoogleAuthorizationUrl,
      exchangeCode: googleDriveProvider.exchangeGoogleCode,
      ensureRootFolder: googleDriveProvider.ensureGoogleRootFolder,
    };
  }

  if (provider === 'onedrive') {
    return {
      buildAuthorizationUrl: oneDriveProvider.buildOneDriveAuthorizationUrl,
      exchangeCode: oneDriveProvider.exchangeOneDriveCode,
      ensureRootFolder: oneDriveProvider.ensureOneDriveRootFolder,
    };
  }

  const error = new Error('Provider must be google-drive or onedrive');
  error.statusCode = 400;
  throw error;
}

async function beginProviderConnection(provider, request) {
  const adapter = resolveProviderAdapter(provider);
  const pkce = createPkcePair();
  const state = crypto.randomBytes(24).toString('hex');
  const baseUrl = resolveBaseUrl(request);

  authSessions.set(state, {
    provider,
    codeVerifier: pkce.verifier,
    baseUrl,
  });

  syncStateService.storeProviderConnection({
    provider,
    connectionStatus: 'pending',
    lastError: '',
  });

  return {
    provider,
    connectionStatus: 'pending',
    authorizationUrl: adapter.buildAuthorizationUrl({
      baseUrl,
      state,
      codeChallenge: pkce.challenge,
    }),
  };
}

async function completeProviderConnection(provider, request, reply) {
  const adapter = resolveProviderAdapter(provider);
  const { code, state, error: providerError } = request.query || {};
  const session = authSessions.get(String(state || ''));

  if (!session || session.provider !== provider) {
    reply.code(400).type('text/html').send(
      buildCompletionPage({
        provider,
        state: 'error',
      })
    );
    return;
  }

  authSessions.delete(String(state));

  if (providerError) {
    syncStateService.storeProviderConnection({
      provider,
      connectionStatus: 'error',
      lastError: String(providerError),
    });
    reply.code(400).type('text/html').send(
      buildCompletionPage({
        provider,
        state: 'error',
      })
    );
    return;
  }

  try {
    const tokens = await adapter.exchangeCode({
      baseUrl: session.baseUrl,
      code,
      codeVerifier: session.codeVerifier,
    });

    const root = await adapter.ensureRootFolder({
      accessToken: tokens.accessToken,
      accountLabel: tokens.accountLabel,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      scope: tokens.scope,
    });

    syncStateService.storeProviderConnection({
      provider,
      connectionStatus: 'connected',
      accountLabel: tokens.accountLabel,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      scope: tokens.scope,
      rootFolderId: root.rootFolderId,
      rootFolderUrl: root.rootFolderUrl,
      connectedAt: new Date().toISOString(),
      lastError: '',
    });

    reply.type('text/html').send(
      buildCompletionPage({
        provider,
        state: 'connected',
      })
    );
  } catch (error) {
    syncStateService.storeProviderConnection({
      provider,
      connectionStatus: 'error',
      lastError: error.message || 'Provider connection failed.',
    });
    reply.code(400).type('text/html').send(
      buildCompletionPage({
        provider,
        state: 'error',
      })
    );
  }
}

async function registerSyncRoutes(app) {
  app.get('/api/v1/sync/providers', async () => {
    return syncStateService.listProviderConnections();
  });

  app.post('/api/v1/sync/providers/:provider/connect', async (request, reply) => {
    try {
      return await beginProviderConnection(String(request.params.provider || ''), request);
    } catch (error) {
      handleRouteError(reply, error);
    }
  });

  app.get('/api/v1/sync/providers/google-drive/callback', async (request, reply) => {
    await completeProviderConnection('google-drive', request, reply);
  });

  app.get('/api/v1/sync/providers/onedrive/callback', async (request, reply) => {
    await completeProviderConnection('onedrive', request, reply);
  });

  app.post('/api/v1/sync/providers/:provider/disconnect', async (request, reply) => {
    try {
      return syncStateService.disconnectProvider(String(request.params.provider || ''));
    } catch (error) {
      handleRouteError(reply, error);
    }
  });

  app.post('/api/v1/attachments/:attachmentId/sync/retry', async (request, reply) => {
    try {
      return syncRunner.retryAttachmentSync(Number(request.params.attachmentId));
    } catch (error) {
      handleRouteError(reply, error);
    }
  });
}

module.exports = {
  registerSyncRoutes,
};
