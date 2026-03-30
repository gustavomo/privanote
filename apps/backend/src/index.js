const { createServer } = require('./server');

async function startServer({ host = '127.0.0.1', port = Number(process.env.PORT || 4310) } = {}) {
  const server = await createServer();
  await server.listen({ host, port });
  return server;
}

if (require.main === module) {
  startServer().catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exit(1);
  });
}

module.exports = {
  startServer,
};
