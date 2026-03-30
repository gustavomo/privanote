const transcriptsService = require('../services/transcripts-service');
const { retryTranscriptJob } = require('../services/transcription-runner');

function handleRouteError(reply, error) {
  const statusCode = Number(error.statusCode) || (error.message === 'Node not found' ? 404 : 400);
  reply.code(statusCode).send({ error: error.message });
}

async function registerTranscriptRoutes(app) {
  app.get('/api/v1/nodes/:nodeId/transcript', async (request, reply) => {
    try {
      return transcriptsService.getNoteTranscript(Number(request.params.nodeId));
    } catch (error) {
      handleRouteError(reply, error);
    }
  });

  app.post('/api/v1/nodes/:nodeId/transcript/retry', async (request, reply) => {
    try {
      return retryTranscriptJob(Number(request.params.nodeId));
    } catch (error) {
      handleRouteError(reply, error);
    }
  });
}

module.exports = {
  registerTranscriptRoutes,
};
