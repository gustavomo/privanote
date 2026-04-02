const Fastify = require('fastify');
const multipart = require('@fastify/multipart');
const { closeDatabase } = require('./storage/database');
const { registerNodeRoutes } = require('./routes/nodes');
const { registerAttachmentRoutes } = require('./routes/attachments');
const { registerMediaRoutes } = require('./routes/media');
const { registerTranscriptRoutes } = require('./routes/transcripts');
const { registerSettingsRoutes } = require('./routes/settings');
const { registerSyncRoutes } = require('./routes/sync');
const { resumePendingTranscriptJobs, stopTranscriptionRunner } = require('./services/transcription-runner');
const { resumePendingSyncJobs, stopSyncRunner } = require('./services/sync-runner');
const { registerAnalyzeRoutes } = require('./routes/analyze');
const { registerInternalRoutes } = require('./routes/internal');

async function createServer() {
  const app = Fastify({ logger: false });

  await app.register(multipart, {
    limits: {
      files: 1,
      parts: 6,
    },
  });

  app.get('/health', async () => {
    return {
      status: 'ok',
    };
  });

  await registerNodeRoutes(app);
  await registerAttachmentRoutes(app);
  await registerMediaRoutes(app);
  await registerTranscriptRoutes(app);
  await registerSettingsRoutes(app);
  await registerSyncRoutes(app);
  // PR analysis routes -- only registered when feature is enabled (per D-01)
  if (process.env.PRIVANOTE_PR_ANALYSIS === 'true') {
    await registerAnalyzeRoutes(app);
    await registerInternalRoutes(app);
  }

  resumePendingTranscriptJobs();
  resumePendingSyncJobs();

  app.addHook('onClose', async () => {
    stopTranscriptionRunner();
    stopSyncRunner();
    closeDatabase();
  });

  return app;
}

module.exports = {
  createServer,
};
