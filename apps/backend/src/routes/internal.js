const nodesService = require('../services/nodes-service');

async function registerInternalRoutes(app) {
  app.post('/internal/pr-callback', async (request, reply) => {
    try {
      const { title, description, tags } = request.body;
      if (!title) {
        reply.code(400).send({ error: 'Title is required' });
        return;
      }
      const node = nodesService.createNode({
        title: String(title),
        description: String(description || ''),
        tags: String(tags || 'github-analysis'),
      });
      return { success: true, nodeId: node.id };
    } catch (error) {
      reply.code(500).send({ error: error.message });
    }
  });
}

module.exports = { registerInternalRoutes };
