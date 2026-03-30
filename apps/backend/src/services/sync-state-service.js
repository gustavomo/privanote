const { getDatabase } = require('../storage/database');

const validProviders = new Set(['google-drive', 'onedrive']);
const validConnectionStatuses = new Set(['disconnected', 'pending', 'connected', 'error']);
const validSyncStatuses = new Set(['local_only', 'queued', 'syncing', 'synced', 'failed']);
const allProviders = ['google-drive', 'onedrive'];

function createHttpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeProvider(provider) {
  const safeProvider = String(provider || '').trim();
  if (!validProviders.has(safeProvider)) {
    throw createHttpError('Provider must be google-drive or onedrive');
  }

  return safeProvider;
}

function normalizeAttachmentId(attachmentId) {
  const safeAttachmentId = Number(attachmentId);
  if (!Number.isInteger(safeAttachmentId) || safeAttachmentId <= 0) {
    throw createHttpError('A valid attachment id is required');
  }

  return safeAttachmentId;
}

function normalizeNodeId(nodeId) {
  const safeNodeId = Number(nodeId);
  if (!Number.isInteger(safeNodeId) || safeNodeId <= 0) {
    throw createHttpError('A valid node id is required');
  }

  return safeNodeId;
}

function normalizeConnectionStatus(connectionStatus) {
  const safeConnectionStatus = String(connectionStatus || '').trim() || 'disconnected';
  if (!validConnectionStatuses.has(safeConnectionStatus)) {
    throw createHttpError('Connection status must be disconnected, pending, connected, or error');
  }

  return safeConnectionStatus;
}

function normalizeSyncStatus(status) {
  const safeStatus = String(status || '').trim() || 'local_only';
  if (!validSyncStatuses.has(safeStatus)) {
    throw createHttpError('Sync status must be local_only, queued, syncing, synced, or failed');
  }

  return safeStatus;
}

function mapProviderConnectionRow(row, { includeSecrets = false } = {}) {
  if (!row) {
    return null;
  }

  const connection = {
    provider: row.provider,
    connectionStatus: row.connection_status,
    accountLabel: row.account_label,
    rootFolderId: row.root_folder_id,
    rootFolderUrl: row.root_folder_url,
    connectedAt: row.connected_at,
    lastError: row.last_error,
  };

  if (includeSecrets) {
    connection.accessToken = row.access_token;
    connection.refreshToken = row.refresh_token;
    connection.expiresAt = row.expires_at;
    connection.scope = row.scope;
    connection.updatedAt = row.updated_at;
  }

  return connection;
}

function mapAttachmentSyncRow(row) {
  if (!row) {
    return null;
  }

  return {
    attachmentId: row.attachment_id,
    nodeId: row.node_id,
    provider: row.provider,
    status: row.status,
    sync_provider: row.provider,
    sync_status: row.status,
    sync_error: row.last_error,
    sync_remote_url: row.remote_item_url,
    remoteNoteFolderId: row.remote_note_folder_id,
    remoteMediaItemId: row.remote_media_item_id,
    remoteTranscriptItemId: row.remote_transcript_item_id,
    remoteMetadataItemId: row.remote_metadata_item_id,
    remote_note_folder_id: row.remote_note_folder_id,
    remote_media_item_id: row.remote_media_item_id,
    remote_transcript_item_id: row.remote_transcript_item_id,
    remote_metadata_item_id: row.remote_metadata_item_id,
    transcriptPatchPending: Boolean(row.transcript_patch_pending),
    transcript_patch_pending: Boolean(row.transcript_patch_pending),
    attemptCount: row.attempt_count,
    attempt_count: row.attempt_count,
    lastError: row.last_error,
    last_synced_at: row.synced_at,
    queuedAt: row.queued_at,
    syncedAt: row.synced_at,
    updatedAt: row.updated_at,
  };
}

function buildDisconnectedConnection(provider) {
  return {
    provider,
    connectionStatus: 'disconnected',
    accountLabel: '',
    rootFolderId: '',
    rootFolderUrl: '',
    connectedAt: null,
    lastError: '',
  };
}

function getAttachmentNodeId(attachmentId) {
  const row = getDatabase()
    .prepare(
      `
        SELECT id, node_id
        FROM attachments
        WHERE id = ?
      `
    )
    .get(attachmentId);

  if (!row) {
    throw createHttpError('Attachment not found', 404);
  }

  return row.node_id;
}

function readProviderRow(provider) {
  return getDatabase()
    .prepare(
      `
        SELECT
          provider,
          connection_status,
          account_label,
          access_token,
          refresh_token,
          expires_at,
          scope,
          root_folder_id,
          root_folder_url,
          last_error,
          connected_at,
          updated_at
        FROM sync_provider_connections
        WHERE provider = ?
      `
    )
    .get(provider);
}

function readAttachmentSyncRow(attachmentId) {
  return getDatabase()
    .prepare(
      `
        SELECT
          attachment_id,
          node_id,
          provider,
          status,
          remote_note_folder_id,
          remote_media_item_id,
          remote_transcript_item_id,
          remote_metadata_item_id,
          remote_item_url,
          transcript_patch_pending,
          attempt_count,
          last_error,
          queued_at,
          synced_at,
          updated_at
        FROM attachment_syncs
        WHERE attachment_id = ?
      `
    )
    .get(attachmentId);
}

function listProviderConnections(options = {}) {
  return allProviders.map((provider) => getProviderConnection(provider, options));
}

function getProviderConnection(provider, options = {}) {
  const safeProvider = normalizeProvider(provider);
  const row = readProviderRow(safeProvider);
  return row ? mapProviderConnectionRow(row, options) : buildDisconnectedConnection(safeProvider);
}

function storeProviderConnection(payload = {}) {
  const provider = normalizeProvider(payload.provider);
  const connectionStatus = normalizeConnectionStatus(payload.connectionStatus);
  const accountLabel = String(payload.accountLabel || '').trim();
  const accessToken = String(payload.accessToken || '').trim();
  const refreshToken = String(payload.refreshToken || '').trim();
  const expiresAt = payload.expiresAt ? String(payload.expiresAt) : null;
  const scope = String(payload.scope || '').trim();
  const rootFolderId = String(payload.rootFolderId || '').trim();
  const rootFolderUrl = String(payload.rootFolderUrl || '').trim();
  const lastError = String(payload.lastError || '').trim();
  const connectedAt =
    payload.connectedAt === undefined
      ? connectionStatus === 'connected'
        ? new Date().toISOString()
        : null
      : payload.connectedAt
        ? String(payload.connectedAt)
        : null;

  getDatabase()
    .prepare(
      `
        INSERT INTO sync_provider_connections (
          provider,
          connection_status,
          account_label,
          access_token,
          refresh_token,
          expires_at,
          scope,
          root_folder_id,
          root_folder_url,
          last_error,
          connected_at
        )
        VALUES (
          @provider,
          @connection_status,
          @account_label,
          @access_token,
          @refresh_token,
          @expires_at,
          @scope,
          @root_folder_id,
          @root_folder_url,
          @last_error,
          @connected_at
        )
        ON CONFLICT(provider) DO UPDATE SET
          connection_status = excluded.connection_status,
          account_label = excluded.account_label,
          access_token = excluded.access_token,
          refresh_token = excluded.refresh_token,
          expires_at = excluded.expires_at,
          scope = excluded.scope,
          root_folder_id = excluded.root_folder_id,
          root_folder_url = excluded.root_folder_url,
          last_error = excluded.last_error,
          connected_at = excluded.connected_at,
          updated_at = CURRENT_TIMESTAMP
      `
    )
    .run({
      provider,
      connection_status: connectionStatus,
      account_label: accountLabel,
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: expiresAt,
      scope,
      root_folder_id: rootFolderId,
      root_folder_url: rootFolderUrl,
      last_error: lastError,
      connected_at: connectedAt,
    });

  return getProviderConnection(provider, { includeSecrets: true });
}

function disconnectProvider(provider) {
  const safeProvider = normalizeProvider(provider);

  storeProviderConnection({
    provider: safeProvider,
    connectionStatus: 'disconnected',
    accountLabel: '',
    accessToken: '',
    refreshToken: '',
    expiresAt: null,
    scope: '',
    rootFolderId: '',
    rootFolderUrl: '',
    lastError: '',
    connectedAt: null,
  });

  getDatabase()
    .prepare(
      `
        UPDATE attachment_syncs
        SET status = 'failed',
            last_error = 'Provider disconnected.',
            updated_at = CURRENT_TIMESTAMP
        WHERE provider = ?
          AND status IN ('queued', 'syncing')
      `
    )
    .run(safeProvider);

  return getProviderConnection(safeProvider);
}

function getAttachmentSync(attachmentId) {
  const safeAttachmentId = normalizeAttachmentId(attachmentId);
  return mapAttachmentSyncRow(readAttachmentSyncRow(safeAttachmentId));
}

function upsertAttachmentSyncRow(payload = {}) {
  const attachmentId = normalizeAttachmentId(payload.attachmentId);
  const existing = readAttachmentSyncRow(attachmentId);
  const nodeId =
    payload.nodeId === undefined || payload.nodeId === null
      ? existing?.node_id || getAttachmentNodeId(attachmentId)
      : normalizeNodeId(payload.nodeId);
  const provider =
    payload.provider === undefined
      ? existing?.provider || ''
      : String(payload.provider || '').trim();
  if (provider && !validProviders.has(provider)) {
    throw createHttpError('Provider must be google-drive or onedrive');
  }

  const status = normalizeSyncStatus(payload.status === undefined ? existing?.status : payload.status);
  const remoteNoteFolderId = String(payload.remoteNoteFolderId ?? existing?.remote_note_folder_id ?? '').trim();
  const remoteMediaItemId = String(payload.remoteMediaItemId ?? existing?.remote_media_item_id ?? '').trim();
  const remoteTranscriptItemId = String(
    payload.remoteTranscriptItemId ?? existing?.remote_transcript_item_id ?? ''
  ).trim();
  const remoteMetadataItemId = String(
    payload.remoteMetadataItemId ?? existing?.remote_metadata_item_id ?? ''
  ).trim();
  const remoteItemUrl = String(payload.remoteItemUrl ?? existing?.remote_item_url ?? '').trim();
  const transcriptPatchPending =
    payload.transcriptPatchPending === undefined
      ? Number(existing?.transcript_patch_pending || 0)
      : payload.transcriptPatchPending
        ? 1
        : 0;
  const attemptCount =
    payload.attemptCount === undefined
      ? Number(existing?.attempt_count || 0)
      : Number(payload.attemptCount);
  const lastError = String(payload.lastError ?? existing?.last_error ?? '').trim();
  const queuedAt =
    payload.queuedAt === undefined
      ? existing?.queued_at || (status === 'queued' ? new Date().toISOString() : null)
      : payload.queuedAt
        ? String(payload.queuedAt)
        : null;
  const syncedAt =
    payload.syncedAt === undefined ? existing?.synced_at || null : payload.syncedAt ? String(payload.syncedAt) : null;

  if (!Number.isInteger(attemptCount) || attemptCount < 0) {
    throw createHttpError('Attempt count must be zero or greater');
  }

  getDatabase()
    .prepare(
      `
        INSERT INTO attachment_syncs (
          attachment_id,
          node_id,
          provider,
          status,
          remote_note_folder_id,
          remote_media_item_id,
          remote_transcript_item_id,
          remote_metadata_item_id,
          remote_item_url,
          transcript_patch_pending,
          attempt_count,
          last_error,
          queued_at,
          synced_at
        )
        VALUES (
          @attachment_id,
          @node_id,
          @provider,
          @status,
          @remote_note_folder_id,
          @remote_media_item_id,
          @remote_transcript_item_id,
          @remote_metadata_item_id,
          @remote_item_url,
          @transcript_patch_pending,
          @attempt_count,
          @last_error,
          @queued_at,
          @synced_at
        )
        ON CONFLICT(attachment_id) DO UPDATE SET
          node_id = excluded.node_id,
          provider = excluded.provider,
          status = excluded.status,
          remote_note_folder_id = excluded.remote_note_folder_id,
          remote_media_item_id = excluded.remote_media_item_id,
          remote_transcript_item_id = excluded.remote_transcript_item_id,
          remote_metadata_item_id = excluded.remote_metadata_item_id,
          remote_item_url = excluded.remote_item_url,
          transcript_patch_pending = excluded.transcript_patch_pending,
          attempt_count = excluded.attempt_count,
          last_error = excluded.last_error,
          queued_at = excluded.queued_at,
          synced_at = excluded.synced_at,
          updated_at = CURRENT_TIMESTAMP
      `
    )
    .run({
      attachment_id: attachmentId,
      node_id: nodeId,
      provider,
      status,
      remote_note_folder_id: remoteNoteFolderId,
      remote_media_item_id: remoteMediaItemId,
      remote_transcript_item_id: remoteTranscriptItemId,
      remote_metadata_item_id: remoteMetadataItemId,
      remote_item_url: remoteItemUrl,
      transcript_patch_pending: transcriptPatchPending,
      attempt_count: attemptCount,
      last_error: lastError,
      queued_at: queuedAt,
      synced_at: syncedAt,
    });

  return getAttachmentSync(attachmentId);
}

function markAttachmentSyncQueued(payload = {}) {
  return upsertAttachmentSyncRow({
    ...payload,
    status: 'queued',
    queuedAt: payload.queuedAt === undefined ? new Date().toISOString() : payload.queuedAt,
    lastError: payload.lastError === undefined ? '' : payload.lastError,
  });
}

function markAttachmentSyncing(attachmentId) {
  const existing = getAttachmentSync(attachmentId);
  if (!existing) {
    throw createHttpError('Attachment sync not found', 404);
  }

  return upsertAttachmentSyncRow({
    attachmentId: existing.attachmentId,
    nodeId: existing.nodeId,
    provider: existing.provider,
    status: 'syncing',
    remoteNoteFolderId: existing.remoteNoteFolderId,
    remoteMediaItemId: existing.remoteMediaItemId,
    remoteTranscriptItemId: existing.remoteTranscriptItemId,
    remoteMetadataItemId: existing.remoteMetadataItemId,
    remoteItemUrl: existing.sync_remote_url,
    transcriptPatchPending: existing.transcriptPatchPending,
    attemptCount: existing.attemptCount,
    lastError: '',
    queuedAt: existing.queuedAt,
    syncedAt: existing.syncedAt,
  });
}

function markAttachmentSynced(payload = {}) {
  const existing = readAttachmentSyncRow(normalizeAttachmentId(payload.attachmentId));
  return upsertAttachmentSyncRow({
    attachmentId: payload.attachmentId,
    nodeId: payload.nodeId,
    provider: payload.provider ?? existing?.provider,
    status: 'synced',
    remoteNoteFolderId: payload.remoteNoteFolderId,
    remoteMediaItemId: payload.remoteMediaItemId,
    remoteTranscriptItemId: payload.remoteTranscriptItemId,
    remoteMetadataItemId: payload.remoteMetadataItemId,
    remoteItemUrl: payload.remoteItemUrl,
    transcriptPatchPending: payload.transcriptPatchPending,
    attemptCount: payload.attemptCount === undefined ? existing?.attempt_count || 0 : payload.attemptCount,
    lastError: '',
    queuedAt: payload.queuedAt === undefined ? existing?.queued_at || null : payload.queuedAt,
    syncedAt: payload.syncedAt === undefined ? new Date().toISOString() : payload.syncedAt,
  });
}

function markAttachmentSyncFailed(payload = {}) {
  const existing = readAttachmentSyncRow(normalizeAttachmentId(payload.attachmentId));
  if (!existing) {
    throw createHttpError('Attachment sync not found', 404);
  }

  return upsertAttachmentSyncRow({
    attachmentId: payload.attachmentId,
    nodeId: existing.node_id,
    provider: existing.provider,
    status: 'failed',
    remoteNoteFolderId: existing.remote_note_folder_id,
    remoteMediaItemId: existing.remote_media_item_id,
    remoteTranscriptItemId: existing.remote_transcript_item_id,
    remoteMetadataItemId: existing.remote_metadata_item_id,
    remoteItemUrl: existing.remote_item_url,
    transcriptPatchPending:
      payload.transcriptPatchPending === undefined
        ? Boolean(existing.transcript_patch_pending)
        : payload.transcriptPatchPending,
    attemptCount: payload.attemptCount === undefined ? existing.attempt_count : payload.attemptCount,
    lastError: payload.lastError || 'Cloud sync failed.',
    queuedAt: existing.queued_at,
    syncedAt: existing.synced_at,
  });
}

function listPendingAttachmentSyncs() {
  return getDatabase()
    .prepare(
      `
        SELECT
          attachment_id,
          node_id,
          provider,
          status,
          remote_note_folder_id,
          remote_media_item_id,
          remote_transcript_item_id,
          remote_metadata_item_id,
          remote_item_url,
          transcript_patch_pending,
          attempt_count,
          last_error,
          queued_at,
          synced_at,
          updated_at
        FROM attachment_syncs
        WHERE status IN ('queued', 'syncing')
           OR (provider != '' AND transcript_patch_pending = 1)
        ORDER BY datetime(COALESCE(queued_at, updated_at)) ASC, attachment_id ASC
      `
    )
    .all()
    .map(mapAttachmentSyncRow);
}

function markTranscriptPatchPending(attachmentId, pending) {
  const existing = readAttachmentSyncRow(normalizeAttachmentId(attachmentId));
  if (!existing) {
    throw createHttpError('Attachment sync not found', 404);
  }

  return upsertAttachmentSyncRow({
    attachmentId: existing.attachment_id,
    nodeId: existing.node_id,
    provider: existing.provider,
    status: existing.status,
    remoteNoteFolderId: existing.remote_note_folder_id,
    remoteMediaItemId: existing.remote_media_item_id,
    remoteTranscriptItemId: existing.remote_transcript_item_id,
    remoteMetadataItemId: existing.remote_metadata_item_id,
    remoteItemUrl: existing.remote_item_url,
    transcriptPatchPending: Boolean(pending),
    attemptCount: existing.attempt_count,
    lastError: existing.last_error,
    queuedAt: existing.queued_at,
    syncedAt: existing.synced_at,
  });
}

function assignUnsyncedAttachmentsToDefaultProvider(provider) {
  const safeProvider = normalizeProvider(provider);
  const rows = getDatabase()
    .prepare(
      `
        SELECT
          a.id AS attachment_id,
          a.node_id AS node_id,
          s.provider AS provider,
          s.status AS status
        FROM attachments a
        LEFT JOIN attachment_syncs s ON s.attachment_id = a.id
        WHERE s.attachment_id IS NULL
           OR (s.status = 'local_only' AND s.provider = '')
        ORDER BY a.id ASC
      `
    )
    .all();

  rows.forEach((row) => {
    markAttachmentSyncQueued({
      attachmentId: row.attachment_id,
      nodeId: row.node_id,
      provider: safeProvider,
      attemptCount: 0,
    });
  });

  return rows.map((row) => row.attachment_id);
}

module.exports = {
  listProviderConnections,
  getProviderConnection,
  storeProviderConnection,
  disconnectProvider,
  getAttachmentSync,
  markAttachmentSyncQueued,
  markAttachmentSyncing,
  markAttachmentSynced,
  markAttachmentSyncFailed,
  listPendingAttachmentSyncs,
  markTranscriptPatchPending,
  assignUnsyncedAttachmentsToDefaultProvider,
};
