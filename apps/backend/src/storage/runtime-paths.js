const fs = require('fs');
const path = require('path');

function resolveRuntimeRoot() {
  const configuredRoot = String(process.env.PRIVANOTE_DATA_DIR || '').trim();
  const runtimeRoot = configuredRoot
    ? path.resolve(configuredRoot)
    : path.resolve(process.cwd(), 'data');

  fs.mkdirSync(runtimeRoot, { recursive: true });
  return runtimeRoot;
}

function resolveRuntimeDatabasePath() {
  return path.join(resolveRuntimeRoot(), 'privanote.db');
}

function resolveTranscriptionAssetsRoot() {
  const transcriptionRoot = path.join(resolveRuntimeRoot(), 'transcription');
  fs.mkdirSync(transcriptionRoot, { recursive: true });
  return transcriptionRoot;
}

function resolveManagedAttachmentsRoot() {
  const attachmentsRoot = path.join(resolveRuntimeRoot(), 'attachments');
  fs.mkdirSync(attachmentsRoot, { recursive: true });
  return attachmentsRoot;
}

const resolveDataRoot = resolveRuntimeRoot;

module.exports = {
  resolveRuntimeRoot,
  resolveRuntimeDatabasePath,
  resolveTranscriptionAssetsRoot,
  resolveDataRoot,
  resolveManagedAttachmentsRoot,
};
