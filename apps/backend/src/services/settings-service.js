const path = require('path');
const { getDatabase } = require('../storage/database');
const { rememberConfiguredManagedAttachmentRoot } = require('../storage/attachment-files');
const { validateOpenAiKey } = require('./openai-transcription');

const validStorageDestinations = new Set(['local', 'google-drive', 'onedrive']);
const validTranscriptionModes = new Set(['local', 'backend']);
const validProviderKinds = new Set(['openai']);
const validRuntimeStatuses = new Set(['not-ready', 'downloading', 'ready', 'error']);

function maskBackendApiKey(apiKey) {
  const safeApiKey = String(apiKey || '').trim();
  if (!safeApiKey) {
    return '';
  }

  const lastCharacters = safeApiKey.slice(-4);
  return lastCharacters ? `••••${lastCharacters}` : '••••';
}

function mapSettingsRow(row, { includeSecrets = false } = {}) {
  if (!row) {
    return null;
  }

  const result = {
    id: row.id,
    storageDestination: row.storage_destination,
    localMediaDirectory: row.local_media_directory,
    transcriptionMode: row.transcription_mode,
    providerKind: row.provider_kind,
    localRuntimeStatus: row.local_runtime_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    backendApiKeyConfigured: Boolean(row.backend_api_key),
    backendApiKeyMaskedHint: maskBackendApiKey(row.backend_api_key),
  };

  if (includeSecrets) {
    result.backendApiKey = row.backend_api_key;
  }

  return result;
}

function readSettingsRow() {
  return getDatabase()
    .prepare(
      `
        SELECT
          id,
          storage_destination,
          local_media_directory,
          transcription_mode,
          provider_kind,
          backend_api_key,
          local_runtime_status,
          created_at,
          updated_at
        FROM settings
        WHERE id = 1
      `
    )
    .get();
}

function validateStorageDestination(storageDestination) {
  if (!validStorageDestinations.has(storageDestination)) {
    throw new Error('Storage destination must be local, google-drive, or onedrive');
  }
}

function validateTranscriptionMode(transcriptionMode) {
  if (!validTranscriptionModes.has(transcriptionMode)) {
    throw new Error('Transcription mode must be local or backend');
  }
}

function validateProviderKind(providerKind) {
  if (!validProviderKinds.has(providerKind)) {
    throw new Error('Provider kind must be openai');
  }
}

function validateRuntimeStatus(localRuntimeStatus) {
  if (!validRuntimeStatuses.has(localRuntimeStatus)) {
    throw new Error('Local runtime status must be not-ready, downloading, ready, or error');
  }
}

function validateLocalMediaDirectory(storageDestination, localMediaDirectory) {
  if (storageDestination !== 'local') {
    return;
  }

  if (!localMediaDirectory) {
    return;
  }

  if (!path.isAbsolute(String(localMediaDirectory || '').trim())) {
    throw new Error('Local media directory must be an absolute path');
  }
}

function getSettings(options = {}) {
  return mapSettingsRow(readSettingsRow(), options);
}

function normalizeSettingsUpdate(partial = {}) {
  const current = getSettings({ includeSecrets: true });
  const clearBackendApiKey = Boolean(partial.clearBackendApiKey);

  const next = {
    storageDestination:
      partial.storageDestination === undefined
        ? current.storageDestination
        : String(partial.storageDestination || '').trim(),
    localMediaDirectory:
      partial.localMediaDirectory === undefined
        ? current.localMediaDirectory
        : String(partial.localMediaDirectory || '').trim(),
    transcriptionMode:
      partial.transcriptionMode === undefined
        ? current.transcriptionMode
        : String(partial.transcriptionMode || '').trim(),
    providerKind:
      partial.providerKind === undefined ? current.providerKind : String(partial.providerKind || '').trim(),
    backendApiKey: clearBackendApiKey
      ? ''
      : partial.backendApiKey === undefined
        ? current.backendApiKey || ''
        : String(partial.backendApiKey || '').trim(),
    localRuntimeStatus:
      partial.localRuntimeStatus === undefined
        ? current.localRuntimeStatus
        : String(partial.localRuntimeStatus || '').trim(),
    clearBackendApiKey,
  };

  validateStorageDestination(next.storageDestination);
  validateTranscriptionMode(next.transcriptionMode);
  validateProviderKind(next.providerKind);
  validateRuntimeStatus(next.localRuntimeStatus);
  validateLocalMediaDirectory(next.storageDestination, next.localMediaDirectory);

  return next;
}

async function updateStoredSettings(partial = {}) {
  const next = normalizeSettingsUpdate(partial);

  if (next.transcriptionMode === 'backend' && !next.clearBackendApiKey) {
    await validateOpenAiKey(next.backendApiKey);
  }

  getDatabase()
    .prepare(
      `
        UPDATE settings
        SET storage_destination = @storage_destination,
            local_media_directory = @local_media_directory,
            transcription_mode = @transcription_mode,
            provider_kind = @provider_kind,
            backend_api_key = @backend_api_key,
            local_runtime_status = @local_runtime_status,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
      `
    )
    .run({
      storage_destination: next.storageDestination,
      local_media_directory: next.localMediaDirectory,
      transcription_mode: next.transcriptionMode,
      provider_kind: next.providerKind,
      backend_api_key: next.backendApiKey,
      local_runtime_status: next.localRuntimeStatus,
    });

  rememberConfiguredManagedAttachmentRoot(next);
  return getSettings();
}

function markLocalRuntimeStatus(status) {
  const localRuntimeStatus = String(status || '').trim();
  validateRuntimeStatus(localRuntimeStatus);

  getDatabase()
    .prepare(
      `
        UPDATE settings
        SET local_runtime_status = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
      `
    )
    .run(localRuntimeStatus);

  return getSettings();
}

module.exports = {
  getSettings,
  updateStoredSettings,
  markLocalRuntimeStatus,
  maskBackendApiKey,
};
