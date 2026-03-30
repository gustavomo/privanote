const fs = require('fs');
const Database = require('better-sqlite3');
const {
  deleteManagedAttachment,
  rememberConfiguredManagedAttachmentRoot,
  rememberManagedAttachmentPath,
  rememberManagedAttachmentRoot,
  resolveManagedAttachmentsRoot,
} = require('./attachment-files');
const { resolveRuntimeDatabasePath, resolveRuntimeRoot } = require('./runtime-paths');

let database = null;

function createDatabase() {
  const runtimeRoot = resolveRuntimeRoot();
  const dbPath = resolveRuntimeDatabasePath();
  const managedAttachmentsRoot = resolveManagedAttachmentsRoot();

  fs.mkdirSync(runtimeRoot, { recursive: true });

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.function('delete_managed_attachment', (localPath) => {
    deleteManagedAttachment(localPath);
    return 1;
  });
  db.function('remember_managed_attachment_root', (storageDestination, localMediaDirectory) => {
    rememberConfiguredManagedAttachmentRoot({
      storage_destination: storageDestination,
      local_media_directory: localMediaDirectory,
    });
    return 1;
  });

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

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS attachments_delete_cleanup
    AFTER DELETE ON attachments
    BEGIN
      SELECT delete_managed_attachment(old.local_path);
    END;
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      storage_destination TEXT NOT NULL DEFAULT 'local',
      local_media_directory TEXT NOT NULL DEFAULT '',
      transcription_mode TEXT NOT NULL DEFAULT 'local',
      provider_kind TEXT NOT NULL DEFAULT 'openai',
      backend_api_key TEXT NOT NULL DEFAULT '',
      local_runtime_status TEXT NOT NULL DEFAULT 'not-ready',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS settings_managed_root_sync_insert
    AFTER INSERT ON settings
    BEGIN
      SELECT remember_managed_attachment_root(new.storage_destination, new.local_media_directory);
    END;
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS settings_managed_root_sync_update
    AFTER UPDATE ON settings
    BEGIN
      SELECT remember_managed_attachment_root(new.storage_destination, new.local_media_directory);
    END;
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS transcripts (
      node_id INTEGER PRIMARY KEY,
      attachment_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued', 'processing', 'succeeded', 'failed')),
      text TEXT NOT NULL DEFAULT '',
      mode TEXT NOT NULL DEFAULT 'local' CHECK(mode IN ('local', 'backend')),
      provider TEXT NOT NULL DEFAULT '',
      attempt_count INTEGER NOT NULL DEFAULT 0,
      last_error TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT DEFAULT NULL,
      FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE,
      FOREIGN KEY (attachment_id) REFERENCES attachments(id) ON DELETE CASCADE
    );
  `);

  db.prepare(
    `
      INSERT OR IGNORE INTO settings (
        id,
        storage_destination,
        local_media_directory,
        transcription_mode,
        provider_kind,
        backend_api_key,
        local_runtime_status
      )
      VALUES (1, 'local', '', 'local', 'openai', '', 'not-ready')
    `
  ).run();

  rememberManagedAttachmentRoot(managedAttachmentsRoot);
  rememberConfiguredManagedAttachmentRoot(
    db
      .prepare(
        `
          SELECT storage_destination, local_media_directory
          FROM settings
          WHERE id = 1
        `
      )
      .get()
  );

  db.prepare(
    `
      SELECT DISTINCT local_path
      FROM attachments
    `
  )
    .pluck()
    .all()
    .forEach((localPath) => {
      rememberManagedAttachmentPath(localPath);
    });

  return db;
}

function getDatabase() {
  if (!database) {
    database = createDatabase();
  }

  return database;
}

function closeDatabase() {
  if (database) {
    database.close();
    database = null;
  }
}

module.exports = {
  createDatabase,
  getDatabase,
  closeDatabase,
};
