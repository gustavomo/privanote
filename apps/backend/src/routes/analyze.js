const analyzeService = require('../services/analyze-service');

async function registerAnalyzeRoutes(app) {
  app.post('/api/v1/analyze/pr', async (request, reply) => {
    try {
      return await analyzeService.startAnalysis(request.body);
    } catch (error) {
      reply.code(502).send({ error: error.message });
    }
  });

  app.get('/api/v1/analyze/pr/:jobId', async (request, reply) => {
    try {
      return await analyzeService.getAnalysisStatus(request.params.jobId);
    } catch (error) {
      if (error.message === 'Job not found') {
        reply.code(404).send({ error: error.message });
        return;
      }
      reply.code(502).send({ error: error.message });
    }
  });
}

module.exports = { registerAnalyzeRoutes };
