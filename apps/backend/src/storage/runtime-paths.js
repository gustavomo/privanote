const fs = require('fs');
const path = require('path');

function resolveDataRoot() {
  const configuredRoot = String(process.env.PRIVANOTE_DATA_DIR || '').trim();
  const dataRoot = configuredRoot
    ? path.resolve(configuredRoot)
    : path.resolve(process.cwd(), 'data');

  fs.mkdirSync(dataRoot, { recursive: true });
  return dataRoot;
}

function resolveManagedAttachmentsRoot() {
  const attachmentsRoot = path.join(resolveDataRoot(), 'attachments');
  fs.mkdirSync(attachmentsRoot, { recursive: true });
  return attachmentsRoot;
}

module.exports = {
  resolveDataRoot,
  resolveManagedAttachmentsRoot,
};
