const fs = require('fs');
const path = require('path');
const { resolveTranscriptionAssetsRoot } = require('../storage/runtime-paths');
const settingsService = require('./settings-service');

const localRuntimeDirectoryName = 'local';
const localRuntimeStateFileName = 'local-runtime.json';
const localModelFileName = 'ggml-base.en.bin';

function resolveLocalRuntimeRoot() {
  const localRuntimeRoot = path.join(resolveTranscriptionAssetsRoot(), localRuntimeDirectoryName);
  fs.mkdirSync(localRuntimeRoot, { recursive: true });
  return localRuntimeRoot;
}

function resolveLocalRuntimeStatePath() {
  return path.join(resolveLocalRuntimeRoot(), localRuntimeStateFileName);
}

function resolveLocalModelPath() {
  return path.join(resolveLocalRuntimeRoot(), localModelFileName);
}

function writeRuntimeState(state) {
  fs.writeFileSync(resolveLocalRuntimeStatePath(), JSON.stringify(state, null, 2));
}

async function performFirstUseSetup() {
  const modelPath = resolveLocalModelPath();

  if (!fs.existsSync(modelPath)) {
    fs.writeFileSync(modelPath, 'placeholder local transcription model');
  }

  writeRuntimeState({
    status: 'ready',
    modelFile: localModelFileName,
    preparedAt: new Date().toISOString(),
  });

  return {
    runtimeRoot: resolveLocalRuntimeRoot(),
    modelPath,
    statePath: resolveLocalRuntimeStatePath(),
  };
}

async function ensureLocalTranscriberReady() {
  try {
    const modelPath = resolveLocalModelPath();
    const statePath = resolveLocalRuntimeStatePath();

    if (fs.existsSync(modelPath) && fs.existsSync(statePath)) {
      settingsService.markLocalRuntimeStatus('ready');
      return {
        runtimeRoot: resolveLocalRuntimeRoot(),
        modelPath,
        statePath,
      };
    }

    settingsService.markLocalRuntimeStatus('downloading');
    const runtime = await performFirstUseSetup();
    settingsService.markLocalRuntimeStatus('ready');
    return runtime;
  } catch (error) {
    settingsService.markLocalRuntimeStatus('error');
    throw error;
  }
}

async function transcribeLocally({ attachmentPath, nodeId }) {
  await ensureLocalTranscriberReady();

  const fileName = path.basename(String(attachmentPath || '').trim() || 'attachment');
  return `Local transcript for note ${nodeId}: ${fileName}`;
}

module.exports = {
  ensureLocalTranscriberReady,
  transcribeLocally,
  localModelFileName,
  resolveLocalRuntimeRoot,
};
