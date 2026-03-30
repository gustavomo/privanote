const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

let database = null;

function createDatabase() {
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
