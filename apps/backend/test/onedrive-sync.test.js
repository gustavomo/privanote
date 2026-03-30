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

function createJsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    headers: {
      get() {
        return null;
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

describe('onedrive sync', () => {
  it('keeps Google and OneDrive connection state side by side in the same runtime root', async () => {
    const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'privanote-onedrive-connect-'));
    const fetchMock = vi.fn(async (url) => {
      const target = String(url);

      if (target.includes('/oauth2/v2.0/token')) {
        return createJsonResponse({
          access_token: 'onedrive-access',
          refresh_token: 'onedrive-refresh',
          expires_in: 3600,
          scope: 'Files.ReadWrite offline_access User.Read',
        });
      }

      if (target.includes('/v1.0/me?$select=')) {
        return createJsonResponse({
          userPrincipalName: 'gustavo@onedrive.test',
        });
      }

      if (target.includes('me/drive/special/approot')) {
        return createJsonResponse({
          id: 'approot-id',
          webUrl: 'https://onedrive.live.com/approot',
        });
      }

      throw new Error(`Unexpected OneDrive fetch: ${target}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    const { createServer } = loadServer(dataRoot);
    app = await createServer();

    const syncStateService = require('../src/services/sync-state-service.js');
    syncStateService.storeProviderConnection({
      provider: 'google-drive',
      connectionStatus: 'connected',
      accountLabel: 'google@example.com',
      accessToken: 'google-access',
      refreshToken: 'google-refresh',
      rootFolderId: 'google-root',
      rootFolderUrl: 'https://drive.google.com/root',
      connectedAt: '2026-03-30T00:00:00.000Z',
    });

    const beginResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/sync/providers/onedrive/connect',
    });

    expect(beginResponse.statusCode).toBe(200);
    const state = new URL(beginResponse.json().authorizationUrl).searchParams.get('state');

    const callbackResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/sync/providers/onedrive/callback?code=onedrive-code&state=${state}`,
    });

    expect(callbackResponse.statusCode).toBe(200);
    const providers = syncStateService.listProviderConnections({ includeSecrets: true });
    expect(providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: 'google-drive',
          connectionStatus: 'connected',
          accessToken: 'google-access',
        }),
        expect.objectContaining({
          provider: 'onedrive',
          connectionStatus: 'connected',
          accountLabel: 'gustavo@onedrive.test',
          rootFolderId: 'approot-id',
        }),
      ])
    );
  });

  it('uses me/drive/special/approot, createUploadSession, and transcript metadata patching for OneDrive uploads', async () => {
    const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'privanote-onedrive-upload-'));
    const attachmentPath = path.join(dataRoot, 'large-video.webm');
    fs.writeFileSync(attachmentPath, Buffer.alloc(11 * 1024 * 1024, 7));

    const { createServer } = loadServer(dataRoot);
    app = await createServer();

    const oneDriveProvider = require('../src/services/providers/onedrive-provider.js');
    const requests = [];
    vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
      const target = String(url);
      requests.push(target);

      if (target.includes('me/drive/special/approot')) {
        return createJsonResponse({
          id: 'approot-id',
          webUrl: 'https://onedrive.live.com/approot',
        });
      }

      if (target.includes('/items/approot-id/children?$select=')) {
        return createJsonResponse({
          value: [],
        });
      }

      if (target.includes('/items/approot-id/children') && options.method === 'POST') {
        return createJsonResponse({
          id: 'note-folder-id',
          webUrl: 'https://onedrive.live.com/note-folder',
        });
      }

      if (target.includes('/createUploadSession')) {
        return createJsonResponse({
          uploadUrl: 'https://upload.onedrive.test/session',
        });
      }

      if (target === 'https://upload.onedrive.test/session') {
        const contentRange = options.headers['Content-Range'];
        if (contentRange.startsWith('bytes 0-')) {
          return createJsonResponse(
            {
              nextExpectedRanges: ['5242880-'],
            },
            { status: 202 }
          );
        }

        if (contentRange.startsWith('bytes 5242880-')) {
          return createJsonResponse(
            {
              nextExpectedRanges: ['10485760-'],
            },
            { status: 202 }
          );
        }

        return createJsonResponse({
          id: 'onedrive-media-id',
          webUrl: 'https://onedrive.live.com/media-item',
        });
      }

      if (target.includes('transcript.txt')) {
        return createJsonResponse({
          id: 'onedrive-transcript-id',
          webUrl: 'https://onedrive.live.com/transcript',
        });
      }

      if (target.includes('privanote.json')) {
        return createJsonResponse({
          id: 'onedrive-metadata-id',
          webUrl: 'https://onedrive.live.com/metadata',
        });
      }

      if (target.includes('/items/onedrive-transcript-id/content')) {
        return createJsonResponse({
          id: 'onedrive-transcript-id',
          webUrl: 'https://onedrive.live.com/transcript',
        });
      }

      if (target.includes('/items/onedrive-metadata-id/content')) {
        return createJsonResponse({
          id: 'onedrive-metadata-id',
          webUrl: 'https://onedrive.live.com/metadata',
        });
      }

      throw new Error(`Unexpected OneDrive upload fetch: ${target}`);
    }));

    const connection = {
      accessToken: 'onedrive-access',
      refreshToken: 'onedrive-refresh',
      accountLabel: 'gustavo@onedrive.test',
      rootFolderId: '',
      rootFolderUrl: '',
    };
    const attachment = {
      id: 9,
      node_id: 2,
      kind: 'video',
      local_path: attachmentPath,
    };
    const node = {
      id: 2,
      title: 'OneDrive note',
    };

    const uploadOneDriveMediaBundle = oneDriveProvider.uploadOneDriveMediaBundle;
    const uploadResult = await uploadOneDriveMediaBundle({
      connection,
      attachment,
      node,
      transcript: {
        status: 'succeeded',
        text: 'First transcript',
        updated_at: '2026-03-30T00:00:00.000Z',
      },
      sync: {},
    });

    expect(uploadResult).toMatchObject({
      noteFolderId: 'note-folder-id',
      remoteMediaItemId: 'onedrive-media-id',
      remoteTranscriptItemId: 'onedrive-transcript-id',
      remoteMetadataItemId: 'onedrive-metadata-id',
      transcriptPatchPending: false,
    });

    const patchResult = await oneDriveProvider.patchOneDriveTranscriptBundle({
      connection: {
        ...connection,
        rootFolderId: 'approot-id',
        rootFolderUrl: 'https://onedrive.live.com/approot',
      },
      attachment,
      node,
      transcript: {
        status: 'succeeded',
        text: 'Updated transcript',
        updated_at: '2026-03-30T00:10:00.000Z',
      },
      sync: {
        remoteNoteFolderId: 'note-folder-id',
        remoteMediaItemId: 'onedrive-media-id',
        remoteTranscriptItemId: 'onedrive-transcript-id',
        remoteMetadataItemId: 'onedrive-metadata-id',
        sync_remote_url: 'https://onedrive.live.com/media-item',
      },
    });

    expect(patchResult).toMatchObject({
      remoteMediaItemId: 'onedrive-media-id',
      remoteTranscriptItemId: 'onedrive-transcript-id',
      remoteMetadataItemId: 'onedrive-metadata-id',
      transcriptPatchPending: false,
    });
    expect(requests.some((url) => url.includes('me/drive/special/approot'))).toBe(true);
    expect(requests.some((url) => url.includes('createUploadSession'))).toBe(true);
    expect(oneDriveProvider.oneDriveChunkAlignment).toBe(320 * 1024);
  });
});
