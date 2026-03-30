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
  require.resolve('../src/services/media-service.js'),
  require.resolve('../src/routes/nodes.js'),
  require.resolve('../src/routes/attachments.js'),
  require.resolve('../src/routes/media.js'),
  require.resolve('../src/routes/transcripts.js'),
  require.resolve('../src/routes/settings.js'),
  require.resolve('../src/contracts/v1/settings.js'),
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
});

describe('settings persistence', () => {
  it('persists settings across backend recreation and applies the future local media directory only to new imports', async () => {
    const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'privanote-settings-persistence-'));
    const initialSourcePath = path.join(dataRoot, 'initial-file.txt');
    const futureSourcePath = path.join(dataRoot, 'future-file.txt');
    const futureLocalMediaDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'privanote-future-local-media-')
    );

    fs.writeFileSync(initialSourcePath, 'initial bytes');
    fs.writeFileSync(futureSourcePath, 'future bytes');

    let serverModule = loadServer(dataRoot);
    app = await serverModule.createServer();

    const initialImportResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/media/imports',
      headers: {
        'content-type': 'application/json',
      },
      payload: {
        title: 'Imported file - Mar 30, 10:25 AM',
        kind: 'file',
        sourcePath: initialSourcePath,
      },
    });

    expect(initialImportResponse.statusCode).toBe(200);
    const initialAttachment = initialImportResponse.json().attachment;
    expect(initialAttachment.local_path).toContain(path.join(dataRoot, 'attachments', 'file'));

    const updateSettingsResponse = await app.inject({
      method: 'PUT',
      url: '/api/v1/settings',
      headers: {
        'content-type': 'application/json',
      },
      payload: {
        storageDestination: 'local',
        localMediaDirectory: futureLocalMediaDirectory,
        transcriptionMode: 'local',
      },
    });

    expect(updateSettingsResponse.statusCode).toBe(200);
    expect(updateSettingsResponse.json()).toMatchObject({
      storageDestination: 'local',
      localMediaDirectory: futureLocalMediaDirectory,
      transcriptionMode: 'local',
    });

    await app.close();
    app = null;

    serverModule = loadServer(dataRoot);
    app = await serverModule.createServer();

    const getSettingsResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/settings',
    });

    expect(getSettingsResponse.statusCode).toBe(200);
    expect(getSettingsResponse.json()).toMatchObject({
      storageDestination: 'local',
      localMediaDirectory: futureLocalMediaDirectory,
      transcriptionMode: 'local',
    });

    const futureImportResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/media/imports',
      headers: {
        'content-type': 'application/json',
      },
      payload: {
        title: 'Imported file - Mar 30, 10:27 AM',
        kind: 'file',
        sourcePath: futureSourcePath,
      },
    });

    expect(futureImportResponse.statusCode).toBe(200);
    expect(futureImportResponse.json().attachment.local_path).toContain(
      path.join(futureLocalMediaDirectory, 'attachments', 'file')
    );
    expect(initialAttachment.local_path).toContain(path.join(dataRoot, 'attachments', 'file'));
    expect(fs.existsSync(initialAttachment.local_path)).toBe(true);
    expect(fs.existsSync(futureImportResponse.json().attachment.local_path)).toBe(true);
  });
});
