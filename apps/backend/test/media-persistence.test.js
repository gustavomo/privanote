const fs = require('fs');
const os = require('os');
const path = require('path');
const FormData = require('form-data');

const modulePaths = [
  require.resolve('../src/storage/attachment-files.js'),
  require.resolve('../src/storage/runtime-paths.js'),
  require.resolve('../src/storage/media-files.js'),
  require.resolve('../src/storage/database.js'),
  require.resolve('../src/services/nodes-service.js'),
  require.resolve('../src/services/attachments-service.js'),
  require.resolve('../src/services/sync-state-service.js'),
  require.resolve('../src/services/providers/google-drive-provider.js'),
  require.resolve('../src/services/providers/onedrive-provider.js'),
  require.resolve('../src/services/sync-runner.js'),
  require.resolve('../src/services/media-service.js'),
  require.resolve('../src/routes/nodes.js'),
  require.resolve('../src/routes/attachments.js'),
  require.resolve('../src/routes/media.js'),
  require.resolve('../src/routes/sync.js'),
  require.resolve('../src/contracts/v1/attachments.js'),
  require.resolve('../src/contracts/v1/media.js'),
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
});

describe('media persistence across backend reopen', () => {
  it('keeps recorded and imported attachments available after recreating the server', async () => {
    const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'privanote-media-persistence-'));
    const importSourcePath = path.join(dataRoot, 'import-source.txt');
    fs.writeFileSync(importSourcePath, 'imported file bytes');

    let serverModule = loadServer(dataRoot);
    app = await serverModule.createServer();

    const form = new FormData();
    form.append('title', 'Audio note - Mar 30, 12:05 AM');
    form.append('captureMode', 'audio');
    form.append('mimeType', 'audio/webm');
    form.append('fileName', 'relaunch-check.webm');
    form.append('file', Buffer.from('recorded bytes'), {
      filename: 'relaunch-check.webm',
      contentType: 'audio/webm',
    });

    const recordingResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/media/recordings',
      headers: form.getHeaders(),
      payload: form.getBuffer(),
    });

    expect(recordingResponse.statusCode).toBe(200);
    const recordingBody = recordingResponse.json();

    const importResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/media/imports',
      headers: {
        'content-type': 'application/json',
      },
      payload: {
        nodeId: recordingBody.node.id,
        kind: 'file',
        sourcePath: importSourcePath,
      },
    });

    expect(importResponse.statusCode).toBe(200);
    expect(fs.existsSync(recordingBody.attachment.local_path)).toBe(true);
    expect(fs.existsSync(importResponse.json().attachment.local_path)).toBe(true);

    await app.close();
    app = null;

    serverModule = loadServer(dataRoot);
    app = await serverModule.createServer();

    const listResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/nodes/${recordingBody.node.id}/attachments`,
    });

    expect(listResponse.statusCode).toBe(200);

    const attachments = listResponse.json();
    expect(attachments).toHaveLength(2);
    expect(attachments.map((attachment) => attachment.kind).sort()).toEqual(['audio', 'file']);
    attachments.forEach((attachment) => {
      expect(attachment.local_path).toContain(path.join(dataRoot, 'attachments'));
      expect(fs.existsSync(attachment.local_path)).toBe(true);
    });
  });
});
