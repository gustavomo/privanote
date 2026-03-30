const fs = require('fs');
const path = require('path');
const mime = require('mime-types');

const googleScope = 'https://www.googleapis.com/auth/drive.file';
const googleRootFolderName = 'Privanote';
const googleFolderMimeType = 'application/vnd.google-apps.folder';
const transcriptFileName = 'transcript.txt';
const metadataFileName = 'privanote.json';

function requireFetch() {
  if (typeof fetch !== 'function') {
    throw new Error('Google Drive sync is unavailable in this runtime.');
  }
}

function resolveGoogleClientId() {
  return String(process.env.PRIVANOTE_GOOGLE_CLIENT_ID || 'privanote-desktop-google-client').trim();
}

function resolveGoogleRedirectUri(baseUrl) {
  return `${String(baseUrl || '').replace(/\/+$/, '')}/api/v1/sync/providers/google-drive/callback`;
}

function buildGoogleAuthorizationUrl({ baseUrl, state, codeChallenge }) {
  const params = new URLSearchParams({
    client_id: resolveGoogleClientId(),
    redirect_uri: resolveGoogleRedirectUri(baseUrl),
    response_type: 'code',
    scope: googleScope,
    access_type: 'offline',
    prompt: 'consent',
    state: String(state || ''),
    code_challenge: String(codeChallenge || ''),
    code_challenge_method: 'S256',
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function parseJsonResponse(response, fallbackMessage) {
  let body = null;

  try {
    body = await response.json();
  } catch (_error) {
    body = null;
  }

  if (!response.ok) {
    throw new Error(body?.error_description || body?.error?.message || body?.error || fallbackMessage);
  }

  return body;
}

function resolveExpiryTimestamp(expiresIn) {
  const seconds = Number(expiresIn || 0);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }

  return new Date(Date.now() + seconds * 1000).toISOString();
}

async function fetchGoogleAccountLabel(accessToken) {
  requireFetch();
  const response = await fetch(
    'https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress)',
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  const body = await parseJsonResponse(response, 'Unable to load Google Drive account details.');
  return body?.user?.emailAddress || body?.user?.displayName || '';
}

async function exchangeGoogleCode({ baseUrl, code, codeVerifier }) {
  requireFetch();

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: resolveGoogleClientId(),
      code: String(code || ''),
      code_verifier: String(codeVerifier || ''),
      grant_type: 'authorization_code',
      redirect_uri: resolveGoogleRedirectUri(baseUrl),
    }),
  });

  const body = await parseJsonResponse(response, 'Unable to complete Google Drive connection.');
  const accountLabel = await fetchGoogleAccountLabel(body.access_token);

  return {
    accessToken: body.access_token || '',
    refreshToken: body.refresh_token || '',
    expiresAt: resolveExpiryTimestamp(body.expires_in),
    scope: body.scope || googleScope,
    accountLabel,
  };
}

async function refreshGoogleConnection(connection) {
  requireFetch();

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: resolveGoogleClientId(),
      grant_type: 'refresh_token',
      refresh_token: String(connection?.refreshToken || ''),
    }),
  });

  const body = await parseJsonResponse(response, 'Unable to refresh the Google Drive connection.');
  return {
    accessToken: body.access_token || '',
    refreshToken: body.refresh_token || connection?.refreshToken || '',
    expiresAt: resolveExpiryTimestamp(body.expires_in),
    scope: body.scope || connection?.scope || googleScope,
    accountLabel: connection?.accountLabel || '',
    rootFolderId: connection?.rootFolderId || '',
    rootFolderUrl: connection?.rootFolderUrl || '',
  };
}

function escapeGoogleQueryValue(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

async function googleDriveRequest(url, { accessToken, method = 'GET', headers = {}, body } = {}) {
  requireFetch();
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...headers,
    },
    body,
  });

  return parseJsonResponse(response, 'Google Drive request failed.');
}

async function ensureGoogleFolder({ accessToken, name, parentId = '' }) {
  const queryParts = [`mimeType='${googleFolderMimeType}'`, 'trashed=false', `name='${escapeGoogleQueryValue(name)}'`];
  if (parentId) {
    queryParts.push(`'${escapeGoogleQueryValue(parentId)}' in parents`);
  }

  const search = await googleDriveRequest(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      queryParts.join(' and ')
    )}&fields=files(id,name,webViewLink)&pageSize=1`,
    {
      accessToken,
    }
  );

  const existing = search?.files?.[0];
  if (existing) {
    return {
      id: existing.id,
      url: existing.webViewLink || '',
    };
  }

  return googleDriveRequest('https://www.googleapis.com/drive/v3/files?fields=id,webViewLink', {
    accessToken,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      mimeType: googleFolderMimeType,
      parents: parentId ? [parentId] : undefined,
    }),
  }).then((body) => ({
    id: body.id,
    url: body.webViewLink || '',
  }));
}

async function ensureGoogleRootFolder(connection) {
  if (connection?.rootFolderId && connection?.rootFolderUrl) {
    return {
      rootFolderId: connection.rootFolderId,
      rootFolderUrl: connection.rootFolderUrl,
    };
  }

  const root = await ensureGoogleFolder({
    accessToken: connection.accessToken,
    name: googleRootFolderName,
  });

  return {
    rootFolderId: root.id,
    rootFolderUrl: root.url,
  };
}

async function ensureGoogleNoteFolder({ connection, nodeId }) {
  const root = await ensureGoogleRootFolder(connection);
  const noteFolder = await ensureGoogleFolder({
    accessToken: connection.accessToken,
    name: `note-${nodeId}`,
    parentId: root.rootFolderId,
  });

  return {
    rootFolderId: root.rootFolderId,
    rootFolderUrl: root.rootFolderUrl,
    noteFolderId: noteFolder.id,
    noteFolderUrl: noteFolder.url,
  };
}

async function createGoogleUploadSession({
  accessToken,
  name,
  mimeType: contentType,
  parentId,
  existingItemId = '',
}) {
  requireFetch();
  const endpoint = existingItemId
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingItemId}?uploadType=resumable&fields=id,webViewLink`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,webViewLink';
  const response = await fetch(endpoint, {
    method: existingItemId ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Upload-Content-Type': contentType || 'application/octet-stream',
    },
    body: JSON.stringify({
      name,
      parents: parentId ? [parentId] : undefined,
    }),
  });

  if (!response.ok) {
    throw new Error('Unable to start the Google Drive upload session.');
  }

  return response.headers.get('location');
}

async function uploadGoogleBuffer({
  accessToken,
  buffer,
  name,
  mimeType: contentType,
  parentId,
  existingItemId = '',
}) {
  requireFetch();
  const sessionUrl = await createGoogleUploadSession({
    accessToken,
    name,
    mimeType: contentType,
    parentId,
    existingItemId,
  });

  const response = await fetch(sessionUrl, {
    method: 'PUT',
    headers: {
      'Content-Length': String(buffer.length),
      'Content-Type': contentType || 'application/octet-stream',
    },
    body: buffer,
  });

  return parseJsonResponse(response, 'Google Drive upload failed.');
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

async function uploadGoogleMediaBundle({ connection, attachment, node, transcript, sync }) {
  const folders = await ensureGoogleNoteFolder({
    connection,
    nodeId: node.id,
  });
  const mediaBuffer = fs.readFileSync(attachment.local_path);
  const mediaUpload = await uploadGoogleBuffer({
    accessToken: connection.accessToken,
    buffer: mediaBuffer,
    name: path.basename(attachment.local_path),
    mimeType: mime.lookup(attachment.local_path) || 'application/octet-stream',
    parentId: folders.noteFolderId,
    existingItemId: sync?.remoteMediaItemId || sync?.remote_media_item_id || '',
  });

  let remoteTranscriptItemId = sync?.remoteTranscriptItemId || sync?.remote_transcript_item_id || '';
  let remoteMetadataItemId = sync?.remoteMetadataItemId || sync?.remote_metadata_item_id || '';
  const transcriptReady = transcript?.status === 'succeeded';

  if (transcriptReady) {
    const transcriptUpload = await uploadGoogleBuffer({
      accessToken: connection.accessToken,
      buffer: Buffer.from(String(transcript.text || ''), 'utf8'),
      name: transcriptFileName,
      mimeType: 'text/plain; charset=utf-8',
      parentId: folders.noteFolderId,
      existingItemId: remoteTranscriptItemId,
    });
    remoteTranscriptItemId = transcriptUpload.id;
  }

  const metadataUpload = await uploadGoogleBuffer({
    accessToken: connection.accessToken,
    buffer: Buffer.from(
      JSON.stringify(
        buildMetadataPayload({
          node,
          attachment,
          provider: 'google-drive',
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
    name: metadataFileName,
    mimeType: 'application/json; charset=utf-8',
    parentId: folders.noteFolderId,
    existingItemId: remoteMetadataItemId,
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
    remoteItemUrl: mediaUpload.webViewLink || folders.noteFolderUrl || '',
    transcriptPatchPending: !transcriptReady,
  };
}

async function patchGoogleTranscriptBundle({ connection, attachment, node, transcript, sync }) {
  const folders =
    sync?.remoteNoteFolderId || sync?.remote_note_folder_id
      ? {
          rootFolderId: connection.rootFolderId || '',
          rootFolderUrl: connection.rootFolderUrl || '',
          noteFolderId: sync.remoteNoteFolderId || sync.remote_note_folder_id,
          noteFolderUrl: sync.sync_remote_url || sync.remoteItemUrl || '',
        }
      : await ensureGoogleNoteFolder({
          connection,
          nodeId: node.id,
        });

  const transcriptUpload = await uploadGoogleBuffer({
    accessToken: connection.accessToken,
    buffer: Buffer.from(String(transcript?.text || ''), 'utf8'),
    name: transcriptFileName,
    mimeType: 'text/plain; charset=utf-8',
    parentId: folders.noteFolderId,
    existingItemId: sync?.remoteTranscriptItemId || sync?.remote_transcript_item_id || '',
  });

  const metadataUpload = await uploadGoogleBuffer({
    accessToken: connection.accessToken,
    buffer: Buffer.from(
      JSON.stringify(
        buildMetadataPayload({
          node,
          attachment,
          provider: 'google-drive',
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
    name: metadataFileName,
    mimeType: 'application/json; charset=utf-8',
    parentId: folders.noteFolderId,
    existingItemId: sync?.remoteMetadataItemId || sync?.remote_metadata_item_id || '',
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
  googleScope,
  googleRootFolderName,
  googleFolderMimeType,
  transcriptFileName,
  metadataFileName,
  buildGoogleAuthorizationUrl,
  exchangeGoogleCode,
  refreshGoogleConnection,
  ensureGoogleRootFolder,
  ensureGoogleNoteFolder,
  uploadGoogleMediaBundle,
  patchGoogleTranscriptBundle,
};
