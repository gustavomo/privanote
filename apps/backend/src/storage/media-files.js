const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');
const { resolveManagedAttachmentsRoot } = require('./attachment-files');

const validKinds = new Set(['audio', 'video', 'file']);

function sanitizeMediaBaseName(name) {
  return path
    .basename(String(name || '').trim(), path.extname(String(name || '').trim()))
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'media';
}

function resolveManagedMediaPath({ kind, originalName }) {
  if (!validKinds.has(kind)) {
    throw new Error('Media kind must be audio, video, or file');
  }

  const extension = path.extname(String(originalName || '').trim()) || '.bin';
  const directory = path.join(resolveManagedAttachmentsRoot(), kind);
  const fileName = `${Date.now()}-${sanitizeMediaBaseName(originalName)}${extension}`;

  fs.mkdirSync(directory, { recursive: true });
  return path.join(directory, fileName);
}

async function writeUploadedMedia(stream, destinationPath) {
  await pipeline(stream, fs.createWriteStream(destinationPath));
  return destinationPath;
}

async function copyImportedMedia(sourcePath, kind) {
  const destinationPath = resolveManagedMediaPath({
    kind,
    originalName: path.basename(sourcePath),
  });

  await fs.promises.copyFile(sourcePath, destinationPath);
  return destinationPath;
}

module.exports = {
  sanitizeMediaBaseName,
  resolveManagedMediaPath,
  writeUploadedMedia,
  copyImportedMedia,
};
