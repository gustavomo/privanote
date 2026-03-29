const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dataDir = path.join(process.cwd(), 'data');
const dbPath = path.join(dataDir, 'privanote.db');

fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS nodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    tags TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    node_id INTEGER NOT NULL,
    kind TEXT NOT NULL CHECK(kind IN ('audio', 'video', 'file')),
    local_path TEXT NOT NULL,
    cloud_url TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
  );
`);

const listNodesStatement = db.prepare(`
  SELECT id, title, description, tags, created_at, updated_at
  FROM nodes
  ORDER BY datetime(updated_at) DESC, id DESC
`);

const createNodeStatement = db.prepare(`
  INSERT INTO nodes (title, description, tags, updated_at)
  VALUES (@title, @description, @tags, CURRENT_TIMESTAMP)
`);

const updateNodeStatement = db.prepare(`
  UPDATE nodes
  SET title = @title,
      description = @description,
      tags = @tags,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = @id
`);

const deleteNodeStatement = db.prepare('DELETE FROM nodes WHERE id = ?');

const getNodeStatement = db.prepare(`
  SELECT id, title, description, tags, created_at, updated_at
  FROM nodes
  WHERE id = ?
`);

const listAttachmentsStatement = db.prepare(`
  SELECT id, node_id, kind, local_path, cloud_url, created_at
  FROM attachments
  WHERE node_id = ?
  ORDER BY datetime(created_at) DESC, id DESC
`);

const addAttachmentStatement = db.prepare(`
  INSERT INTO attachments (node_id, kind, local_path, cloud_url)
  VALUES (@node_id, @kind, @local_path, @cloud_url)
`);

const deleteAttachmentStatement = db.prepare('DELETE FROM attachments WHERE id = ?');

function sanitizeNodePayload(payload = {}) {
  const result = {
    title: String(payload.title || '').trim(),
    description: String(payload.description || '').trim(),
    tags: String(payload.tags || '').trim(),
  };

  if (!result.title) {
    throw new Error('Title is required');
  }

  return result;
}

function listNodes() {
  return listNodesStatement.all();
}

function createNode(payload) {
  const safePayload = sanitizeNodePayload(payload);
  const result = createNodeStatement.run(safePayload);
  return getNodeStatement.get(result.lastInsertRowid);
}

function updateNode(payload) {
  const id = Number(payload?.id);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('A valid node id is required');
  }

  const safePayload = {
    id,
    ...sanitizeNodePayload(payload),
  };

  const result = updateNodeStatement.run(safePayload);
  if (result.changes === 0) {
    throw new Error('Node not found');
  }

  return getNodeStatement.get(id);
}

function deleteNode(id) {
  const nodeId = Number(id);
  const result = deleteNodeStatement.run(nodeId);
  return result.changes > 0;
}

function listAttachments(nodeId) {
  const safeNodeId = Number(nodeId);
  return listAttachmentsStatement.all(safeNodeId);
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

  const node = getNodeStatement.get(nodeId);
  if (!node) {
    throw new Error('Node not found');
  }

  const result = addAttachmentStatement.run({
    node_id: nodeId,
    kind,
    local_path: localPath,
    cloud_url: cloudUrl,
  });

  return db
    .prepare(
      'SELECT id, node_id, kind, local_path, cloud_url, created_at FROM attachments WHERE id = ?'
    )
    .get(result.lastInsertRowid);
}

function deleteAttachment(attachmentId) {
  const safeAttachmentId = Number(attachmentId);
  const result = deleteAttachmentStatement.run(safeAttachmentId);
  return result.changes > 0;
}

module.exports = {
  listNodes,
  createNode,
  updateNode,
  deleteNode,
  listAttachments,
  addAttachment,
  deleteAttachment,
};
