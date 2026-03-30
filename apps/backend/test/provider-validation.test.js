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
  require.resolve('../src/services/openai-transcription.js'),
  require.resolve('../src/services/transcription-runner.js'),
  require.resolve('../src/services/sync-state-service.js'),
  require.resolve('../src/services/providers/google-drive-provider.js'),
  require.resolve('../src/services/providers/onedrive-provider.js'),
  require.resolve('../src/services/sync-runner.js'),
  require.resolve('../src/routes/settings.js'),
  require.resolve('../src/routes/sync.js'),
  require.resolve('../src/contracts/v1/settings.js'),
  require.resolve('../src/contracts/v1/sync.js'),
  require.resolve('../src/contracts/index.js'),
  require.resolve('../src/server.js'),
];

let app = null;

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

describe('provider validation', () => {
  it('rejects an invalid OpenAI key when saving backend transcription settings', async () => {
    const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'privanote-provider-validation-'));
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 401,
        json: async () => ({
          error: {
            message: 'bad key',
          },
        }),
      }))
    );

    const { createServer } = loadServer(dataRoot);
    app = await createServer();

    const response = await app.inject({
      method: 'PUT',
      url: '/api/v1/settings',
      headers: {
        'content-type': 'application/json',
      },
      payload: {
        storageDestination: 'local',
        localMediaDirectory: '',
        transcriptionMode: 'backend',
        providerKind: 'openai',
        backendApiKey: 'sk-invalid',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: 'OpenAI API key is invalid.',
    });
  });

  it('persists a masked provider state and clears the stored key on request', async () => {
    const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'privanote-provider-masking-'));
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ data: [] }),
      }))
    );

    const { createServer } = loadServer(dataRoot);
    app = await createServer();

    const saveResponse = await app.inject({
      method: 'PUT',
      url: '/api/v1/settings',
      headers: {
        'content-type': 'application/json',
      },
      payload: {
        transcriptionMode: 'backend',
        providerKind: 'openai',
        backendApiKey: 'sk-test-1234',
      },
    });

    expect(saveResponse.statusCode).toBe(200);
    expect(saveResponse.json()).toMatchObject({
      transcriptionMode: 'backend',
      providerKind: 'openai',
      backendApiKeyConfigured: true,
      backendApiKeyMaskedHint: '••••1234',
    });
    expect(saveResponse.json().backendApiKey).toBeUndefined();

    const readResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/settings',
    });

    expect(readResponse.statusCode).toBe(200);
    expect(readResponse.json()).toMatchObject({
      backendApiKeyConfigured: true,
      backendApiKeyMaskedHint: '••••1234',
    });

    const clearResponse = await app.inject({
      method: 'PUT',
      url: '/api/v1/settings',
      headers: {
        'content-type': 'application/json',
      },
      payload: {
        clearBackendApiKey: true,
      },
    });

    expect(clearResponse.statusCode).toBe(200);
    expect(clearResponse.json()).toMatchObject({
      providerKind: 'openai',
      backendApiKeyConfigured: false,
      backendApiKeyMaskedHint: '',
    });
  });
});
