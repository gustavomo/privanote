const fs = require('fs');
const os = require('os');
const path = require('path');

const modulePaths = [
  require.resolve('../src/storage/attachment-files.js'),
  require.resolve('../src/storage/runtime-paths.js'),
  require.resolve('../src/storage/database.js'),
];

function resetStorageModules() {
  modulePaths.forEach((modulePath) => {
    delete require.cache[modulePath];
  });
}

function loadStorageModules(dataRoot) {
  process.env.PRIVANOTE_DATA_DIR = dataRoot;
  resetStorageModules();

  return {
    attachmentFiles: require('../src/storage/attachment-files.js'),
    runtimePaths: require('../src/storage/runtime-paths.js'),
    database: require('../src/storage/database.js'),
  };
}

afterEach(() => {
  try {
    require('../src/storage/database.js').closeDatabase();
  } catch {
    // Ignore cache misses between tests.
  }

  delete process.env.PRIVANOTE_DATA_DIR;
  resetStorageModules();
});

describe('database storage cleanup', () => {
  it('enables foreign_keys and removes managed attachments when a note is deleted', () => {
    const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'privanote-storage-'));
    const { database, runtimePaths } = loadStorageModules(dataRoot);
    const { getDatabase } = database;
    const { resolveDataRoot, resolveManagedAttachmentsRoot } = runtimePaths;
    const db = getDatabase();

    expect(resolveDataRoot()).toBe(path.resolve(dataRoot));
    expect(db.prepare('PRAGMA foreign_keys').pluck().get()).toBe(1);

    const managedAttachmentsRoot = resolveManagedAttachmentsRoot();
    const managedFile = path.join(managedAttachmentsRoot, 'audio.wav');

    fs.writeFileSync(managedFile, 'binary');

    const nodeId = db
      .prepare(
        `
          INSERT INTO nodes (title, description, tags, updated_at)
          VALUES (?, '', '', CURRENT_TIMESTAMP)
        `
      )
      .run('foreign_keys cleanup note').lastInsertRowid;

    db.prepare(
      `
        INSERT INTO attachments (node_id, kind, local_path, cloud_url)
        VALUES (?, ?, ?, '')
      `
    ).run(nodeId, 'audio', managedFile);

    db.prepare('DELETE FROM nodes WHERE id = ?').run(nodeId);

    expect(db.prepare('SELECT COUNT(*) FROM attachments').pluck().get()).toBe(0);
    expect(fs.existsSync(managedFile)).toBe(false);
  });

  it('keeps the storage root stable across database reopen cycles', () => {
    const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'privanote-stable-root-'));
    const firstLoad = loadStorageModules(dataRoot);
    const firstRoot = firstLoad.runtimePaths.resolveDataRoot();

    firstLoad.database.getDatabase();
    firstLoad.database.closeDatabase();

    const secondLoad = loadStorageModules(dataRoot);
    const secondRoot = secondLoad.runtimePaths.resolveDataRoot();

    secondLoad.database.getDatabase();

    expect(secondRoot).toBe(firstRoot);
    expect(fs.existsSync(path.join(secondRoot, 'privanote.db'))).toBe(true);
  });
});
