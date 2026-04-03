const fs = require('fs');
const os = require('os');
const path = require('path');

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
  require.resolve('../src/routes/nodes.js'),
  require.resolve('../src/routes/attachments.js'),
  require.resolve('../src/routes/sync.js'),
  require.resolve('../src/contracts/v1/sync.js'),
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
  delete process.env.PRIVANOTE_PR_ANALYSIS;
  resetServerModules();
});

describe('Given PRIVANOTE_PR_ANALYSIS is true', () => {
  let dataRoot;

  beforeEach(() => {
    dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'privanote-analyze-'));
    process.env.PRIVANOTE_PR_ANALYSIS = 'true';
  });

  it('when POST /internal/pr-callback with valid payload then creates note and returns nodeId', async () => {
    const { createServer } = loadServer(dataRoot);
    app = await createServer();

    const response = await app.inject({
      method: 'POST',
      url: '/internal/pr-callback',
      headers: { 'content-type': 'application/json' },
      payload: {
        title: 'PR Analysis: owner/repo#42',
        description: '## Executive Summary\nGreat PR.',
        tags: 'github-analysis',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.nodeId).toBeDefined();
  });

  it('when POST /internal/pr-callback without title then returns 400', async () => {
    const { createServer } = loadServer(dataRoot);
    app = await createServer();

    const response = await app.inject({
      method: 'POST',
      url: '/internal/pr-callback',
      headers: { 'content-type': 'application/json' },
      payload: {
        description: 'Missing title',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe('Title is required');
  });

  it('when analyze routes are registered then POST /api/v1/analyze/pr is available', async () => {
    const { createServer } = loadServer(dataRoot);
    app = await createServer();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/analyze/pr',
      headers: { 'content-type': 'application/json' },
      payload: { url: 'https://github.com/owner/repo/pull/1' },
    });

    // Will get 502 since Python service is not running, but route exists
    expect(response.statusCode).not.toBe(404);
  });
});

describe('Given PRIVANOTE_PR_ANALYSIS is not set', () => {
  it('when requesting /api/v1/analyze/pr then route does not exist', async () => {
    const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'privanote-analyze-'));
    delete process.env.PRIVANOTE_PR_ANALYSIS;

    const { createServer } = loadServer(dataRoot);
    app = await createServer();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/analyze/pr',
      headers: { 'content-type': 'application/json' },
      payload: { url: 'https://github.com/owner/repo/pull/1' },
    });

    expect(response.statusCode).toBe(404);
  });

  it('when requesting /internal/pr-callback then route does not exist', async () => {
    const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'privanote-analyze-'));
    delete process.env.PRIVANOTE_PR_ANALYSIS;

    const { createServer } = loadServer(dataRoot);
    app = await createServer();

    const response = await app.inject({
      method: 'POST',
      url: '/internal/pr-callback',
      headers: { 'content-type': 'application/json' },
      payload: { title: 'test' },
    });

    expect(response.statusCode).toBe(404);
  });
});
