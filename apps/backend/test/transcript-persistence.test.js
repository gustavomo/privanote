const fs = require('fs');
const os = require('os');
const path = require('path');
const FormData = require('form-data');

const modulePaths = [
  require.resolve('../src/storage/attachment-files.js'),
  require.resolve('../src/storage/runtime-paths.js'),
  require.resolve('../src/storage/media-files.js'),
  require.resolve('../src/storage/database.js'),
  require.resolve('../src/services/nodes-service.js'),
  require.resolve('../src/services/attachments-service.js'),
  require.resolve('../src/services/settings-service.js'),
  require.resolve('../src/services/transcripts-service.js'),
  require.resolve('../src/services/local-transcription.js'),
  require.resolve('../src/services/openai-transcription.js'),
  require.resolve('../src/services/transcription-runner.js'),
  require.resolve('../src/services/media-service.js'),
  require.resolve('../src/routes/nodes.js'),
  require.resolve('../src/routes/attachments.js'),
  require.resolve('../src/routes/media.js'),
  require.resolve('../src/routes/transcripts.js'),
  require.resolve('../src/routes/settings.js'),
  require.resolve('../src/contracts/v1/transcripts.js'),
  require.resolve('../src/contracts/v1/settings.js'),
  require.resolve('../src/contracts/index.js'),
  require.resolve('../src/server.js'),
];

let app = null;

function resetServerModules() {
  modulePaths.forEach((modulePath) => {
    delete require.cache[modulePath];
  });
}

function loadServer(dataRoot) {
  process.env.PRIVANOTE_DATA_DIR = dataRoot;
  resetServerModules();
  return require('../src/server.js');
}

async function waitFor(check, { timeoutMs = 3000, intervalMs = 25 } = {}) {
  const startedAt = Date.now();

  while (Date.now() - startedAt <= timeoutMs) {
    try {
      return await check();
    } catch (error) {
      if (Date.now() - startedAt > timeoutMs) {
        throw error;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error('Timed out waiting for transcript persistence state.');
}

afterEach(async () => {
  if (app) {
    await app.close();
    app = null;
  }

  delete process.env.PRIVANOTE_DATA_DIR;
  resetServerModules();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('transcript persistence', () => {
  it('keeps transcript status and settings available after recreating the backend', async () => {
    const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'privanote-transcript-persistence-'));
    let serverModule = loadServer(dataRoot);
    app = await serverModule.createServer();

    const form = new FormData();
    form.append('title', 'Audio note - Mar 30, 11:15 AM');
    form.append('captureMode', 'audio');
    form.append('mimeType', 'audio/webm');
    form.append('fileName', 'persisted-audio.webm');
    form.append('file', Buffer.from('recorded bytes'), {
      filename: 'persisted-audio.webm',
      contentType: 'audio/webm',
    });

    const recordingResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/media/recordings',
      headers: form.getHeaders(),
      payload: form.getBuffer(),
    });

    expect(recordingResponse.statusCode).toBe(200);
    const { node } = recordingResponse.json();

    await waitFor(() => {
      const transcript = require('../src/services/transcripts-service.js').getNoteTranscript(node.id);
      expect(transcript).toMatchObject({
        status: 'succeeded',
        node_id: node.id,
      });
      return transcript;
    });

    await app.close();
    app = null;

    serverModule = loadServer(dataRoot);
    app = await serverModule.createServer();

    const transcriptResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/nodes/${node.id}/transcript`,
    });

    expect(transcriptResponse.statusCode).toBe(200);
    expect(transcriptResponse.json()).toMatchObject({
      status: 'succeeded',
      node_id: node.id,
      text: expect.stringContaining('persisted-audio.webm'),
    });

    const settingsResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/settings',
    });

    expect(settingsResponse.statusCode).toBe(200);
    expect(settingsResponse.json()).toMatchObject({
      localRuntimeStatus: 'ready',
      transcriptionMode: 'local',
    });
  });

  it('ends in failed after three attempts and can be requeued through retryNoteTranscript', async () => {
    const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'privanote-transcript-retry-'));
    const serverModule = loadServer(dataRoot);
    const localTranscription = require('../src/services/local-transcription.js');
    const transcriptionSpy = vi
      .spyOn(localTranscription, 'transcribeLocally')
      .mockRejectedValue(new Error('Local runtime failed.'));

    app = await serverModule.createServer();

    const form = new FormData();
    form.append('title', 'Audio note - Mar 30, 11:18 AM');
    form.append('captureMode', 'audio');
    form.append('mimeType', 'audio/webm');
    form.append('fileName', 'retry-audio.webm');
    form.append('file', Buffer.from('retry bytes'), {
      filename: 'retry-audio.webm',
      contentType: 'audio/webm',
    });

    const recordingResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/media/recordings',
      headers: form.getHeaders(),
      payload: form.getBuffer(),
    });

    expect(recordingResponse.statusCode).toBe(200);
    const { node } = recordingResponse.json();

    await waitFor(() => {
      const transcript = require('../src/services/transcripts-service.js').getNoteTranscript(node.id);
      expect(transcript).toMatchObject({
        status: 'failed',
        attempt_count: 3,
      });
      expect(transcript.last_error).toContain('Local runtime failed.');
      return transcript;
    });

    transcriptionSpy.mockResolvedValue('Recovered transcript text');

    const retryResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/nodes/${node.id}/transcript/retry`,
    });

    expect(retryResponse.statusCode).toBe(200);
    expect(retryResponse.json()).toMatchObject({
      status: 'queued',
      node_id: node.id,
    });

    await waitFor(() => {
      const transcript = require('../src/services/transcripts-service.js').getNoteTranscript(node.id);
      expect(transcript).toMatchObject({
        status: 'succeeded',
        node_id: node.id,
        text: 'Recovered transcript text',
      });
      return transcript;
    });
  });
});
