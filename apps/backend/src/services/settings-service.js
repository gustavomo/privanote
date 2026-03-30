const path = require('path');
const { getDatabase } = require('../storage/database');

const validStorageDestinations = new Set(['local', 'google-drive', 'onedrive']);
const validTranscriptionModes = new Set(['local', 'backend']);
const validProviderKinds = new Set(['openai']);
const validRuntimeStatuses = new Set(['not-ready', 'downloading', 'ready', 'error']);

function mapSettingsRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    storageDestination: row.storage_destination,
    localMediaDirectory: row.local_media_directory,
    transcriptionMode: row.transcription_mode,
    providerKind: row.provider_kind,
    backendApiKey: row.backend_api_key,
    localRuntimeStatus: row.local_runtime_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function isAbsoluteDirectoryPath(value) {
  return path.isAbsolute(String(value || '').trim());
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

  if (!isAbsoluteDirectoryPath(localMediaDirectory)) {
    throw new Error('Local media directory must be an absolute path');
  }
}

function getSettings() {
  const row = getDatabase()
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

  return mapSettingsRow(row);
}

function normalizeSettingsUpdate(partial = {}) {
  const current = getSettings();
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
    backendApiKey:
      partial.backendApiKey === undefined ? current.backendApiKey : String(partial.backendApiKey || '').trim(),
    localRuntimeStatus:
      partial.localRuntimeStatus === undefined
        ? current.localRuntimeStatus
        : String(partial.localRuntimeStatus || '').trim(),
  };

  validateStorageDestination(next.storageDestination);
  validateTranscriptionMode(next.transcriptionMode);
  validateProviderKind(next.providerKind);
  validateRuntimeStatus(next.localRuntimeStatus);
  validateLocalMediaDirectory(next.storageDestination, next.localMediaDirectory);

  return next;
}

function updateStoredSettings(partial = {}) {
  const next = normalizeSettingsUpdate(partial);

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

  return getSettings();
}

function markLocalRuntimeStatus(status) {
  const localRuntimeStatus = String(status || '').trim();
  validateRuntimeStatus(localRuntimeStatus);
  return updateStoredSettings({ localRuntimeStatus });
}

module.exports = {
  getSettings,
  updateStoredSettings,
  markLocalRuntimeStatus,
};
