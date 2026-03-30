const Fastify = require('fastify');
const { closeDatabase } = require('./storage/database');
const { registerNodeRoutes } = require('./routes/nodes');
const { registerAttachmentRoutes } = require('./routes/attachments');

async function createServer() {
  const app = Fastify({ logger: false });

  app.get('/health', async () => {
    return {
      status: 'ok',
    };
  });

  await registerNodeRoutes(app);
  await registerAttachmentRoutes(app);

  app.addHook('onClose', async () => {
    closeDatabase();
  });

  return app;
}

module.exports = {
  createServer,
};
