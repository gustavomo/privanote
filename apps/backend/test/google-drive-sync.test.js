const fs = require('fs');
const os = require('os');
const path = require('path');

const modulePaths = [
  require.resolve('../src/storage/attachment-files.js'),
  require.resolve('../src/storage/runtime-paths.js'),
  require.resolve('../src/storage/media-files.js'),
  require.resolve('../src/storage/database.js'),
  require.resolve('../src/services/nodes-service.js'),
  require.resolve('../src/services/attachments-service.js'),
  require.resolve('../src/services/settings-service.js'),
  require.resolve('../src/services/transcripts-service.js'),
  require.resolve('../src/services/local-transcription.js'),
  require.resolve('../src/services/openai-transcription.js'),
  require.resolve('../src/services/transcription-runner.js'),
  require.resolve('../src/services/sync-state-service.js'),
  require.resolve('../src/services/providers/google-drive-provider.js'),
  require.resolve('../src/services/providers/onedrive-provider.js'),
  require.resolve('../src/services/sync-runner.js'),
  require.resolve('../src/services/media-service.js'),
  require.resolve('../src/routes/nodes.js'),
  require.resolve('../src/routes/attachments.js'),
  require.resolve('../src/routes/media.js'),
  require.resolve('../src/routes/transcripts.js'),
  require.resolve('../src/routes/settings.js'),
  require.resolve('../src/routes/sync.js'),
  require.resolve('../src/contracts/v1/settings.js'),
  require.resolve('../src/contracts/v1/sync.js'),
  require.resolve('../src/contracts/index.js'),
  require.resolve('../src/server.js'),
];

let app = null;

function createJsonResponse(body, { ok = true, status = 200, headers = {} } = {}) {
  const normalizedHeaders = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [String(key).toLowerCase(), value])
  );

  return {
    ok,
    status,
    headers: {
      get(name) {
        return normalizedHeaders[String(name).toLowerCase()] || null;
      },
    },
    async json() {
      return body;
    },
  };
}

function resetServerModules() {
  modulePaths.forEach((modulePath) => {
    delete require.cache[modulePath];
  });
}

function loadServer(dataRoot) {
  process.env.PRIVANOTE_DATA_DIR = dataRoot;
  resetServerModules();
  return require('../src/server.js');
}

afterEach(async () => {
  if (app) {
    await app.close();
    app = null;
  }

  delete process.env.PRIVANOTE_DATA_DIR;
  resetServerModules();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('google drive sync', () => {
  it('persists a connected provider row through the backend-owned Google callback flow', async () => {
    const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'privanote-google-drive-connect-'));
    const fetchMock = vi.fn(async (url) => {
      const target = String(url);

      if (target === 'https://oauth2.googleapis.com/token') {
        return createJsonResponse({
          access_token: 'google-access',
          refresh_token: 'google-refresh',
          expires_in: 3600,
          scope: 'https://www.googleapis.com/auth/drive.file',
        });
      }

      if (target.includes('/drive/v3/about')) {
        return createJsonResponse({
          user: {
            emailAddress: 'gustavo@example.com',
          },
        });
      }

      if (target.includes('/drive/v3/files?q=')) {
        return createJsonResponse({
          files: [],
        });
      }

      if (target.includes('/drive/v3/files?fields=id,webViewLink')) {
        return createJsonResponse({
          id: 'drive-root-id',
          webViewLink: 'https://drive.google.com/root-folder',
        });
      }

      throw new Error(`Unexpected Google fetch: ${target}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    const { createServer } = loadServer(dataRoot);
    app = await createServer();

    const beginResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/sync/providers/google-drive/connect',
    });

    expect(beginResponse.statusCode).toBe(200);
    expect(beginResponse.json()).toMatchObject({
      provider: 'google-drive',
      connectionStatus: 'pending',
    });
    expect(beginResponse.json().authorizationUrl).toContain('accounts.google.com');
    expect(beginResponse.json().authorizationUrl).toContain('https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fdrive.file');

    const authUrl = new URL(beginResponse.json().authorizationUrl);
    const state = authUrl.searchParams.get('state');

    const callbackResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/sync/providers/google-drive/callback?code=google-code&state=${state}`,
    });

    expect(callbackResponse.statusCode).toBe(200);
    expect(callbackResponse.body).toContain('Connection complete');

    const listResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/sync/providers',
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: 'google-drive',
          connectionStatus: 'connected',
          accountLabel: 'gustavo@example.com',
          rootFolderId: 'drive-root-id',
          rootFolderUrl: 'https://drive.google.com/root-folder',
        }),
      ])
    );

    const syncStateService = require('../src/services/sync-state-service.js');
    expect(syncStateService.getProviderConnection('google-drive', { includeSecrets: true })).toMatchObject({
      connectionStatus: 'connected',
      accessToken: 'google-access',
      refreshToken: 'google-refresh',
      rootFolderId: 'drive-root-id',
    });
  });

  it('keeps attachment sync rows while disconnecting and clearing Google credentials', async () => {
    const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'privanote-google-drive-disconnect-'));
    vi.stubGlobal('fetch', vi.fn(async () => createJsonResponse({ files: [] })));

    const { createServer } = loadServer(dataRoot);
    app = await createServer();

    const db = require('../src/storage/database.js').getDatabase();
    const syncStateService = require('../src/services/sync-state-service.js');

    const nodeId = db
      .prepare(
        `
          INSERT INTO nodes (title, description, tags, updated_at)
          VALUES (?, '', '', CURRENT_TIMESTAMP)
        `
      )
      .run('Google sync note').lastInsertRowid;
    const attachmentPath = path.join(dataRoot, 'attachments', 'file', 'sync-me.txt');
    fs.mkdirSync(path.dirname(attachmentPath), { recursive: true });
    fs.writeFileSync(attachmentPath, 'keep me local');
    const attachmentId = db
      .prepare(
        `
          INSERT INTO attachments (node_id, kind, local_path, cloud_url)
          VALUES (?, 'file', ?, '')
        `
      )
      .run(nodeId, attachmentPath).lastInsertRowid;

    syncStateService.storeProviderConnection({
      provider: 'google-drive',
      connectionStatus: 'connected',
      accountLabel: 'gustavo@example.com',
      accessToken: 'google-access',
      refreshToken: 'google-refresh',
      scope: 'https://www.googleapis.com/auth/drive.file',
      rootFolderId: 'drive-root-id',
      rootFolderUrl: 'https://drive.google.com/root-folder',
      connectedAt: '2026-03-30T00:00:00.000Z',
    });
    syncStateService.markAttachmentSyncQueued({
      attachmentId,
      nodeId,
      provider: 'google-drive',
    });

    const disconnectResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/sync/providers/google-drive/disconnect',
    });

    expect(disconnectResponse.statusCode).toBe(200);
    expect(syncStateService.getAttachmentSync(attachmentId)).toMatchObject({
      attachmentId,
      provider: 'google-drive',
      sync_status: 'failed',
      sync_error: 'Provider disconnected.',
    });
    expect(syncStateService.getProviderConnection('google-drive', { includeSecrets: true })).toMatchObject({
      connectionStatus: 'disconnected',
      accessToken: '',
      refreshToken: '',
    });
  });
});
