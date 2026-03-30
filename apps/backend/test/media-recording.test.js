const fs = require('fs');
const os = require('os');
const path = require('path');
const FormData = require('form-data');

const modulePaths = [
  require.resolve('../src/storage/attachment-files.js'),
  require.resolve('../src/storage/runtime-paths.js'),
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

describe('v1.media.saveRecording', () => {
  it('stores an unauthenticated multipart recording under the managed data root', async () => {
    const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'privanote-media-recording-'));
    const { createServer } = loadServer(dataRoot);
    app = await createServer();

    const form = new FormData();
    form.append('title', 'Audio note - Mar 29, 10:42 PM');
    form.append('captureMode', 'audio');
    form.append('mimeType', 'audio/webm');
    form.append('fileName', 'voice-note.webm');
    form.append('file', Buffer.from('recorded bytes'), {
      filename: 'voice-note.webm',
      contentType: 'audio/webm',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/media/recordings',
      headers: form.getHeaders(),
      payload: form.getBuffer(),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      node: {
        title: 'Audio note - Mar 29, 10:42 PM',
      },
      attachment: {
        kind: 'audio',
      },
    });

    const body = response.json();
    expect(body.attachment.local_path).toContain(path.join(dataRoot, 'attachments'));
    expect(fs.existsSync(body.attachment.local_path)).toBe(true);
    expect(fs.readFileSync(body.attachment.local_path, 'utf8')).toBe('recorded bytes');
  });
});
