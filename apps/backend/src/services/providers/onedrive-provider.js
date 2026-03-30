const fs = require('fs');
const path = require('path');
const mime = require('mime-types');

const oneDriveScopes = 'Files.ReadWrite offline_access User.Read';
const oneDriveRootPath = 'me/drive/special/approot';
const oneDriveRootFolderName = 'Privanote';
const oneDriveUploadThreshold = 10 * 1024 * 1024;
const oneDriveUploadChunkSize = 5 * 1024 * 1024;
const oneDriveChunkAlignment = 320 * 1024;
const transcriptFileName = 'transcript.txt';
const metadataFileName = 'privanote.json';

function requireFetch() {
  if (typeof fetch !== 'function') {
    throw new Error('OneDrive sync is unavailable in this runtime.');
  }
}

function resolveOneDriveClientId() {
  return String(process.env.PRIVANOTE_ONEDRIVE_CLIENT_ID || 'privanote-desktop-onedrive-client').trim();
}

function resolveOneDriveRedirectUri(baseUrl) {
  return `${String(baseUrl || '').replace(/\/+$/, '')}/api/v1/sync/providers/onedrive/callback`;
}

function buildOneDriveAuthorizationUrl({ baseUrl, state, codeChallenge }) {
  const params = new URLSearchParams({
    client_id: resolveOneDriveClientId(),
    redirect_uri: resolveOneDriveRedirectUri(baseUrl),
    response_type: 'code',
    response_mode: 'query',
    scope: oneDriveScopes,
    state: String(state || ''),
    code_challenge: String(codeChallenge || ''),
    code_challenge_method: 'S256',
  });

  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
}

function resolveExpiryTimestamp(expiresIn) {
  const seconds = Number(expiresIn || 0);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }

  return new Date(Date.now() + seconds * 1000).toISOString();
}

async function parseJsonResponse(response, fallbackMessage) {
  let body = null;

  try {
    body = await response.json();
  } catch (_error) {
    body = null;
  }

  if (!response.ok) {
    throw new Error(body?.error_description || body?.error?.message || fallbackMessage);
  }

  return body;
}

async function graphJson(url, { accessToken, method = 'GET', headers = {}, body } = {}) {
  requireFetch();
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...headers,
    },
    body,
  });

  return parseJsonResponse(response, 'OneDrive request failed.');
}

async function fetchOneDriveAccountLabel(accessToken) {
  const body = await graphJson('https://graph.microsoft.com/v1.0/me?$select=displayName,userPrincipalName', {
    accessToken,
  });
  return body.userPrincipalName || body.displayName || '';
}

async function exchangeOneDriveCode({ baseUrl, code, codeVerifier }) {
  requireFetch();
  const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: resolveOneDriveClientId(),
      code: String(code || ''),
      code_verifier: String(codeVerifier || ''),
      grant_type: 'authorization_code',
      redirect_uri: resolveOneDriveRedirectUri(baseUrl),
    }),
  });
  const body = await parseJsonResponse(response, 'Unable to complete the OneDrive connection.');
  const accountLabel = await fetchOneDriveAccountLabel(body.access_token);

  return {
    accessToken: body.access_token || '',
    refreshToken: body.refresh_token || '',
    expiresAt: resolveExpiryTimestamp(body.expires_in),
    scope: body.scope || oneDriveScopes,
    accountLabel,
  };
}

async function refreshOneDriveConnection(connection) {
  requireFetch();
  const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: resolveOneDriveClientId(),
      grant_type: 'refresh_token',
      refresh_token: String(connection?.refreshToken || ''),
    }),
  });
  const body = await parseJsonResponse(response, 'Unable to refresh the OneDrive connection.');
  return {
    accessToken: body.access_token || '',
    refreshToken: body.refresh_token || connection?.refreshToken || '',
    expiresAt: resolveExpiryTimestamp(body.expires_in),
    scope: body.scope || connection?.scope || oneDriveScopes,
    accountLabel: connection?.accountLabel || '',
    rootFolderId: connection?.rootFolderId || '',
    rootFolderUrl: connection?.rootFolderUrl || '',
  };
}

async function lookupOneDriveChildFolder({ accessToken, parentId, name }) {
  const children = await graphJson(
    `https://graph.microsoft.com/v1.0/me/drive/items/${parentId}/children?$select=id,name,webUrl,folder`,
    {
      accessToken,
    }
  );
  const match = (children.value || []).find((item) => item.name === name && item.folder);
  return match
    ? {
        id: match.id,
        url: match.webUrl || '',
      }
    : null;
}

async function createOneDriveFolder({ accessToken, parentId, name }) {
  const body = await graphJson(`https://graph.microsoft.com/v1.0/me/drive/items/${parentId}/children`, {
    accessToken,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      folder: {},
      '@microsoft.graph.conflictBehavior': 'replace',
    }),
  });
  return {
    id: body.id,
    url: body.webUrl || '',
  };
}

async function ensureOneDriveRootFolder(connection) {
  if (connection?.rootFolderId && connection?.rootFolderUrl) {
    return {
      rootFolderId: connection.rootFolderId,
      rootFolderUrl: connection.rootFolderUrl,
    };
  }

  requireFetch();
  const appRootResponse = await fetch(`https://graph.microsoft.com/v1.0/${oneDriveRootPath}?$select=id,name,webUrl`, {
    headers: {
      Authorization: `Bearer ${connection.accessToken}`,
    },
  });

  if (appRootResponse.ok) {
    const body = await appRootResponse.json();
    return {
      rootFolderId: body.id,
      rootFolderUrl: body.webUrl || '',
    };
  }

  const root = await graphJson('https://graph.microsoft.com/v1.0/me/drive/root?$select=id,webUrl', {
    accessToken: connection.accessToken,
  });
  const existing = await lookupOneDriveChildFolder({
    accessToken: connection.accessToken,
    parentId: root.id,
    name: oneDriveRootFolderName,
  });
  if (existing) {
    return {
      rootFolderId: existing.id,
      rootFolderUrl: existing.url,
    };
  }

  const created = await createOneDriveFolder({
    accessToken: connection.accessToken,
    parentId: root.id,
    name: oneDriveRootFolderName,
  });
  return {
    rootFolderId: created.id,
    rootFolderUrl: created.url,
  };
}

async function ensureOneDriveNoteFolder({ connection, nodeId }) {
  const root = await ensureOneDriveRootFolder(connection);
  const name = `note-${nodeId}`;
  const existing = await lookupOneDriveChildFolder({
    accessToken: connection.accessToken,
    parentId: root.rootFolderId,
    name,
  });

  const noteFolder =
    existing ||
    (await createOneDriveFolder({
      accessToken: connection.accessToken,
      parentId: root.rootFolderId,
      name,
    }));

  return {
    rootFolderId: root.rootFolderId,
    rootFolderUrl: root.rootFolderUrl,
    noteFolderId: noteFolder.id,
    noteFolderUrl: noteFolder.url,
  };
}

async function uploadSmallFile({
  accessToken,
  parentId,
  name,
  buffer,
  existingItemId = '',
  mimeType: contentType,
}) {
  const encodedName = encodeURIComponent(name).replace(/%2F/g, '/');
  const url = existingItemId
    ? `https://graph.microsoft.com/v1.0/me/drive/items/${existingItemId}/content`
    : `https://graph.microsoft.com/v1.0/me/drive/items/${parentId}:/${encodedName}:/content`;

  return graphJson(url, {
    accessToken,
    method: 'PUT',
    headers: {
      'Content-Type': contentType || 'application/octet-stream',
    },
    body: buffer,
  });
}

async function uploadLargeFile({
  accessToken,
  parentId,
  name,
  buffer,
  existingItemId = '',
  mimeType: contentType,
}) {
  requireFetch();
  const encodedName = encodeURIComponent(name).replace(/%2F/g, '/');
  const sessionUrl = existingItemId
    ? `https://graph.microsoft.com/v1.0/me/drive/items/${existingItemId}/createUploadSession`
    : `https://graph.microsoft.com/v1.0/me/drive/items/${parentId}:/${encodedName}:/createUploadSession`;
  const sessionResponse = await fetch(sessionUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      item: {
        '@microsoft.graph.conflictBehavior': 'replace',
        name,
      },
    }),
  });

  const sessionBody = await parseJsonResponse(sessionResponse, 'Unable to createUploadSession for OneDrive.');
  const uploadUrl = sessionBody.uploadUrl;
  let start = 0;

  while (start < buffer.length) {
    const end = Math.min(start + oneDriveUploadChunkSize, buffer.length) - 1;
    const chunk = buffer.subarray(start, end + 1);

    if (chunk.length !== buffer.length && chunk.length % oneDriveChunkAlignment !== 0 && end + 1 < buffer.length) {
      throw new Error(`OneDrive upload chunks must align to ${oneDriveChunkAlignment} bytes.`);
    }

    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Length': String(chunk.length),
        'Content-Range': `bytes ${start}-${end}/${buffer.length}`,
        'Content-Type': contentType || 'application/octet-stream',
      },
      body: chunk,
    });

    if (response.status === 202) {
      start = end + 1;
      continue;
    }

    return parseJsonResponse(response, 'OneDrive upload failed.');
  }

  throw new Error('OneDrive upload session did not complete.');
}

async function uploadOneDriveContent({
  accessToken,
  parentId,
  name,
  buffer,
  existingItemId = '',
  mimeType: contentType,
}) {
  if (buffer.length > oneDriveUploadThreshold) {
    return uploadLargeFile({
      accessToken,
      parentId,
      name,
      buffer,
      existingItemId,
      mimeType: contentType,
    });
  }

  return uploadSmallFile({
    accessToken,
    parentId,
    name,
    buffer,
    existingItemId,
    mimeType: contentType,
  });
}

function buildMetadataPayload({ node, attachment, provider, transcript, sync }) {
  return {
    noteId: node.id,
    noteTitle: node.title,
    attachmentId: attachment.id,
    attachmentKind: attachment.kind,
    provider,
    transcriptStatus: transcript?.status || 'pending',
    transcriptUpdatedAt: transcript?.updated_at || null,
    syncedAt: new Date().toISOString(),
    remoteMediaItemId: sync?.remoteMediaItemId || sync?.remote_media_item_id || '',
    remoteTranscriptItemId: sync?.remoteTranscriptItemId || sync?.remote_transcript_item_id || '',
    remoteMetadataItemId: sync?.remoteMetadataItemId || sync?.remote_metadata_item_id || '',
  };
}

async function uploadOneDriveMediaBundle({ connection, attachment, node, transcript, sync }) {
  const folders = await ensureOneDriveNoteFolder({
    connection,
    nodeId: node.id,
  });
  const mediaBuffer = fs.readFileSync(attachment.local_path);
  const mediaUpload = await uploadOneDriveContent({
    accessToken: connection.accessToken,
    parentId: folders.noteFolderId,
    name: path.basename(attachment.local_path),
    buffer: mediaBuffer,
    existingItemId: sync?.remoteMediaItemId || sync?.remote_media_item_id || '',
    mimeType: mime.lookup(attachment.local_path) || 'application/octet-stream',
  });

  let remoteTranscriptItemId = sync?.remoteTranscriptItemId || sync?.remote_transcript_item_id || '';
  let remoteMetadataItemId = sync?.remoteMetadataItemId || sync?.remote_metadata_item_id || '';
  const transcriptReady = transcript?.status === 'succeeded';

  if (transcriptReady) {
    const transcriptUpload = await uploadOneDriveContent({
      accessToken: connection.accessToken,
      parentId: folders.noteFolderId,
      name: transcriptFileName,
      buffer: Buffer.from(String(transcript.text || ''), 'utf8'),
      existingItemId: remoteTranscriptItemId,
      mimeType: 'text/plain; charset=utf-8',
    });
    remoteTranscriptItemId = transcriptUpload.id;
  }

  const metadataUpload = await uploadOneDriveContent({
    accessToken: connection.accessToken,
    parentId: folders.noteFolderId,
    name: metadataFileName,
    buffer: Buffer.from(
      JSON.stringify(
        buildMetadataPayload({
          node,
          attachment,
          provider: 'onedrive',
          transcript,
          sync: {
            remoteMediaItemId: mediaUpload.id,
            remoteTranscriptItemId,
            remoteMetadataItemId,
          },
        }),
        null,
        2
      ),
      'utf8'
    ),
    existingItemId: remoteMetadataItemId,
    mimeType: 'application/json; charset=utf-8',
  });
  remoteMetadataItemId = metadataUpload.id;

  return {
    rootFolderId: folders.rootFolderId,
    rootFolderUrl: folders.rootFolderUrl,
    noteFolderId: folders.noteFolderId,
    noteFolderUrl: folders.noteFolderUrl,
    remoteMediaItemId: mediaUpload.id,
    remoteTranscriptItemId,
    remoteMetadataItemId,
    remoteItemUrl: mediaUpload.webUrl || folders.noteFolderUrl || '',
    transcriptPatchPending: !transcriptReady,
  };
}

async function patchOneDriveTranscriptBundle({ connection, attachment, node, transcript, sync }) {
  const folders =
    sync?.remoteNoteFolderId || sync?.remote_note_folder_id
      ? {
          rootFolderId: connection.rootFolderId || '',
          rootFolderUrl: connection.rootFolderUrl || '',
          noteFolderId: sync.remoteNoteFolderId || sync.remote_note_folder_id,
          noteFolderUrl: sync.sync_remote_url || sync.remoteItemUrl || '',
        }
      : await ensureOneDriveNoteFolder({
          connection,
          nodeId: node.id,
        });

  const transcriptUpload = await uploadOneDriveContent({
    accessToken: connection.accessToken,
    parentId: folders.noteFolderId,
    name: transcriptFileName,
    buffer: Buffer.from(String(transcript?.text || ''), 'utf8'),
    existingItemId: sync?.remoteTranscriptItemId || sync?.remote_transcript_item_id || '',
    mimeType: 'text/plain; charset=utf-8',
  });

  const metadataUpload = await uploadOneDriveContent({
    accessToken: connection.accessToken,
    parentId: folders.noteFolderId,
    name: metadataFileName,
    buffer: Buffer.from(
      JSON.stringify(
        buildMetadataPayload({
          node,
          attachment,
          provider: 'onedrive',
          transcript,
          sync: {
            remoteMediaItemId: sync?.remoteMediaItemId || sync?.remote_media_item_id || '',
            remoteTranscriptItemId: transcriptUpload.id,
            remoteMetadataItemId: sync?.remoteMetadataItemId || sync?.remote_metadata_item_id || '',
          },
        }),
        null,
        2
      ),
      'utf8'
    ),
    existingItemId: sync?.remoteMetadataItemId || sync?.remote_metadata_item_id || '',
    mimeType: 'application/json; charset=utf-8',
  });

  return {
    rootFolderId: folders.rootFolderId || connection.rootFolderId || '',
    rootFolderUrl: folders.rootFolderUrl || connection.rootFolderUrl || '',
    noteFolderId: folders.noteFolderId,
    noteFolderUrl: folders.noteFolderUrl || sync?.sync_remote_url || '',
    remoteMediaItemId: sync?.remoteMediaItemId || sync?.remote_media_item_id || '',
    remoteTranscriptItemId: transcriptUpload.id,
    remoteMetadataItemId: metadataUpload.id,
    remoteItemUrl: sync?.sync_remote_url || sync?.remoteItemUrl || '',
    transcriptPatchPending: false,
  };
}

module.exports = {
  oneDriveScopes,
  oneDriveRootPath,
  oneDriveUploadThreshold,
  oneDriveUploadChunkSize,
  oneDriveChunkAlignment,
  buildOneDriveAuthorizationUrl,
  exchangeOneDriveCode,
  refreshOneDriveConnection,
  ensureOneDriveRootFolder,
  ensureOneDriveNoteFolder,
  uploadOneDriveMediaBundle,
  patchOneDriveTranscriptBundle,
};
