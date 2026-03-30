const fs = require('fs');
const os = require('os');
const path = require('path');
const { Readable } = require('stream');

const modulePaths = [
  require.resolve('../src/storage/attachment-files.js'),
  require.resolve('../src/storage/runtime-paths.js'),
  require.resolve('../src/storage/media-files.js'),
];

function resetStorageModules() {
  modulePaths.forEach((modulePath) => {
    delete require.cache[modulePath];
  });
}

function loadMediaFiles(dataRoot) {
  process.env.PRIVANOTE_DATA_DIR = dataRoot;
  resetStorageModules();
  return require('../src/storage/media-files.js');
}

afterEach(() => {
  delete process.env.PRIVANOTE_DATA_DIR;
  resetStorageModules();
});

describe('managed media storage helpers', () => {
  it('writes uploaded media and copies imported media into the managed root', async () => {
    const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'privanote-media-storage-'));
    const { copyImportedMedia, resolveManagedMediaPath, writeUploadedMedia } = loadMediaFiles(dataRoot);
    const sourcePath = path.join(dataRoot, 'external-note.wav');
    fs.writeFileSync(sourcePath, 'existing import bytes');

    const uploadPath = resolveManagedMediaPath({
      kind: 'audio',
      originalName: 'recorded-note.webm',
    });
    await writeUploadedMedia(Readable.from(['recorded bytes']), uploadPath);

    const importedPath = await copyImportedMedia(sourcePath, 'file');

    expect(uploadPath).toContain(path.join(dataRoot, 'attachments', 'audio'));
    expect(importedPath).toContain(path.join(dataRoot, 'attachments', 'file'));
    expect(fs.readFileSync(uploadPath, 'utf8')).toBe('recorded bytes');
    expect(fs.readFileSync(importedPath, 'utf8')).toBe('existing import bytes');
    expect(fs.readFileSync(sourcePath, 'utf8')).toBe('existing import bytes');
  });
});
