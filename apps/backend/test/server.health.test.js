const fs = require('fs');
const os = require('os');
const path = require('path');

const modulePaths = [
  require.resolve('../src/storage/attachment-files.js'),
  require.resolve('../src/storage/runtime-paths.js'),
  require.resolve('../src/storage/database.js'),
  require.resolve('../src/services/nodes-service.js'),
  require.resolve('../src/services/attachments-service.js'),
  require.resolve('../src/routes/nodes.js'),
  require.resolve('../src/routes/attachments.js'),
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

describe('backend server startup', () => {
  it('serves health and v1 note routes without auth headers or credentials', async () => {
    const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'privanote-server-'));
    const { createServer } = loadServer(dataRoot);

    app = await createServer();

    const healthResponse = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(healthResponse.statusCode).toBe(200);
    expect(healthResponse.json()).toEqual({ status: 'ok' });

    const createNodeResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/nodes',
      headers: {
        'content-type': 'application/json',
      },
      payload: {
        title: 'No auth note',
        description: 'Still local first.',
        tags: 'phase-1',
      },
    });

    expect(createNodeResponse.statusCode).toBe(200);
    expect(createNodeResponse.json()).toMatchObject({
      title: 'No auth note',
    });

    const createdNode = createNodeResponse.json();

    const attachmentResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/nodes/${createdNode.id}/attachments`,
      headers: {
        'content-type': 'application/json',
      },
      payload: {
        kind: 'file',
        localPath: path.join(dataRoot, 'note.txt'),
      },
    });

    expect(attachmentResponse.statusCode).toBe(200);
    expect(attachmentResponse.json()).toMatchObject({
      node_id: createdNode.id,
      kind: 'file',
    });

    const nodesResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/nodes',
    });

    expect(nodesResponse.statusCode).toBe(200);
    expect(nodesResponse.json()).toHaveLength(1);

    const attachmentsResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/nodes/${createdNode.id}/attachments`,
    });

    expect(attachmentsResponse.statusCode).toBe(200);
    expect(attachmentsResponse.json()).toHaveLength(1);
  });
});
