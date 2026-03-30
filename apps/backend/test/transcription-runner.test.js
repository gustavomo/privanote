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
  require.resolve('../src/services/sync-state-service.js'),
  require.resolve('../src/services/providers/google-drive-provider.js'),
  require.resolve('../src/services/providers/onedrive-provider.js'),
  require.resolve('../src/services/sync-runner.js'),
  require.resolve('../src/services/media-service.js'),
  require.resolve('../src/routes/nodes.js'),
  require.resolve('../src/routes/attachments.js'),
  require.resolve('../src/routes/media.js'),
  require.resolve('../src/routes/transcripts.js'),
  require.resolve('../src/routes/sync.js'),
  require.resolve('../src/contracts/v1/media.js'),
  require.resolve('../src/contracts/v1/transcripts.js'),
  require.resolve('../src/contracts/v1/sync.js'),
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

  throw new Error('Timed out waiting for transcript runner state.');
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

describe('transcription runner', () => {
  it('queues transcript jobs after media save, prepares the local runtime, and persists a succeeded transcript', async () => {
    const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'privanote-transcription-runner-local-'));
    const { createServer } = loadServer(dataRoot);
    app = await createServer();

    const form = new FormData();
    form.append('title', 'Audio note - Mar 30, 10:00 AM');
    form.append('captureMode', 'audio');
    form.append('mimeType', 'audio/webm');
    form.append('fileName', 'runner-audio.webm');
    form.append('file', Buffer.from('recorded bytes'), {
      filename: 'runner-audio.webm',
      contentType: 'audio/webm',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/media/recordings',
      headers: form.getHeaders(),
      payload: form.getBuffer(),
    });

    expect(response.statusCode).toBe(200);
    const { node } = response.json();

    const transcriptsService = require('../src/services/transcripts-service.js');
    const settingsService = require('../src/services/settings-service.js');

    await waitFor(() => {
      const transcript = transcriptsService.getNoteTranscript(node.id);
      expect(transcript).toMatchObject({
        node_id: node.id,
        status: 'succeeded',
        mode: 'local',
        provider: 'local',
      });
      expect(transcript.text).toContain('runner-audio.webm');
      return transcript;
    });

    expect(settingsService.getSettings()).toMatchObject({
      localRuntimeStatus: 'ready',
    });
    expect(
      fs.existsSync(path.join(dataRoot, 'transcription', 'local', 'local-runtime.json'))
    ).toBe(true);
    expect(fs.existsSync(path.join(dataRoot, 'transcription', 'local', 'ggml-base.en.bin'))).toBe(true);
  });

  it('persists provider preflight failures and exhausts retries after exactly three attempts', async () => {
    const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'privanote-transcription-runner-openai-'));
    const sourcePath = path.join(dataRoot, 'oversized.webm');
    fs.writeFileSync(sourcePath, 'video import bytes');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ data: [] }),
      }))
    );

    const statsSpy = vi.spyOn(fs, 'statSync').mockImplementation((targetPath) => {
      const actualStats = fs.lstatSync(targetPath);
      if (path.basename(String(targetPath)).includes('oversized')) {
        return {
          ...actualStats,
          size: 25 * 1024 * 1024 + 1,
        };
      }

      return actualStats;
    });

    const { createServer } = loadServer(dataRoot);
    app = await createServer();

    const settingsService = require('../src/services/settings-service.js');
    await settingsService.updateStoredSettings({
      transcriptionMode: 'backend',
      backendApiKey: 'sk-test-1234',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/media/imports',
      headers: {
        'content-type': 'application/json',
      },
      payload: {
        title: 'Imported media - Mar 30, 10:02 AM',
        kind: 'video',
        sourcePath,
      },
    });

    expect(response.statusCode).toBe(200);
    const { node } = response.json();
    const transcriptsService = require('../src/services/transcripts-service.js');

    await waitFor(() => {
      const transcript = transcriptsService.getNoteTranscript(node.id);
      expect(transcript).toMatchObject({
        status: 'failed',
        mode: 'backend',
        provider: 'openai',
        attempt_count: 3,
      });
      expect(transcript.last_error).toContain('25 MB');
      return transcript;
    });

    statsSpy.mockRestore();
  });

  it('resumes a queued transcript row when the backend starts again', async () => {
    const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'privanote-transcription-runner-resume-'));
    let serverModule = loadServer(dataRoot);
    app = await serverModule.createServer();

    const createNodeResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/nodes',
      headers: {
        'content-type': 'application/json',
      },
      payload: {
        title: 'Resume transcript note',
      },
    });

    const node = createNodeResponse.json();
    const attachmentPath = path.join(dataRoot, 'attachments', 'audio', 'resume-audio.webm');
    fs.mkdirSync(path.dirname(attachmentPath), { recursive: true });
    fs.writeFileSync(attachmentPath, 'resume bytes');

    const addAttachmentResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/nodes/${node.id}/attachments`,
      headers: {
        'content-type': 'application/json',
      },
      payload: {
        kind: 'audio',
        localPath: attachmentPath,
      },
    });

    const attachment = addAttachmentResponse.json();
    const runner = require('../src/services/transcription-runner.js');
    const transcriptsService = require('../src/services/transcripts-service.js');
    runner.stopTranscriptionRunner();
    transcriptsService.markTranscriptQueued({
      nodeId: node.id,
      attachmentId: attachment.id,
      mode: 'local',
      provider: 'local',
    });

    await app.close();
    app = null;

    serverModule = loadServer(dataRoot);
    app = await serverModule.createServer();

    await waitFor(() => {
      const transcript = require('../src/services/transcripts-service.js').getNoteTranscript(node.id);
      expect(transcript).toMatchObject({
        status: 'succeeded',
        node_id: node.id,
      });
      return transcript;
    });
  });
});
