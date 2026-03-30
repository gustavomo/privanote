const Fastify = require('fastify');
const multipart = require('@fastify/multipart');
const { closeDatabase } = require('./storage/database');
const { registerNodeRoutes } = require('./routes/nodes');
const { registerAttachmentRoutes } = require('./routes/attachments');
const { registerMediaRoutes } = require('./routes/media');

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

  app.addHook('onClose', async () => {
    closeDatabase();
  });

  return app;
}

module.exports = {
  createServer,
};
