const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const DEFAULT_BACKEND_PORT = Number(process.env.PRIVANOTE_BACKEND_PORT || 4310);

function resolveDevelopmentBackendEntryPoint() {
  return path.resolve(__dirname, '..', '..', '..', 'backend', 'src', 'index.js');
}

function resolvePackagedBackendEntryPoint() {
  return path.join(process.resourcesPath, 'backend', 'index.js');
}

function resolveBackendEntryPoint(packaged = false) {
  const candidate = packaged ? resolvePackagedBackendEntryPoint() : resolveDevelopmentBackendEntryPoint();

  if (!fs.existsSync(candidate)) {
    throw new Error(`Unable to locate the backend runtime at ${candidate}`);
  }

  return candidate;
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

async function startBackendProcess({ dataRoot, port = DEFAULT_BACKEND_PORT, packaged = false } = {}) {
  const backendEntryPoint = resolveBackendEntryPoint(packaged);
  const baseUrl = `http://127.0.0.1:${port}`;
  let stderrOutput = '';
  const child = spawn(process.execPath, [backendEntryPoint], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      PORT: String(port),
      PRIVANOTE_DATA_DIR: dataRoot,
      PRIVANOTE_RESOURCES_PATH: process.resourcesPath || '',
    },
    stdio: ['ignore', 'ignore', 'pipe'],
  });

  child.stderr?.on('data', (chunk) => {
    stderrOutput += chunk.toString();

    if (process.env.PRIVANOTE_SMOKE_NO_WINDOW === '1') {
      process.stderr.write(chunk);
    }
  });

  try {
    await waitForBackendHealth(baseUrl);
  } catch (error) {
    await stopBackendProcess({ child });
    const detail = stderrOutput.trim();
    throw new Error(detail ? `${error.message}\n${detail}` : error.message);
  }

  return {
    child,
    port,
    baseUrl,
    dataRoot,
    packaged,
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
