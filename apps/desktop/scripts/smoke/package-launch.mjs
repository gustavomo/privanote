import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(__dirname, '..', '..');
const releaseRoot = path.join(desktopRoot, 'release');
const authPattern = /\b(auth|credential|sign[\s-]?in|login)\b/i;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function walk(currentPath) {
  const results = [];

  for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
    const entryPath = path.join(currentPath, entry.name);
    results.push(entryPath);

    if (entry.isDirectory()) {
      results.push(...walk(entryPath));
    }
  }

  return results;
}

function findPackagedBinary() {
  if (!fs.existsSync(releaseRoot)) {
    throw new Error('Packaged app not found. Run npm run dist --workspace @privanote/desktop first.');
  }

  const candidates = walk(releaseRoot).filter((entryPath) => {
    if (process.platform === 'darwin') {
      const parts = entryPath.split(path.sep);
      const macosIndex = parts.lastIndexOf('MacOS');
      return macosIndex !== -1 && parts[macosIndex - 1] === 'Contents' && fs.statSync(entryPath).isFile();
    }

    if (process.platform === 'win32') {
      return path.basename(entryPath).endsWith('.exe');
    }

    return path.basename(entryPath) === 'Privanote' && fs.statSync(entryPath).isFile();
  });

  if (!candidates.length) {
    throw new Error('Unable to locate the packaged Privanote binary in apps/desktop/release.');
  }

  const primaryMacBinary =
    process.platform === 'darwin'
      ? candidates.find((entryPath) => entryPath.endsWith(path.join('Privanote.app', 'Contents', 'MacOS', 'Privanote'))) ||
        candidates.find((entryPath) => entryPath.endsWith(path.join('Electron.app', 'Contents', 'MacOS', 'Electron')))
      : null;

  if (primaryMacBinary) {
    return primaryMacBinary;
  }

  return (
    candidates.find((entryPath) => entryPath.includes(`Privanote.app${path.sep}`)) ||
    candidates.find((entryPath) => path.basename(entryPath) === 'Privanote') ||
    [...candidates].sort((left, right) => left.split(path.sep).length - right.split(path.sep).length)[0]
  );
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
      // The packaged shell may still be starting the backend.
    }

    await wait(250);
  }

  throw new Error(`Timed out waiting for packaged backend health on port ${port}.`);
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

const binaryPath = findPackagedBinary();
const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'privanote-package-smoke-'));
const port = 4321;
let output = '';
const childEnv = {
  ...process.env,
  PRIVANOTE_BACKEND_PORT: String(port),
  PRIVANOTE_DATA_DIR: path.join(smokeRoot, 'data'),
  PRIVANOTE_SMOKE_NO_WINDOW: '1',
};

delete childEnv.ELECTRON_RUN_AS_NODE;

const child = spawn(binaryPath, [], {
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
    throw new Error('Packaged smoke output referenced auth or credential requirements.');
  }
} finally {
  await stopProcess(child);
}
