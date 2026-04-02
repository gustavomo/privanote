const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const DEFAULT_PR_SERVICE_PORT = Number(process.env.QODO_SERVICE_PORT || 8100);

function resolvePrServiceDir() {
  return path.resolve(__dirname, '..', '..', '..', '..', 'pr-analysis');
}

function resolveVenvPython(serviceDir) {
  return path.join(serviceDir, '.venv', 'bin', 'python');
}

function findPython3() {
  // Try python3.12, python3.11, python3 in order
  for (const cmd of ['python3.12', 'python3.11', 'python3']) {
    try {
      const version = execSync(`${cmd} --version 2>&1`, { timeout: 5000 }).toString().trim();
      const match = version.match(/Python (\d+)\.(\d+)/);
      if (match && (parseInt(match[1]) > 3 || (parseInt(match[1]) === 3 && parseInt(match[2]) >= 12))) {
        return cmd;
      }
    } catch { /* not found, try next */ }
  }
  return null;
}

async function ensureVenvReady(serviceDir) {
  const venvPython = resolveVenvPython(serviceDir);
  if (fs.existsSync(venvPython)) return true;

  const python3 = findPython3();
  if (!python3) {
    console.warn('[pr-insight] Python 3.12+ not found in PATH. PR analysis will not be available.');
    return false;
  }

  console.log('[pr-insight] Creating virtual environment...');
  try {
    execSync(`${python3} -m venv .venv`, { cwd: serviceDir, timeout: 30000 });
    console.log('[pr-insight] Installing dependencies (this may take 30-60 seconds on first run)...');
    execSync('.venv/bin/pip install -r requirements.txt', { cwd: serviceDir, timeout: 180000 });
    console.log('[pr-insight] Setup complete.');
    return true;
  } catch (error) {
    console.error(`[pr-insight] Venv setup failed: ${error.message}`);
    return false;
  }
}

async function waitForPrServiceHealth(baseUrl, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch { /* still starting */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`PR analysis service failed to start (health timeout at ${baseUrl}/health)`);
}

async function startPrService({ port = DEFAULT_PR_SERVICE_PORT } = {}) {
  const serviceDir = resolvePrServiceDir();
  if (!fs.existsSync(serviceDir)) {
    console.warn('[pr-insight] Service directory not found at', serviceDir);
    return null;
  }

  const venvReady = await ensureVenvReady(serviceDir);
  if (!venvReady) return null;

  const venvPython = resolveVenvPython(serviceDir);
  const baseUrl = `http://127.0.0.1:${port}`;

  const child = spawn(venvPython, [
    '-m', 'uvicorn', 'pr_insight.main:app',
    '--host', '127.0.0.1',
    '--port', String(port),
  ], {
    cwd: path.join(serviceDir, 'src'),
    env: { ...process.env, PYTHONPATH: path.join(serviceDir, 'src') },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stderrOutput = '';
  child.stderr?.on('data', (chunk) => {
    stderrOutput += chunk.toString();
    console.log('[pr-insight]', chunk.toString().trim());
  });
  child.stdout?.on('data', (chunk) => {
    console.log('[pr-insight]', chunk.toString().trim());
  });

  try {
    await waitForPrServiceHealth(baseUrl);
    console.log(`[pr-insight] Service ready at ${baseUrl}`);
    return { child, port, baseUrl };
  } catch (error) {
    await stopPrService({ child });
    console.error(`[pr-insight] Failed to start: ${error.message}`);
    if (stderrOutput) console.error('[pr-insight] stderr:', stderrOutput.slice(-500));
    return null;
  }
}

async function stopPrService(context) {
  if (!context?.child || context.child.killed) return;
  const child = context.child;
  await new Promise((resolve) => {
    const finish = () => resolve();
    child.once('exit', finish);
    child.kill('SIGTERM');
    setTimeout(() => {
      if (!child.killed) child.kill('SIGKILL');
      finish();
    }, 3000);
  });
}

module.exports = {
  DEFAULT_PR_SERVICE_PORT,
  findPython3,
  startPrService,
  stopPrService,
  waitForPrServiceHealth,
};
