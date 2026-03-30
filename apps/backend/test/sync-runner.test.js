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
  require.resolve('../src/contracts/v1/media.js'),
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

async function waitFor(check, { timeoutMs = 4000, intervalMs = 25 } = {}) {
  const startedAt = Date.now();

  while (Date.now() - startedAt <= timeoutMs) {
    try {
      return await check();
    } catch (error) {
      if (Date.now() - startedAt > timeoutMs) {
        throw error;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error('Timed out waiting for sync runner state.');
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

describe('sync runner', () => {
  it('uses queueAttachmentSync automatically, updates cloud_url, and clears transcript_patch_pending after transcript patching', async () => {
    const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'privanote-sync-runner-success-'));
    const sourcePath = path.join(dataRoot, 'sync-audio.webm');
    fs.writeFileSync(sourcePath, 'audio import bytes');

    const { createServer } = loadServer(dataRoot);
    app = await createServer();

    const settingsService = require('../src/services/settings-service.js');
    const syncStateService = require('../src/services/sync-state-service.js');
    const syncRunner = require('../src/services/sync-runner.js');
    const googleDriveProvider = require('../src/services/providers/google-drive-provider.js');
    expect(typeof syncRunner.queueAttachmentSync).toBe('function');

    syncStateService.storeProviderConnection({
      provider: 'google-drive',
      connectionStatus: 'connected',
      accountLabel: 'gustavo@example.com',
      accessToken: 'google-access',
      refreshToken: 'google-refresh',
      scope: 'https://www.googleapis.com/auth/drive.file',
      rootFolderId: 'drive-root-id',
      rootFolderUrl: 'https://drive.google.com/root-folder',
      connectedAt: '2026-03-30T00:00:00.000Z',
    });
    await settingsService.updateStoredSettings({
      storageDestination: 'google-drive',
      transcriptionMode: 'local',
    });

    const uploadSpy = vi
      .spyOn(googleDriveProvider, 'uploadGoogleMediaBundle')
      .mockResolvedValue({
        rootFolderId: 'drive-root-id',
        rootFolderUrl: 'https://drive.google.com/root-folder',
        noteFolderId: 'drive-note-id',
        noteFolderUrl: 'https://drive.google.com/note-folder',
        remoteMediaItemId: 'drive-media-id',
        remoteTranscriptItemId: '',
        remoteMetadataItemId: 'drive-metadata-id',
        remoteItemUrl: 'https://drive.google.com/media-item',
        transcriptPatchPending: true,
      });
    const patchSpy = vi
      .spyOn(googleDriveProvider, 'patchGoogleTranscriptBundle')
      .mockResolvedValue({
        rootFolderId: 'drive-root-id',
        rootFolderUrl: 'https://drive.google.com/root-folder',
        noteFolderId: 'drive-note-id',
        noteFolderUrl: 'https://drive.google.com/note-folder',
        remoteMediaItemId: 'drive-media-id',
        remoteTranscriptItemId: 'drive-transcript-id',
        remoteMetadataItemId: 'drive-metadata-id',
        remoteItemUrl: 'https://drive.google.com/media-item',
        transcriptPatchPending: false,
      });

    const importResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/media/imports',
      headers: {
        'content-type': 'application/json',
      },
      payload: {
        title: 'Imported audio - Mar 30, 4:00 PM',
        kind: 'audio',
        sourcePath,
      },
    });

    expect(importResponse.statusCode).toBe(200);
    const { attachment, node } = importResponse.json();

    await waitFor(() => {
      const attachments = require('../src/services/attachments-service.js').listAttachments(node.id);
      expect(attachments[0]).toMatchObject({
        id: attachment.id,
        cloud_url: 'https://drive.google.com/media-item',
        sync_status: 'synced',
      });
      return attachments[0];
    });

    await waitFor(() => {
      const sync = syncStateService.getAttachmentSync(attachment.id);
      expect(sync).toMatchObject({
        attachmentId: attachment.id,
        provider: 'google-drive',
        sync_remote_url: 'https://drive.google.com/media-item',
        transcript_patch_pending: false,
      });
      return sync;
    });

    expect(uploadSpy).toHaveBeenCalled();
    expect(patchSpy).toHaveBeenCalled();
  });

  it('fails after exactly three attempts and keeps the local file on disk when Google upload fails', async () => {
    const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'privanote-sync-runner-failure-'));
    const sourcePath = path.join(dataRoot, 'sync-file.txt');
    fs.writeFileSync(sourcePath, 'file import bytes');

    const { createServer } = loadServer(dataRoot);
    app = await createServer();

    const settingsService = require('../src/services/settings-service.js');
    const syncStateService = require('../src/services/sync-state-service.js');
    const googleDriveProvider = require('../src/services/providers/google-drive-provider.js');

    syncStateService.storeProviderConnection({
      provider: 'google-drive',
      connectionStatus: 'connected',
      accountLabel: 'gustavo@example.com',
      accessToken: 'google-access',
      refreshToken: 'google-refresh',
      scope: 'https://www.googleapis.com/auth/drive.file',
      rootFolderId: 'drive-root-id',
      rootFolderUrl: 'https://drive.google.com/root-folder',
      connectedAt: '2026-03-30T00:00:00.000Z',
    });
    await settingsService.updateStoredSettings({
      storageDestination: 'google-drive',
    });

    vi.spyOn(googleDriveProvider, 'uploadGoogleMediaBundle').mockRejectedValue(
      new Error('Google upload failed.')
    );

    const importResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/media/imports',
      headers: {
        'content-type': 'application/json',
      },
      payload: {
        title: 'Imported file - Mar 30, 4:05 PM',
        kind: 'file',
        sourcePath,
      },
    });

    expect(importResponse.statusCode).toBe(200);
    const { attachment } = importResponse.json();

    await waitFor(() => {
      const sync = syncStateService.getAttachmentSync(attachment.id);
      expect(sync).toMatchObject({
        attachmentId: attachment.id,
        sync_status: 'failed',
        attempt_count: 3,
        sync_error: 'Google upload failed.',
      });
      expect(fs.existsSync(attachment.local_path)).toBe(true);
      return sync;
    });
  });
});
