const nodesService = require('../services/nodes-service');

function handleRouteError(reply, error) {
  if (error.message === 'Node not found') {
    reply.code(404).send({ error: error.message });
    return;
  }

  reply.code(400).send({ error: error.message });
}

async function registerNodeRoutes(app) {
  app.get('/api/v1/nodes', async () => {
    return nodesService.listNodes();
  });

  app.post('/api/v1/nodes', async (request, reply) => {
    try {
      return nodesService.createNode(request.body);
    } catch (error) {
      handleRouteError(reply, error);
    }
  });

  app.put('/api/v1/nodes/:nodeId', async (request, reply) => {
    try {
      return nodesService.updateNode({
        ...request.body,
        id: Number(request.params.nodeId),
      });
    } catch (error) {
      handleRouteError(reply, error);
    }
  });

  app.delete('/api/v1/nodes/:nodeId', async (request, reply) => {
    try {
      return {
        deleted: nodesService.deleteNode(Number(request.params.nodeId)),
      };
    } catch (error) {
      handleRouteError(reply, error);
    }
  });
}

module.exports = {
  registerNodeRoutes,
};
