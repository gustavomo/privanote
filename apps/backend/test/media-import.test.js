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
  require.resolve('../src/services/media-service.js'),
  require.resolve('../src/routes/nodes.js'),
  require.resolve('../src/routes/attachments.js'),
  require.resolve('../src/routes/media.js'),
  require.resolve('../src/contracts/v1/media.js'),
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

describe('v1.media.importMedia', () => {
  it('imports into an existing note and auto-creates a note when none is selected', async () => {
    const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'privanote-media-import-'));
    const existingSourcePath = path.join(dataRoot, 'existing-audio.wav');
    const newSourcePath = path.join(dataRoot, 'orphan-video.webm');
    fs.writeFileSync(existingSourcePath, 'existing import bytes');
    fs.writeFileSync(newSourcePath, 'video import bytes');

    const { createServer } = loadServer(dataRoot);
    app = await createServer();

    const createNodeResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/nodes',
      headers: {
        'content-type': 'application/json',
      },
      payload: {
        title: 'Existing import note',
      },
    });

    const existingNode = createNodeResponse.json();

    const existingImportResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/media/imports',
      headers: {
        'content-type': 'application/json',
      },
      payload: {
        nodeId: existingNode.id,
        kind: 'audio',
        sourcePath: existingSourcePath,
      },
    });

    expect(existingImportResponse.statusCode).toBe(200);
    expect(existingImportResponse.json()).toMatchObject({
      node: {
        id: existingNode.id,
      },
      attachment: {
        kind: 'audio',
      },
    });
    expect(existingImportResponse.json().attachment.local_path).toContain(
      path.join(dataRoot, 'attachments', 'audio')
    );

    const autoCreateResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/media/imports',
      headers: {
        'content-type': 'application/json',
      },
      payload: {
        title: 'Imported media - Mar 29, 10:42 PM',
        kind: 'video',
        sourcePath: newSourcePath,
      },
    });

    expect(autoCreateResponse.statusCode).toBe(200);
    expect(autoCreateResponse.json()).toMatchObject({
      node: {
        title: 'Imported media - Mar 29, 10:42 PM',
      },
      attachment: {
        kind: 'video',
      },
    });
    expect(autoCreateResponse.json().attachment.local_path).toContain(
      path.join(dataRoot, 'attachments', 'video')
    );
    expect(fs.readFileSync(existingSourcePath, 'utf8')).toBe('existing import bytes');
    expect(fs.readFileSync(newSourcePath, 'utf8')).toBe('video import bytes');
  });
});
