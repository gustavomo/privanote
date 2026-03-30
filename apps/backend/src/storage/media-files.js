const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');
const { resolveConfiguredMediaRoot, resolveManagedAttachmentsRoot } = require('./attachment-files');

const validKinds = new Set(['audio', 'video', 'file']);

function sanitizeMediaBaseName(name) {
  return path
    .basename(String(name || '').trim(), path.extname(String(name || '').trim()))
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'media';
}

function resolveManagedMediaPath({ kind, originalName, settings = null }) {
  if (!validKinds.has(kind)) {
    throw new Error('Media kind must be audio, video, or file');
  }

  const extension = path.extname(String(originalName || '').trim()) || '.bin';
  const mediaRoot = settings ? resolveConfiguredMediaRoot(settings) : resolveManagedAttachmentsRoot();
  const directory = path.join(mediaRoot, kind);
  const fileName = `${Date.now()}-${sanitizeMediaBaseName(originalName)}${extension}`;

  fs.mkdirSync(directory, { recursive: true });
  return path.join(directory, fileName);
}

async function writeUploadedMedia(stream, destinationPath) {
  await pipeline(stream, fs.createWriteStream(destinationPath));
  return destinationPath;
}

async function copyImportedMedia(sourcePath, kind, settings = null) {
  const destinationPath = resolveManagedMediaPath({
    kind,
    originalName: path.basename(sourcePath),
    settings,
  });

  await fs.promises.copyFile(sourcePath, destinationPath);
  return destinationPath;
}

module.exports = {
  sanitizeMediaBaseName,
  resolveConfiguredMediaRoot,
  resolveManagedMediaPath,
  writeUploadedMedia,
  copyImportedMedia,
};
