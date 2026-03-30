const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const { v1 } = require('@privanote/backend/contracts');
const { startBackendProcess, stopBackendProcess } = require('./backend-process');

const operationsById = Object.values(v1.operations).reduce((result, operation) => {
  result[operation.id] = operation;
  return result;
}, {});

let backendContext = null;
let backendStartupPromise = null;
let isQuitting = false;

function resolveOperationPath(operation, payload = {}) {
  const nodeId = Number(payload.nodeId ?? payload.id);
  const attachmentId = Number(payload.attachmentId);

  return operation.path
    .replace(':nodeId', Number.isFinite(nodeId) ? String(nodeId) : ':nodeId')
    .replace(':attachmentId', Number.isFinite(attachmentId) ? String(attachmentId) : ':attachmentId');
}

async function proxyBackendRequest(request = {}) {
  const operation = operationsById[request.operationId];
  if (!operation) {
    throw new Error(`Unsupported backend operation: ${request.operationId}`);
  }

  const backend = await ensureBackendReady();
  const url = `${backend.baseUrl}${resolveOperationPath(operation, request.payload)}`;
  const init = {
    method: operation.method,
    headers: {
      Accept: 'application/json',
    },
  };

  if (operation.method === 'POST' || operation.method === 'PUT') {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(request.payload || {});
  }

  const response = await fetch(url, init);
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const message =
      body && typeof body === 'object' && 'error' in body ? body.error : body || `Backend request failed: ${response.status}`;
    throw new Error(message);
  }

  if (body && typeof body === 'object' && Object.prototype.hasOwnProperty.call(body, 'deleted')) {
    return body.deleted;
  }

  return body;
}

function bindBackendExit(child) {
  child.once('exit', (code) => {
    backendContext = null;

    if (!isQuitting && code && code !== 0) {
      dialog.showErrorBox(
        'Privanote backend stopped',
        'The local backend exited unexpectedly. Restart Privanote and try again.'
      );
    }
  });
}

async function ensureBackendReady() {
  if (backendContext) {
    return backendContext;
  }

  if (!backendStartupPromise) {
    const dataRoot = path.join(app.getPath('userData'), 'privanote');

    backendStartupPromise = startBackendProcess({
      dataRoot,
    })
      .then((context) => {
        backendContext = context;
        bindBackendExit(context.child);
        return context;
      })
      .finally(() => {
        backendStartupPromise = null;
      });
  }

  return backendStartupPromise;
}

async function shutdownBackend() {
  const activeContext = backendContext;
  backendContext = null;
  await stopBackendProcess(activeContext);
}

function registerIpcHandlers() {
  ipcMain.handle('backend:request', (_event, request) => proxyBackendRequest(request));

  ipcMain.handle('files:pick', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select media file',
      properties: ['openFile'],
      filters: [
        {
          name: 'Media and Files',
          extensions: ['mp3', 'wav', 'm4a', 'mp4', 'mov', 'mkv', 'webm', 'txt', 'json'],
        },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });
}

async function createWindow() {
  await ensureBackendReady();

  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (app.isPackaged) {
    win.loadFile(path.join(__dirname, '..', '..', 'dist', 'index.html'));
    return;
  }

  const url = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
  win.loadURL(url);
}

app.whenReady().then(async () => {
  registerIpcHandlers();

  try {
    await createWindow();
  } catch (error) {
    dialog.showErrorBox('Privanote failed to start', error.message || 'Unable to start the local backend.');
    await shutdownBackend();
    app.quit();
    return;
  }

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      try {
        await createWindow();
      } catch (error) {
        dialog.showErrorBox('Privanote failed to reopen', error.message || 'Unable to restart the local backend.');
      }
    }
  });
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', async () => {
  await shutdownBackend();

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

process.on('uncaughtException', async (error) => {
  dialog.showErrorBox('Privanote crashed', error.message || 'The desktop shell hit an unexpected error.');
  await shutdownBackend();
  process.exit(1);
});

process.on('unhandledRejection', async (error) => {
  const message = error instanceof Error ? error.message : 'The desktop shell hit an unexpected promise rejection.';
  dialog.showErrorBox('Privanote backend error', message);
  await shutdownBackend();
  process.exit(1);
});
