const { getDatabase } = require('../storage/database');

const validStatuses = new Set(['queued', 'processing', 'succeeded', 'failed']);
const validModes = new Set(['local', 'backend']);

function createHttpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizePositiveInteger(value, label) {
  const safeValue = Number(value);
  if (!Number.isInteger(safeValue) || safeValue <= 0) {
    throw createHttpError(`${label} is required`);
  }

  return safeValue;
}

function findNodeById(nodeId) {
  return getDatabase()
    .prepare(
      `
        SELECT id
        FROM nodes
        WHERE id = ?
      `
    )
    .get(nodeId);
}

function findAttachmentById(attachmentId) {
  return getDatabase()
    .prepare(
      `
        SELECT id, node_id
        FROM attachments
        WHERE id = ?
      `
    )
    .get(attachmentId);
}

function mapTranscriptRow(row) {
  if (!row) {
    return null;
  }

  return {
    node_id: row.node_id,
    attachment_id: row.attachment_id,
    status: row.status,
    text: row.text,
    mode: row.mode,
    provider: row.provider,
    attempt_count: row.attempt_count,
    last_error: row.last_error,
    created_at: row.created_at,
    updated_at: row.updated_at,
    completed_at: row.completed_at,
  };
}

function validateStatus(status) {
  if (!validStatuses.has(status)) {
    throw createHttpError('Transcript status must be queued, processing, succeeded, or failed');
  }
}

function validateMode(mode) {
  if (!validModes.has(mode)) {
    throw createHttpError('Transcript mode must be local or backend');
  }
}

function findTranscriptRow(nodeId) {
  return getDatabase()
    .prepare(
      `
        SELECT
          node_id,
          attachment_id,
          status,
          text,
          mode,
          provider,
          attempt_count,
          last_error,
          created_at,
          updated_at,
          completed_at
        FROM transcripts
        WHERE node_id = ?
      `
    )
    .get(nodeId);
}

function listPendingTranscripts() {
  return getDatabase()
    .prepare(
      `
        SELECT
          node_id,
          attachment_id,
          status,
          text,
          mode,
          provider,
          attempt_count,
          last_error,
          created_at,
          updated_at,
          completed_at
        FROM transcripts
        WHERE status IN ('queued', 'processing')
        ORDER BY datetime(updated_at) ASC, node_id ASC
      `
    )
    .all()
    .map(mapTranscriptRow);
}

function getNoteTranscript(nodeId) {
  const safeNodeId = normalizePositiveInteger(nodeId, 'A valid node id');
  if (!findNodeById(safeNodeId)) {
    throw createHttpError('Node not found', 404);
  }

  return mapTranscriptRow(findTranscriptRow(safeNodeId));
}

function buildTranscriptPayload(payload = {}) {
  const nodeId = normalizePositiveInteger(payload.nodeId, 'A valid node id');
  const attachmentId = normalizePositiveInteger(payload.attachmentId, 'A valid attachment id');
  const attachment = findAttachmentById(attachmentId);
  if (!attachment || attachment.node_id !== nodeId) {
    throw createHttpError('Attachment not found for note', 404);
  }

  const status = String(payload.status || '').trim() || 'queued';
  const mode = String(payload.mode || '').trim() || 'local';
  const provider = String(payload.provider || '').trim();
  const text = String(payload.text || '');
  const attemptCount =
    payload.attemptCount === undefined || payload.attemptCount === null
      ? 0
      : Number(payload.attemptCount);
  const lastError = String(payload.lastError || '');
  const completedAt =
    payload.completedAt === undefined ? null : payload.completedAt ? String(payload.completedAt) : null;

  validateStatus(status);
  validateMode(mode);

  if (!Number.isInteger(attemptCount) || attemptCount < 0) {
    throw createHttpError('Attempt count must be zero or greater');
  }

  return {
    nodeId,
    attachmentId,
    status,
    text,
    mode,
    provider,
    attemptCount,
    lastError,
    completedAt,
  };
}

function upsertTranscriptRecord(payload = {}) {
  const safePayload = buildTranscriptPayload(payload);
  const db = getDatabase();

  db.prepare(
    `
      INSERT INTO transcripts (
        node_id,
        attachment_id,
        status,
        text,
        mode,
        provider,
        attempt_count,
        last_error,
        completed_at
      )
      VALUES (
        @node_id,
        @attachment_id,
        @status,
        @text,
        @mode,
        @provider,
        @attempt_count,
        @last_error,
        @completed_at
      )
      ON CONFLICT(node_id) DO UPDATE SET
        attachment_id = excluded.attachment_id,
        status = excluded.status,
        text = excluded.text,
        mode = excluded.mode,
        provider = excluded.provider,
        attempt_count = excluded.attempt_count,
        last_error = excluded.last_error,
        completed_at = excluded.completed_at,
        updated_at = CURRENT_TIMESTAMP
    `
  ).run({
    node_id: safePayload.nodeId,
    attachment_id: safePayload.attachmentId,
    status: safePayload.status,
    text: safePayload.text,
    mode: safePayload.mode,
    provider: safePayload.provider,
    attempt_count: safePayload.attemptCount,
    last_error: safePayload.lastError,
    completed_at: safePayload.completedAt,
  });

  return getNoteTranscript(safePayload.nodeId);
}

function markTranscriptQueued(payload = {}) {
  return upsertTranscriptRecord({
    ...payload,
    status: 'queued',
    text: '',
    lastError: '',
    attemptCount: payload.attemptCount === undefined ? 0 : payload.attemptCount,
    completedAt: null,
  });
}

function markTranscriptProcessing(nodeId) {
  const existing = getNoteTranscript(nodeId);
  if (!existing) {
    throw createHttpError('Transcript not found', 404);
  }

  return upsertTranscriptRecord({
    nodeId: existing.node_id,
    attachmentId: existing.attachment_id,
    status: 'processing',
    text: existing.text,
    mode: existing.mode,
    provider: existing.provider,
    attemptCount: existing.attempt_count,
    lastError: '',
    completedAt: null,
  });
}

function markTranscriptSucceeded(payload = {}) {
  const existing = getNoteTranscript(payload.nodeId);
  if (!existing) {
    throw createHttpError('Transcript not found', 404);
  }

  return upsertTranscriptRecord({
    nodeId: existing.node_id,
    attachmentId: payload.attachmentId || existing.attachment_id,
    status: 'succeeded',
    text: String(payload.text || ''),
    mode: payload.mode || existing.mode,
    provider: payload.provider === undefined ? existing.provider : payload.provider,
    attemptCount: payload.attemptCount === undefined ? existing.attempt_count : payload.attemptCount,
    lastError: '',
    completedAt: payload.completedAt || new Date().toISOString(),
  });
}

function markTranscriptFailed(payload = {}) {
  const existing = getNoteTranscript(payload.nodeId);
  if (!existing) {
    throw createHttpError('Transcript not found', 404);
  }

  return upsertTranscriptRecord({
    nodeId: existing.node_id,
    attachmentId: payload.attachmentId || existing.attachment_id,
    status: 'failed',
    text: existing.text,
    mode: payload.mode || existing.mode,
    provider: payload.provider === undefined ? existing.provider : payload.provider,
    attemptCount: payload.attemptCount === undefined ? existing.attempt_count : payload.attemptCount,
    lastError: String(payload.lastError || ''),
    completedAt: null,
  });
}

module.exports = {
  getNoteTranscript,
  listPendingTranscripts,
  upsertTranscriptRecord,
  markTranscriptQueued,
  markTranscriptProcessing,
  markTranscriptSucceeded,
  markTranscriptFailed,
};
