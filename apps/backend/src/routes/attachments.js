const mime = require('mime-types');
const attachmentsService = require('../services/attachments-service');

function handleRouteError(reply, error) {
  const statusCode = Number(error.statusCode) || (error.message === 'Node not found' ? 404 : 400);
  reply.code(statusCode).send({ error: error.message });
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

  app.get('/api/v1/attachments/:attachmentId/content', async (request, reply) => {
    try {
      const { attachment, stream } = attachmentsService.getAttachmentContent(
        Number(request.params.attachmentId)
      );
      reply.type(mime.lookup(attachment.local_path) || 'application/octet-stream');
      return reply.send(stream);
    } catch (error) {
      handleRouteError(reply, error);
    }
  });
}

module.exports = {
  registerAttachmentRoutes,
};
