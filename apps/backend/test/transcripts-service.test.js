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
  require.resolve('../src/services/sync-state-service.js'),
  require.resolve('../src/services/providers/google-drive-provider.js'),
  require.resolve('../src/services/providers/onedrive-provider.js'),
  require.resolve('../src/services/sync-runner.js'),
  require.resolve('../src/routes/nodes.js'),
  require.resolve('../src/routes/attachments.js'),
  require.resolve('../src/routes/media.js'),
  require.resolve('../src/routes/transcripts.js'),
  require.resolve('../src/routes/sync.js'),
  require.resolve('../src/contracts/v1/attachments.js'),
  require.resolve('../src/contracts/v1/transcripts.js'),
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

describe('transcripts and settings foundations', () => {
  it('replaces transcript rows per note, exposes settings defaults, and retrieves the note transcript', async () => {
    const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'privanote-transcripts-service-'));
    const attachmentRoot = path.join(dataRoot, 'attachments', 'audio');
    fs.mkdirSync(attachmentRoot, { recursive: true });

    const { createServer } = loadServer(dataRoot);
    app = await createServer();

    const settingsService = require('../src/services/settings-service.js');
    const transcriptsService = require('../src/services/transcripts-service.js');

    expect(settingsService.getSettings()).toMatchObject({
      storageDestination: 'local',
      localMediaDirectory: '',
      transcriptionMode: 'local',
      providerKind: 'openai',
      backendApiKeyConfigured: false,
      backendApiKeyMaskedHint: '',
      localRuntimeStatus: 'not-ready',
    });

    const createNodeResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/nodes',
      headers: {
        'content-type': 'application/json',
      },
      payload: {
        title: 'Transcript note',
      },
    });

    expect(createNodeResponse.statusCode).toBe(200);
    const node = createNodeResponse.json();

    const firstAttachmentPath = path.join(attachmentRoot, 'first-audio.webm');
    const secondAttachmentPath = path.join(attachmentRoot, 'second-audio.webm');
    fs.writeFileSync(firstAttachmentPath, 'first audio');
    fs.writeFileSync(secondAttachmentPath, 'second audio');

    const firstAttachmentResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/nodes/${node.id}/attachments`,
      headers: {
        'content-type': 'application/json',
      },
      payload: {
        kind: 'audio',
        localPath: firstAttachmentPath,
      },
    });

    expect(firstAttachmentResponse.statusCode).toBe(200);
    const firstAttachment = firstAttachmentResponse.json();

    transcriptsService.markTranscriptQueued({
      nodeId: node.id,
      attachmentId: firstAttachment.id,
      mode: 'local',
      provider: '',
    });

    expect(transcriptsService.getNoteTranscript(node.id)).toMatchObject({
      node_id: node.id,
      attachment_id: firstAttachment.id,
      status: 'queued',
      mode: 'local',
    });

    const secondAttachmentResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/nodes/${node.id}/attachments`,
      headers: {
        'content-type': 'application/json',
      },
      payload: {
        kind: 'audio',
        localPath: secondAttachmentPath,
      },
    });

    expect(secondAttachmentResponse.statusCode).toBe(200);
    const secondAttachment = secondAttachmentResponse.json();

    const replacedTranscript = transcriptsService.upsertTranscriptRecord({
      nodeId: node.id,
      attachmentId: secondAttachment.id,
      status: 'succeeded',
      text: 'Transcript for the latest attachment',
      mode: 'backend',
      provider: 'openai',
      attemptCount: 1,
      completedAt: '2026-03-30T12:00:00.000Z',
    });

    expect(replacedTranscript).toMatchObject({
      node_id: node.id,
      attachment_id: secondAttachment.id,
      status: 'succeeded',
      text: 'Transcript for the latest attachment',
      mode: 'backend',
      provider: 'openai',
      attempt_count: 1,
    });

    const transcriptResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/nodes/${node.id}/transcript`,
    });

    expect(transcriptResponse.statusCode).toBe(200);
    expect(transcriptResponse.json()).toMatchObject({
      node_id: node.id,
      attachment_id: secondAttachment.id,
      text: 'Transcript for the latest attachment',
      provider: 'openai',
    });
  });
});
