const attachmentsService = require('../services/attachments-service');

function handleRouteError(reply, error) {
  if (error.message === 'Node not found') {
    reply.code(404).send({ error: error.message });
    return;
  }

  reply.code(400).send({ error: error.message });
}

async function registerAttachmentRoutes(app) {
  app.get('/api/v1/nodes/:nodeId/attachments', async (request) => {
    return attachmentsService.listAttachments(Number(request.params.nodeId));
  });

  app.post('/api/v1/nodes/:nodeId/attachments', async (request, reply) => {
    try {
      return attachmentsService.addAttachment({
        ...request.body,
        nodeId: Number(request.params.nodeId),
      });
    } catch (error) {
      handleRouteError(reply, error);
    }
  });

  app.delete('/api/v1/attachments/:attachmentId', async (request, reply) => {
    try {
      return {
        deleted: attachmentsService.deleteAttachment(Number(request.params.attachmentId)),
      };
    } catch (error) {
      handleRouteError(reply, error);
    }
  });
}

module.exports = {
  registerAttachmentRoutes,
};
