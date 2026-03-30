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

describe('sync destination assignment', () => {
  it('assigns only unsynced unclaimed attachments to the new default provider and preserves already-assigned targets', async () => {
    const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'privanote-sync-destination-'));
    const { createServer } = loadServer(dataRoot);
    app = await createServer();

    const db = require('../src/storage/database.js').getDatabase();
    const settingsService = require('../src/services/settings-service.js');
    const syncStateService = require('../src/services/sync-state-service.js');
    const syncRunner = require('../src/services/sync-runner.js');

    vi.spyOn(syncRunner, 'queueAttachmentSync').mockImplementation(({ attachmentId, provider }) =>
      syncStateService.markAttachmentSyncQueued({
        attachmentId,
        provider,
      })
    );

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
    syncStateService.storeProviderConnection({
      provider: 'onedrive',
      connectionStatus: 'connected',
      accountLabel: 'onedrive@example.com',
      accessToken: 'onedrive-access',
      refreshToken: 'onedrive-refresh',
      rootFolderId: 'onedrive-root',
      rootFolderUrl: 'https://onedrive.live.com/root',
      connectedAt: '2026-03-30T00:00:00.000Z',
    });

    const nodeId = db
      .prepare(
        `
          INSERT INTO nodes (title, description, tags, updated_at)
          VALUES (?, '', '', CURRENT_TIMESTAMP)
        `
      )
      .run('Default switch note').lastInsertRowid;

    function createAttachment(name) {
      const localPath = path.join(dataRoot, 'attachments', 'file', name);
      fs.mkdirSync(path.dirname(localPath), { recursive: true });
      fs.writeFileSync(localPath, name);
      return db
        .prepare(
          `
            INSERT INTO attachments (node_id, kind, local_path, cloud_url)
            VALUES (?, 'file', ?, '')
          `
        )
        .run(nodeId, localPath).lastInsertRowid;
    }

    const unassignedAttachmentId = createAttachment('unassigned.txt');
    const localOnlyAttachmentId = createAttachment('local-only.txt');
    const assignedGoogleAttachmentId = createAttachment('assigned-google.txt');
    const syncedGoogleAttachmentId = createAttachment('synced-google.txt');

    syncStateService.markAttachmentSynced({
      attachmentId: syncedGoogleAttachmentId,
      nodeId,
      provider: 'google-drive',
      remoteNoteFolderId: 'google-note',
      remoteMediaItemId: 'google-media',
      remoteMetadataItemId: 'google-meta',
      remoteItemUrl: 'https://drive.google.com/media',
      transcriptPatchPending: false,
    });
    syncStateService.markAttachmentSyncQueued({
      attachmentId: assignedGoogleAttachmentId,
      nodeId,
      provider: 'google-drive',
    });
    db.prepare(
      `
        INSERT INTO attachment_syncs (
          attachment_id,
          node_id,
          provider,
          status,
          transcript_patch_pending,
          attempt_count,
          last_error
        )
        VALUES (?, ?, '', 'local_only', 0, 0, '')
      `
    ).run(localOnlyAttachmentId, nodeId);

    await settingsService.updateStoredSettings({
      storageDestination: 'google-drive',
    });

    expect(syncStateService.assignUnsyncedAttachmentsToDefaultProvider).toBeDefined();
    expect(syncStateService.getAttachmentSync(unassignedAttachmentId)).toMatchObject({
      provider: 'google-drive',
      sync_status: 'queued',
    });
    expect(syncStateService.getAttachmentSync(localOnlyAttachmentId)).toMatchObject({
      provider: 'google-drive',
      sync_status: 'queued',
    });
    expect(syncStateService.getAttachmentSync(assignedGoogleAttachmentId)).toMatchObject({
      provider: 'google-drive',
      sync_status: 'queued',
    });
    expect(syncStateService.getAttachmentSync(syncedGoogleAttachmentId)).toMatchObject({
      provider: 'google-drive',
      sync_status: 'synced',
    });
    expect(syncRunner.queueAttachmentSync).toHaveBeenCalled();

    const secondUnassignedAttachmentId = createAttachment('second-unassigned.txt');
    db.prepare(
      `
        INSERT INTO attachment_syncs (
          attachment_id,
          node_id,
          provider,
          status,
          transcript_patch_pending,
          attempt_count,
          last_error
        )
        VALUES (?, ?, '', 'local_only', 0, 0, '')
      `
    ).run(secondUnassignedAttachmentId, nodeId);

    await settingsService.updateStoredSettings({
      storageDestination: 'onedrive',
    });

    expect(syncStateService.getAttachmentSync(unassignedAttachmentId)).toMatchObject({
      provider: 'google-drive',
      sync_status: 'queued',
    });
    expect(syncStateService.getAttachmentSync(localOnlyAttachmentId)).toMatchObject({
      provider: 'google-drive',
      sync_status: 'queued',
    });
    expect(syncStateService.getAttachmentSync(secondUnassignedAttachmentId)).toMatchObject({
      provider: 'onedrive',
      sync_status: 'queued',
    });
    expect(syncStateService.getAttachmentSync(syncedGoogleAttachmentId)).toMatchObject({
      provider: 'google-drive',
      sync_status: 'synced',
    });
  });
});
