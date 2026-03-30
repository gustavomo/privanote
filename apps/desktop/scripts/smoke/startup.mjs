import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
const authPattern = /\b(auth|credential|sign[\s-]?in|login)\b/i;
const npmBinary = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealth(port, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // The desktop shell may still be starting the backend.
    }

    await wait(250);
  }

  throw new Error(`Timed out waiting for backend health on port ${port}.`);
}

async function stopProcess(child) {
  if (!child || child.killed) {
    return;
  }

  child.kill('SIGTERM');

  await new Promise((resolve) => {
    child.once('exit', resolve);
    setTimeout(resolve, 5000);
  });
}

const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'privanote-dev-smoke-'));
const port = 4320;
let output = '';
const childEnv = {
  ...process.env,
  PRIVANOTE_BACKEND_PORT: String(port),
  PRIVANOTE_DATA_DIR: path.join(smokeRoot, 'data'),
  PRIVANOTE_SMOKE_NO_WINDOW: '1',
};

delete childEnv.ELECTRON_RUN_AS_NODE;

const child = spawn(npmBinary, ['run', 'dev:main', '--workspace', '@privanote/desktop'], {
  cwd: repoRoot,
  env: childEnv,
  stdio: ['ignore', 'pipe', 'pipe'],
});

child.stdout.on('data', (chunk) => {
  output += chunk.toString();
});

child.stderr.on('data', (chunk) => {
  output += chunk.toString();
});

try {
  await waitForHealth(port);

  if (authPattern.test(output)) {
    throw new Error('Smoke output referenced auth or credential requirements.');
  }
} finally {
  await stopProcess(child);
}
