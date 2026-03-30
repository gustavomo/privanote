const { getDatabase } = require('../storage/database');
const settingsService = require('./settings-service');
const transcriptsService = require('./transcripts-service');
const localTranscription = require('./local-transcription');
const openAiTranscription = require('./openai-transcription');

const maxTranscriptAttempts = 3;

const runnerState = {
  started: false,
  queuedNodeIds: new Set(),
  activeNodeIds: new Set(),
  scheduled: false,
};

function resetQueueState() {
  runnerState.started = false;
  runnerState.queuedNodeIds.clear();
  runnerState.activeNodeIds.clear();
  runnerState.scheduled = false;
}

function readAttachmentForTranscript(nodeId) {
  const row = getDatabase()
    .prepare(
      `
        SELECT a.id, a.node_id, a.kind, a.local_path
        FROM attachments a
        INNER JOIN transcripts t ON t.attachment_id = a.id
        WHERE t.node_id = ?
      `
    )
    .get(nodeId);

  if (!row) {
    const error = new Error('Attachment not found for transcript.');
    error.statusCode = 404;
    throw error;
  }

  return row;
}

async function runTranscriptAttempt(nodeId) {
  const existingTranscript = transcriptsService.getNoteTranscript(nodeId);
  if (!existingTranscript) {
    return null;
  }

  const attachment = readAttachmentForTranscript(nodeId);
  const settings = settingsService.getSettings({ includeSecrets: true });
  const mode = settings.transcriptionMode || 'local';
  const provider = mode === 'backend' ? settings.providerKind || 'openai' : 'local';
  const attemptCount = Number(existingTranscript.attempt_count || 0);

  transcriptsService.markTranscriptProcessing(nodeId);

  try {
    let text = '';

    if (mode === 'backend') {
      text = await openAiTranscription.transcribeWithOpenAi({
        attachmentPath: attachment.local_path,
        apiKey: settings.backendApiKey,
      });
    } else {
      text = await localTranscription.transcribeLocally({
        attachmentPath: attachment.local_path,
        nodeId,
      });
    }

    return transcriptsService.markTranscriptSucceeded({
      nodeId,
      attachmentId: attachment.id,
      text,
      mode,
      provider,
      attemptCount: attemptCount + 1,
    });
  } catch (error) {
    const nextAttemptCount = attemptCount + 1;

    if (nextAttemptCount >= maxTranscriptAttempts) {
      return transcriptsService.markTranscriptFailed({
        nodeId,
        attachmentId: attachment.id,
        mode,
        provider,
        attemptCount: nextAttemptCount,
        lastError: error.message || 'Transcript generation failed.',
      });
    }

    transcriptsService.markTranscriptQueued({
      nodeId,
      attachmentId: attachment.id,
      mode,
      provider,
      attemptCount: nextAttemptCount,
    });

    runnerState.queuedNodeIds.add(nodeId);
    scheduleQueueDrain();
    return transcriptsService.getNoteTranscript(nodeId);
  }
}

async function drainQueue() {
  if (!runnerState.started) {
    runnerState.scheduled = false;
    return;
  }

  const [nodeId] = runnerState.queuedNodeIds;
  if (nodeId === undefined) {
    runnerState.scheduled = false;
    return;
  }

  runnerState.queuedNodeIds.delete(nodeId);

  if (runnerState.activeNodeIds.has(nodeId)) {
    runnerState.scheduled = false;
    if (runnerState.queuedNodeIds.size > 0) {
      scheduleQueueDrain();
    }
    return;
  }

  runnerState.activeNodeIds.add(nodeId);

  try {
    await runTranscriptAttempt(nodeId);
  } finally {
    runnerState.activeNodeIds.delete(nodeId);
    runnerState.scheduled = false;

    if (runnerState.started && runnerState.queuedNodeIds.size > 0) {
      scheduleQueueDrain();
    }
  }
}

function scheduleQueueDrain() {
  if (!runnerState.started || runnerState.scheduled) {
    return;
  }

  runnerState.scheduled = true;
  queueMicrotask(() => {
    drainQueue().catch(() => {
      runnerState.scheduled = false;
    });
  });
}

function startTranscriptionRunner() {
  runnerState.started = true;
  scheduleQueueDrain();
}

function stopTranscriptionRunner() {
  resetQueueState();
}

function queueTranscriptJob({ nodeId, attachmentId }) {
  const settings = settingsService.getSettings({ includeSecrets: true });
  const mode = settings.transcriptionMode || 'local';
  const provider = mode === 'backend' ? settings.providerKind || 'openai' : 'local';
  const transcript = transcriptsService.markTranscriptQueued({
    nodeId,
    attachmentId,
    mode,
    provider,
    attemptCount: 0,
  });

  runnerState.queuedNodeIds.add(Number(nodeId));
  startTranscriptionRunner();
  return transcript;
}

function retryTranscriptJob(nodeId) {
  const existingTranscript = transcriptsService.getNoteTranscript(nodeId);
  if (!existingTranscript) {
    const error = new Error('Transcript not found');
    error.statusCode = 404;
    throw error;
  }

  const transcript = queueTranscriptJob({
    nodeId: existingTranscript.node_id,
    attachmentId: existingTranscript.attachment_id,
  });

  return transcript;
}

function resumePendingTranscriptJobs() {
  startTranscriptionRunner();

  transcriptsService.listPendingTranscripts().forEach((transcript) => {
    runnerState.queuedNodeIds.add(transcript.node_id);
  });

  scheduleQueueDrain();
}

module.exports = {
  maxTranscriptAttempts,
  startTranscriptionRunner,
  stopTranscriptionRunner,
  queueTranscriptJob,
  retryTranscriptJob,
  resumePendingTranscriptJobs,
  resetQueueState,
};
