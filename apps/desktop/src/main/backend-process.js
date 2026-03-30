const { spawn } = require('child_process');
const path = require('path');

const DEFAULT_BACKEND_PORT = Number(process.env.PRIVANOTE_BACKEND_PORT || 4310);

function resolveBackendEntryPoint() {
  return path.resolve(__dirname, '..', '..', '..', 'backend', 'src', 'index.js');
}

async function waitForBackendHealth(baseUrl, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // The process may still be starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(`Timed out waiting for backend health at ${baseUrl}/health`);
}

async function startBackendProcess({ dataRoot, port = DEFAULT_BACKEND_PORT } = {}) {
  const backendEntryPoint = resolveBackendEntryPoint();
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [backendEntryPoint], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      PORT: String(port),
      PRIVANOTE_DATA_DIR: dataRoot,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  await waitForBackendHealth(baseUrl);

  return {
    child,
    port,
    baseUrl,
    dataRoot,
  };
}

async function stopBackendProcess(context) {
  if (!context?.child || context.child.killed) {
    return;
  }

  const child = context.child;

  await new Promise((resolve) => {
    const finish = () => resolve();
    child.once('exit', finish);
    child.kill();
    setTimeout(finish, 2000);
  });
}

module.exports = {
  DEFAULT_BACKEND_PORT,
  startBackendProcess,
  stopBackendProcess,
  waitForBackendHealth,
};
