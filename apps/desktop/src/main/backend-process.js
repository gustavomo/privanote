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

function resolveBackendCommand(packaged = false) {
  if (packaged) {
    return process.execPath;
  }

  return process.env.npm_node_execpath || 'node';
}

function createBackendEnv({ dataRoot, port, packaged }) {
  const env = {
    ...process.env,
    PORT: String(port),
    PRIVANOTE_DATA_DIR: dataRoot,
  };

  if (packaged) {
    env.ELECTRON_RUN_AS_NODE = '1';
    env.PRIVANOTE_RESOURCES_PATH = process.resourcesPath || '';
    return env;
  }

  delete env.ELECTRON_RUN_AS_NODE;
  delete env.PRIVANOTE_RESOURCES_PATH;
  return env;
}

function formatBackendStartupError(error, detail = '') {
  const normalizedDetail = String(detail || '').trim();

  if (
    normalizedDetail.includes('better_sqlite3.node') &&
    normalizedDetail.includes('NODE_MODULE_VERSION')
  ) {
    return [
      'better-sqlite3 is out of sync with the Node runtime used for the local backend.',
      'Run `npm run rebuild:native` from the repo root, then restart Privanote.',
      normalizedDetail,
    ].join('\n');
  }

  return normalizedDetail ? `${error.message}\n${normalizedDetail}` : error.message;
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
  const backendCommand = resolveBackendCommand(packaged);
  const backendEntryPoint = resolveBackendEntryPoint(packaged);
  const baseUrl = `http://127.0.0.1:${port}`;
  let stderrOutput = '';
  const child = spawn(backendCommand, [backendEntryPoint], {
    env: createBackendEnv({ dataRoot, port, packaged }),
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
    throw new Error(formatBackendStartupError(error, detail));
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
  formatBackendStartupError,
  startBackendProcess,
  stopBackendProcess,
  waitForBackendHealth,
};
