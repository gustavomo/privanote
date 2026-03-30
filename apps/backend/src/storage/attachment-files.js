const fs = require('fs');
const path = require('path');
const { resolveConfiguredMediaRoot, resolveManagedAttachmentsRoot } = require('./runtime-paths');

function isManagedAttachmentPath(localPath, managedAttachmentsRoot = resolveManagedAttachmentsRoot()) {
  if (!localPath) {
    return false;
  }

  const resolvedPath = path.resolve(localPath);
  const resolvedRoot = path.resolve(managedAttachmentsRoot);

  return resolvedPath === resolvedRoot || resolvedPath.startsWith(`${resolvedRoot}${path.sep}`);
}

function deleteManagedAttachment(localPath, managedAttachmentsRoot = resolveManagedAttachmentsRoot()) {
  if (!isManagedAttachmentPath(localPath, managedAttachmentsRoot)) {
    return false;
  }

  fs.rmSync(path.resolve(localPath), { force: true });
  return true;
}

module.exports = {
  resolveConfiguredMediaRoot,
  resolveManagedAttachmentsRoot,
  isManagedAttachmentPath,
  deleteManagedAttachment,
};
