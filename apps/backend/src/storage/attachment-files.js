const fs = require('fs');
const path = require('path');
const { resolveConfiguredMediaRoot, resolveManagedAttachmentsRoot } = require('./runtime-paths');

const managedAttachmentKinds = new Set(['audio', 'video', 'file']);
const managedAttachmentRoots = new Set();

function rememberManagedAttachmentRoot(managedAttachmentsRoot) {
  if (!managedAttachmentsRoot) {
    return null;
  }

  const resolvedRoot = path.resolve(managedAttachmentsRoot);
  managedAttachmentRoots.add(resolvedRoot);
  return resolvedRoot;
}

function rememberConfiguredManagedAttachmentRoot(settings = {}) {
  const storageDestination = String(settings.storageDestination || settings.storage_destination || '').trim();
  const localMediaDirectory = String(settings.localMediaDirectory || settings.local_media_directory || '').trim();

  if (storageDestination !== 'local' || !localMediaDirectory) {
    return null;
  }

  return rememberManagedAttachmentRoot(resolveConfiguredMediaRoot(settings));
}

function inferManagedAttachmentRoot(localPath) {
  if (!localPath) {
    return null;
  }

  const resolvedPath = path.resolve(localPath);
  const kindRoot = path.dirname(resolvedPath);
  const attachmentsRoot = path.dirname(kindRoot);
  const kind = path.basename(kindRoot);

  if (path.basename(attachmentsRoot) !== 'attachments' || !managedAttachmentKinds.has(kind)) {
    return null;
  }

  return attachmentsRoot;
}

function rememberManagedAttachmentPath(localPath) {
  const inferredRoot = inferManagedAttachmentRoot(localPath);
  return inferredRoot ? rememberManagedAttachmentRoot(inferredRoot) : null;
}

function normalizeManagedAttachmentRoots(managedAttachmentsRoots = null) {
  if (managedAttachmentsRoots === null) {
    if (managedAttachmentRoots.size === 0) {
      rememberManagedAttachmentRoot(resolveManagedAttachmentsRoot());
    }

    return [...managedAttachmentRoots];
  }

  const candidateRoots = Array.isArray(managedAttachmentsRoots)
    ? managedAttachmentsRoots
    : [managedAttachmentsRoots];

  return candidateRoots
    .filter(Boolean)
    .map((managedAttachmentRoot) => path.resolve(managedAttachmentRoot));
}

function isManagedAttachmentPath(localPath, managedAttachmentRoots = null) {
  if (!localPath) {
    return false;
  }

  const resolvedPath = path.resolve(localPath);
  return normalizeManagedAttachmentRoots(managedAttachmentRoots).some(
    (resolvedRoot) => resolvedPath === resolvedRoot || resolvedPath.startsWith(`${resolvedRoot}${path.sep}`)
  );
}

function deleteManagedAttachment(localPath, managedAttachmentRoots = null) {
  if (!isManagedAttachmentPath(localPath, managedAttachmentRoots)) {
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
  rememberManagedAttachmentRoot,
  rememberConfiguredManagedAttachmentRoot,
  rememberManagedAttachmentPath,
};
