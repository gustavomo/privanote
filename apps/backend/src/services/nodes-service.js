const { getDatabase } = require('../storage/database');

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
  return getDatabase()
    .prepare(
      `
        SELECT id, title, description, tags, created_at, updated_at
        FROM nodes
        ORDER BY datetime(updated_at) DESC, id DESC
      `
    )
    .all();
}

function createNode(payload) {
  const db = getDatabase();
  const safePayload = sanitizeNodePayload(payload);
  const result = db
    .prepare(
      `
        INSERT INTO nodes (title, description, tags, updated_at)
        VALUES (@title, @description, @tags, CURRENT_TIMESTAMP)
      `
    )
    .run(safePayload);

  return db
    .prepare(
      `
        SELECT id, title, description, tags, created_at, updated_at
        FROM nodes
        WHERE id = ?
      `
    )
    .get(result.lastInsertRowid);
}

function updateNode(payload = {}) {
  const db = getDatabase();
  const id = Number(payload.id);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('A valid node id is required');
  }

  const safePayload = {
    id,
    ...sanitizeNodePayload(payload),
  };

  const result = db
    .prepare(
      `
        UPDATE nodes
        SET title = @title,
            description = @description,
            tags = @tags,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = @id
      `
    )
    .run(safePayload);

  if (result.changes === 0) {
    throw new Error('Node not found');
  }

  return db
    .prepare(
      `
        SELECT id, title, description, tags, created_at, updated_at
        FROM nodes
        WHERE id = ?
      `
    )
    .get(id);
}

function deleteNode(nodeId) {
  const safeNodeId = Number(nodeId);
  const result = getDatabase()
    .prepare('DELETE FROM nodes WHERE id = ?')
    .run(safeNodeId);

  return result.changes > 0;
}

module.exports = {
  listNodes,
  createNode,
  updateNode,
  deleteNode,
};
