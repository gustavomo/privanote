const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');
const { getDatabase } = require('../storage/database');
const nodesService = require('./nodes-service');
const { resolveManagedAttachmentsRoot } = require('../storage/attachment-files');

const captureKinds = {
  audio: 'audio',
  video: 'video',
  'video-with-audio': 'video',
};

function createHttpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeNodeId(nodeId) {
  if (nodeId === undefined || nodeId === null || String(nodeId).trim() === '') {
    return null;
  }

  const safeNodeId = Number(nodeId);
  if (!Number.isInteger(safeNodeId) || safeNodeId <= 0) {
    throw createHttpError('A valid node id is required');
  }

  return safeNodeId;
}

function sanitizeFileName(fileName, fallbackExtension = '.webm') {
  const baseName = path.basename(String(fileName || `recording${fallbackExtension}`).trim());
  const extension = path.extname(baseName) || fallbackExtension;
  const name = path.basename(baseName, extension).replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '');
  return `${name || 'recording'}${extension}`;
}

function findNodeById(nodeId) {
  return getDatabase()
    .prepare(
      `
        SELECT id, title, description, tags, created_at, updated_at
        FROM nodes
        WHERE id = ?
      `
    )
    .get(nodeId);
}

function createAttachmentRecord({ nodeId, kind, localPath }) {
  const db = getDatabase();
  const result = db
    .prepare(
      `
        INSERT INTO attachments (node_id, kind, local_path, cloud_url)
        VALUES (@node_id, @kind, @local_path, '')
      `
    )
    .run({
      node_id: nodeId,
      kind,
      local_path: localPath,
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

function resolveRecordingTargetPath(fileName) {
  const attachmentsRoot = resolveManagedAttachmentsRoot();
  const sanitizedFileName = sanitizeFileName(fileName);
  return path.join(attachmentsRoot, `${Date.now()}-${sanitizedFileName}`);
}

async function saveRecording(payload = {}) {
  const captureMode = String(payload.captureMode || '').trim();
  const kind = captureKinds[captureMode];
  if (!kind) {
    throw createHttpError('Capture mode must be audio, video, or video-with-audio');
  }

  const title = String(payload.title || '').trim();
  if (!title) {
    throw createHttpError('Title is required');
  }

  if (!payload.stream || typeof payload.stream.pipe !== 'function') {
    throw createHttpError('Recording upload is required');
  }

  const nodeId = normalizeNodeId(payload.nodeId);
  let node = nodeId ? findNodeById(nodeId) : null;
  if (nodeId && !node) {
    throw createHttpError('Node not found', 404);
  }

  const localPath = resolveRecordingTargetPath(payload.fileName);
  fs.mkdirSync(path.dirname(localPath), { recursive: true });

  let createdNode = null;

  try {
    await pipeline(payload.stream, fs.createWriteStream(localPath));

    if (!node) {
      createdNode = nodesService.createNode({
        title,
        description: '',
        tags: '',
      });
      node = createdNode;
    }

    const attachment = createAttachmentRecord({
      nodeId: node.id,
      kind,
      localPath,
    });

    return {
      node,
      attachment,
    };
  } catch (error) {
    fs.rmSync(localPath, { force: true });

    if (createdNode) {
      nodesService.deleteNode(createdNode.id);
    }

    throw error;
  }
}

module.exports = {
  saveRecording,
};
