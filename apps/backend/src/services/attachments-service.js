const fs = require('fs');
const { getDatabase } = require('../storage/database');

function getNode(nodeId) {
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

function listAttachments(nodeId) {
  const safeNodeId = Number(nodeId);
  return getDatabase()
    .prepare(
      `
        SELECT id, node_id, kind, local_path, cloud_url, created_at
        FROM attachments
        WHERE node_id = ?
        ORDER BY datetime(created_at) DESC, id DESC
      `
    )
    .all(safeNodeId);
}

function addAttachment(payload = {}) {
  const nodeId = Number(payload.nodeId);
  const kind = String(payload.kind || '').trim();
  const localPath = String(payload.localPath || '').trim();
  const cloudUrl = String(payload.cloudUrl || '').trim();

  if (!Number.isInteger(nodeId) || nodeId <= 0) {
    throw new Error('A valid node id is required');
  }

  if (!['audio', 'video', 'file'].includes(kind)) {
    throw new Error('Attachment kind must be audio, video, or file');
  }

  if (!localPath) {
    throw new Error('Attachment local path is required');
  }

  if (!getNode(nodeId)) {
    throw new Error('Node not found');
  }

  const db = getDatabase();
  const result = db
    .prepare(
      `
        INSERT INTO attachments (node_id, kind, local_path, cloud_url)
        VALUES (@node_id, @kind, @local_path, @cloud_url)
      `
    )
    .run({
      node_id: nodeId,
      kind,
      local_path: localPath,
      cloud_url: cloudUrl,
    });

  return db
    .prepare(
      `
        SELECT id, node_id, kind, local_path, cloud_url, created_at
        FROM attachments
        WHERE id = ?
      `
    )
    .get(result.lastInsertRowid);
}

function createHttpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function findAttachmentById(attachmentId) {
  const safeAttachmentId = Number(attachmentId);
  return getDatabase()
    .prepare(
      `
        SELECT id, node_id, kind, local_path, cloud_url, created_at
        FROM attachments
        WHERE id = ?
      `
    )
    .get(safeAttachmentId);
}

function getAttachmentContent(attachmentId) {
  const safeAttachmentId = Number(attachmentId);
  if (!Number.isInteger(safeAttachmentId) || safeAttachmentId <= 0) {
    throw createHttpError('A valid attachment id is required');
  }

  const attachment = findAttachmentById(safeAttachmentId);
  if (!attachment) {
    throw createHttpError('Attachment not found', 404);
  }

  if (!fs.existsSync(attachment.local_path)) {
    throw createHttpError('Attachment file not found', 404);
  }

  return {
    attachment,
    stream: fs.createReadStream(attachment.local_path),
  };
}

function deleteAttachment(attachmentId) {
  const safeAttachmentId = Number(attachmentId);
  const result = getDatabase()
    .prepare('DELETE FROM attachments WHERE id = ?')
    .run(safeAttachmentId);

  return result.changes > 0;
}

module.exports = {
  listAttachments,
  addAttachment,
  getAttachmentContent,
  deleteAttachment,
};
