const mediaService = require('../services/media-service');

function resolveMultipartField(field) {
  if (field && typeof field === 'object' && Object.prototype.hasOwnProperty.call(field, 'value')) {
    return field.value;
  }

  return field;
}

function handleRouteError(reply, error) {
  const statusCode = Number(error.statusCode) || 400;
  reply.code(statusCode).send({ error: error.message });
}

async function registerMediaRoutes(app) {
  app.post('/api/v1/media/recordings', async (request, reply) => {
    try {
      const upload = await request.file();
      if (!upload) {
        throw new Error('Recording upload is required');
      }

      return mediaService.saveRecording({
        nodeId: resolveMultipartField(upload.fields.nodeId),
        title: resolveMultipartField(upload.fields.title),
        captureMode: resolveMultipartField(upload.fields.captureMode),
        mimeType: resolveMultipartField(upload.fields.mimeType) || upload.mimetype,
        fileName: resolveMultipartField(upload.fields.fileName) || upload.filename,
        stream: upload.file,
      });
    } catch (error) {
      handleRouteError(reply, error);
    }
  });
}

module.exports = {
  registerMediaRoutes,
};
