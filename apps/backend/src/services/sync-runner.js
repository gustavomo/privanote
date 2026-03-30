const { getDatabase } = require('../storage/database');
const syncStateService = require('./sync-state-service');
const googleDriveProvider = require('./providers/google-drive-provider');
const oneDriveProvider = require('./providers/onedrive-provider');

const maxSyncAttempts = 3;

const runnerState = {
  started: false,
  queuedAttachmentIds: new Set(),
  activeAttachmentIds: new Set(),
  scheduled: false,
};

function resetSyncQueueState() {
  runnerState.started = false;
  runnerState.queuedAttachmentIds.clear();
  runnerState.activeAttachmentIds.clear();
  runnerState.scheduled = false;
}

function resolveProviderAdapter(provider) {
  if (provider === 'google-drive') {
    return googleDriveProvider;
  }

  if (provider === 'onedrive') {
    return oneDriveProvider;
  }

  throw new Error('Sync provider must be google-drive or onedrive');
}

function readSyncContext(attachmentId) {
  const row = getDatabase()
    .prepare(
      `
        SELECT
          a.id AS attachment_id,
          a.node_id AS node_id,
          a.kind AS attachment_kind,
          a.local_path AS local_path,
          a.cloud_url AS cloud_url,
          a.created_at AS attachment_created_at,
          n.title AS node_title,
          n.description AS node_description,
          n.tags AS node_tags,
          n.created_at AS node_created_at,
          n.updated_at AS node_updated_at,
          t.status AS transcript_status,
          t.text AS transcript_text,
          t.updated_at AS transcript_updated_at
        FROM attachments a
        INNER JOIN nodes n ON n.id = a.node_id
        LEFT JOIN transcripts t ON t.attachment_id = a.id
        WHERE a.id = ?
      `
    )
    .get(attachmentId);

  if (!row) {
    const error = new Error('Attachment not found');
    error.statusCode = 404;
    throw error;
  }

  return {
    attachment: {
      id: row.attachment_id,
      node_id: row.node_id,
      kind: row.attachment_kind,
      local_path: row.local_path,
      cloud_url: row.cloud_url,
      created_at: row.attachment_created_at,
    },
    node: {
      id: row.node_id,
      title: row.node_title,
      description: row.node_description,
      tags: row.node_tags,
      created_at: row.node_created_at,
      updated_at: row.node_updated_at,
    },
    transcript: row.transcript_status
      ? {
          status: row.transcript_status,
          text: row.transcript_text,
          updated_at: row.transcript_updated_at,
        }
      : null,
  };
}

function updateAttachmentCloudUrl(attachmentId, cloudUrl) {
  getDatabase()
    .prepare(
      `
        UPDATE attachments
        SET cloud_url = ?,
            created_at = created_at
        WHERE id = ?
      `
    )
    .run(String(cloudUrl || '').trim(), Number(attachmentId));
}

async function ensureActiveConnection(sync) {
  const connection = syncStateService.getProviderConnection(sync.provider, { includeSecrets: true });
  if (connection.connectionStatus !== 'connected' || !connection.accessToken) {
    throw new Error('Provider connection is not ready.');
  }

  if (connection.expiresAt && Date.parse(connection.expiresAt) <= Date.now() && connection.refreshToken) {
    const adapter = resolveProviderAdapter(sync.provider);
    const refreshed = await adapter.refreshGoogleConnection?.(connection);
    const nextConnection =
      refreshed ||
      (await adapter.refreshOneDriveConnection?.(connection)) || {
        ...connection,
      };

    return syncStateService.storeProviderConnection({
      provider: sync.provider,
      connectionStatus: 'connected',
      accountLabel: nextConnection.accountLabel || connection.accountLabel,
      accessToken: nextConnection.accessToken || connection.accessToken,
      refreshToken: nextConnection.refreshToken || connection.refreshToken,
      expiresAt: nextConnection.expiresAt || connection.expiresAt,
      scope: nextConnection.scope || connection.scope,
      rootFolderId: nextConnection.rootFolderId || connection.rootFolderId,
      rootFolderUrl: nextConnection.rootFolderUrl || connection.rootFolderUrl,
      connectedAt: connection.connectedAt,
    });
  }

  return connection;
}

function shouldPatchTranscript(sync, transcript) {
  if (!sync.remoteMediaItemId) {
    return false;
  }

  if (transcript?.status !== 'succeeded') {
    return false;
  }

  return (
    sync.transcriptPatchPending ||
    !sync.remoteTranscriptItemId ||
    !sync.remoteMetadataItemId ||
    sync.status === 'failed'
  );
}

async function performSync(attachmentId) {
  const sync = syncStateService.getAttachmentSync(attachmentId);
  if (!sync || !sync.provider) {
    return null;
  }

  const { attachment, node, transcript } = readSyncContext(attachmentId);
  const connection = await ensureActiveConnection(sync);
  const adapter = resolveProviderAdapter(sync.provider);

  if (shouldPatchTranscript(sync, transcript)) {
    const result =
      sync.provider === 'google-drive'
        ? await adapter.patchGoogleTranscriptBundle({ connection, attachment, node, transcript, sync })
        : await adapter.patchOneDriveTranscriptBundle({ connection, attachment, node, transcript, sync });

    return syncStateService.markAttachmentSynced({
      attachmentId,
      nodeId: attachment.node_id,
      provider: sync.provider,
      remoteNoteFolderId: result.noteFolderId,
      remoteMediaItemId: result.remoteMediaItemId,
      remoteTranscriptItemId: result.remoteTranscriptItemId,
      remoteMetadataItemId: result.remoteMetadataItemId,
      remoteItemUrl: result.remoteItemUrl,
      transcriptPatchPending: result.transcriptPatchPending,
      attemptCount: sync.attemptCount,
    });
  }

  if (sync.remoteMediaItemId && sync.transcriptPatchPending && transcript?.status !== 'succeeded') {
    return sync;
  }

  const result =
    sync.provider === 'google-drive'
      ? await adapter.uploadGoogleMediaBundle({ connection, attachment, node, transcript, sync })
      : await adapter.uploadOneDriveMediaBundle({ connection, attachment, node, transcript, sync });

  updateAttachmentCloudUrl(attachmentId, result.remoteItemUrl);

  if (result.rootFolderId || result.rootFolderUrl) {
    syncStateService.storeProviderConnection({
      provider: sync.provider,
      connectionStatus: 'connected',
      accountLabel: connection.accountLabel,
      accessToken: connection.accessToken,
      refreshToken: connection.refreshToken,
      expiresAt: connection.expiresAt,
      scope: connection.scope,
      rootFolderId: result.rootFolderId || connection.rootFolderId,
      rootFolderUrl: result.rootFolderUrl || connection.rootFolderUrl,
      connectedAt: connection.connectedAt,
    });
  }

  return syncStateService.markAttachmentSynced({
    attachmentId,
    nodeId: attachment.node_id,
    provider: sync.provider,
    remoteNoteFolderId: result.noteFolderId,
    remoteMediaItemId: result.remoteMediaItemId,
    remoteTranscriptItemId: result.remoteTranscriptItemId,
    remoteMetadataItemId: result.remoteMetadataItemId,
    remoteItemUrl: result.remoteItemUrl,
    transcriptPatchPending: result.transcriptPatchPending,
    attemptCount: sync.attemptCount,
  });
}

async function runSyncAttempt(attachmentId) {
  const existing = syncStateService.getAttachmentSync(attachmentId);
  if (!existing || !existing.provider) {
    return null;
  }

  const context = readSyncContext(attachmentId);
  if (existing.remoteMediaItemId && existing.transcriptPatchPending && context.transcript?.status !== 'succeeded') {
    return existing;
  }

  syncStateService.markAttachmentSyncing(attachmentId);

  try {
    return await performSync(attachmentId);
  } catch (error) {
    const nextAttemptCount = Number(existing.attemptCount || 0) + 1;

    if (nextAttemptCount >= maxSyncAttempts) {
      return syncStateService.markAttachmentSyncFailed({
        attachmentId,
        attemptCount: nextAttemptCount,
        lastError: error.message || 'Cloud sync failed.',
        transcriptPatchPending: existing.transcriptPatchPending,
      });
    }

    syncStateService.markAttachmentSyncQueued({
      attachmentId,
      nodeId: existing.nodeId,
      provider: existing.provider,
      attemptCount: nextAttemptCount,
      lastError: error.message || 'Cloud sync failed.',
    });

    runnerState.queuedAttachmentIds.add(Number(attachmentId));
    scheduleQueueDrain();
    return syncStateService.getAttachmentSync(attachmentId);
  }
}

async function drainQueue() {
  if (!runnerState.started) {
    runnerState.scheduled = false;
    return;
  }

  const [attachmentId] = runnerState.queuedAttachmentIds;
  if (attachmentId === undefined) {
    runnerState.scheduled = false;
    return;
  }

  runnerState.queuedAttachmentIds.delete(attachmentId);

  if (runnerState.activeAttachmentIds.has(attachmentId)) {
    runnerState.scheduled = false;
    if (runnerState.queuedAttachmentIds.size > 0) {
      scheduleQueueDrain();
    }
    return;
  }

  runnerState.activeAttachmentIds.add(attachmentId);

  try {
    await runSyncAttempt(attachmentId);
  } finally {
    runnerState.activeAttachmentIds.delete(attachmentId);
    runnerState.scheduled = false;

    if (runnerState.started && runnerState.queuedAttachmentIds.size > 0) {
      scheduleQueueDrain();
    }
  }
}

function scheduleQueueDrain() {
  if (!runnerState.started || runnerState.scheduled) {
    return;
  }

  runnerState.scheduled = true;
  queueMicrotask(() => {
    drainQueue().catch(() => {
      runnerState.scheduled = false;
    });
  });
}

function startSyncRunner() {
  runnerState.started = true;
  scheduleQueueDrain();
}

function stopSyncRunner() {
  resetSyncQueueState();
}

function queueAttachmentSync({ attachmentId, provider }) {
  const existing = syncStateService.getAttachmentSync(attachmentId);
  const nextProvider = provider || existing?.provider || '';
  if (!nextProvider) {
    return null;
  }

  const sync = syncStateService.markAttachmentSyncQueued({
    attachmentId,
    nodeId: existing?.nodeId,
    provider: nextProvider,
    attemptCount: existing?.status === 'failed' ? 0 : existing?.attemptCount || 0,
    lastError: '',
  });

  runnerState.queuedAttachmentIds.add(Number(attachmentId));
  startSyncRunner();
  return sync;
}

function queueTranscriptSyncPatch({ attachmentId }) {
  const sync = syncStateService.getAttachmentSync(attachmentId);
  if (!sync || !sync.provider) {
    return null;
  }

  syncStateService.markTranscriptPatchPending(attachmentId, true);
  runnerState.queuedAttachmentIds.add(Number(attachmentId));
  startSyncRunner();
  return syncStateService.getAttachmentSync(attachmentId);
}

function retryAttachmentSync(attachmentId) {
  const sync = syncStateService.getAttachmentSync(attachmentId);
  if (!sync) {
    const error = new Error('Attachment sync not found');
    error.statusCode = 404;
    throw error;
  }

  return queueAttachmentSync({
    attachmentId: sync.attachmentId,
    provider: sync.provider,
  });
}

function resumePendingSyncJobs() {
  startSyncRunner();

  syncStateService.listPendingAttachmentSyncs().forEach((sync) => {
    if (sync.provider) {
      runnerState.queuedAttachmentIds.add(sync.attachmentId);
    }
  });

  scheduleQueueDrain();
}

module.exports = {
  maxSyncAttempts,
  startSyncRunner,
  stopSyncRunner,
  queueAttachmentSync,
  queueTranscriptSyncPatch,
  retryAttachmentSync,
  resumePendingSyncJobs,
  resolveProviderAdapter,
  resetSyncQueueState,
};
