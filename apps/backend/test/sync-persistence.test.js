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
  require.resolve('../src/contracts/v1/attachments.js'),
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

describe('sync persistence', () => {
  it('keeps sync_status, sync_provider, and transcript_patch_pending in attachment reads after backend relaunch', async () => {
    const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'privanote-sync-persistence-'));
    let serverModule = loadServer(dataRoot);
    app = await serverModule.createServer();

    const db = require('../src/storage/database.js').getDatabase();
    const nodeId = db
      .prepare(
        `
          INSERT INTO nodes (title, description, tags, updated_at)
          VALUES (?, '', '', CURRENT_TIMESTAMP)
        `
      )
      .run('Persisted sync note').lastInsertRowid;
    const attachmentPath = path.join(dataRoot, 'attachments', 'audio', 'persisted-audio.webm');
    fs.mkdirSync(path.dirname(attachmentPath), { recursive: true });
    fs.writeFileSync(attachmentPath, 'persisted bytes');
    const attachmentId = db
      .prepare(
        `
          INSERT INTO attachments (node_id, kind, local_path, cloud_url)
          VALUES (?, 'audio', ?, 'https://drive.google.com/media-item')
        `
      )
      .run(nodeId, attachmentPath).lastInsertRowid;

    db.prepare(
      `
        INSERT INTO attachment_syncs (
          attachment_id,
          node_id,
          provider,
          status,
          remote_note_folder_id,
          remote_media_item_id,
          remote_metadata_item_id,
          remote_item_url,
          transcript_patch_pending,
          attempt_count,
          last_error,
          queued_at,
          synced_at
        )
        VALUES (?, ?, 'google-drive', 'synced', 'note-folder', 'media-item', 'metadata-item', ?, 1, 1, '', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `
    ).run(attachmentId, nodeId, 'https://drive.google.com/media-item');

    await app.close();
    app = null;

    serverModule = loadServer(dataRoot);
    app = await serverModule.createServer();

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/nodes/${nodeId}/attachments`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: attachmentId,
          sync_status: 'synced',
          sync_provider: 'google-drive',
          transcript_patch_pending: 1,
        }),
      ])
    );
  });
});
