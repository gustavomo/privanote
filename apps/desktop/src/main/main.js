const { Blob } = require('buffer');
const { app, BrowserWindow, dialog, globalShortcut, ipcMain, screen, session, shell, systemPreferences } = require('electron');
const path = require('path');
const { v1 } = require('@privanote/backend/contracts');
const { resolveBackendErrorMessage } = require('./backend-response');
const { startBackendProcess, stopBackendProcess } = require('./backend-process');
const { CaptureSession } = require('./capture-session');
const { checkScreenPermission } = require('./screen-capture');

const operationsById = Object.values(v1.operations).reduce((result, operation) => {
  result[operation.id] = operation;
  return result;
}, {});
const isSmokeNoWindow = process.env.PRIVANOTE_SMOKE_NO_WINDOW === '1';

let backendContext = null;
let backendStartupPromise = null;
let isQuitting = false;
let captureOverlay = null;
let captureSession = null;
let mainWindow = null;

function resolveDataRoot() {
  const configuredRoot = String(process.env.PRIVANOTE_DATA_DIR || '').trim();
  return configuredRoot ? path.resolve(configuredRoot) : path.join(app.getPath('userData'), 'privanote');
}

function resolveOperationPath(operation, payload = {}) {
  const nodeId = Number(payload.nodeId ?? payload.id);
  const attachmentId = Number(payload.attachmentId);
  const provider = String(payload.provider || '').trim();

  return operation.path
    .replace(':nodeId', Number.isFinite(nodeId) ? String(nodeId) : ':nodeId')
    .replace(':attachmentId', Number.isFinite(attachmentId) ? String(attachmentId) : ':attachmentId')
    .replace(':provider', provider || ':provider');
}

async function parseBackendResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  return contentType.includes('application/json') ? response.json() : response.text();
}

function normalizeUploadBytes(bytes) {
  if (Buffer.isBuffer(bytes)) {
    return bytes;
  }

  if (bytes instanceof ArrayBuffer) {
    return Buffer.from(bytes);
  }

  if (ArrayBuffer.isView(bytes)) {
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  if (Array.isArray(bytes)) {
    return Buffer.from(bytes);
  }

  throw new Error('Recording bytes are required.');
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
  const body = await parseBackendResponse(response);

  if (!response.ok) {
    throw new Error(resolveBackendErrorMessage(body, response.status));
  }

  if (body && typeof body === 'object' && Object.prototype.hasOwnProperty.call(body, 'deleted')) {
    return body.deleted;
  }

  return body;
}

async function proxyBackendUpload(request = {}) {
  const operation = operationsById[request.operationId];
  if (!operation) {
    throw new Error(`Unsupported backend upload operation: ${request.operationId}`);
  }

  const backend = await ensureBackendReady();
  const formData = new FormData();
  const payload = request.payload || {};

  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }

    formData.append(key, String(value));
  });

  formData.append(
    'file',
    new Blob([normalizeUploadBytes(request.bytes)], {
      type: request.mimeType || 'application/octet-stream',
    }),
    request.fileName || 'recording.webm'
  );

  const response = await fetch(`${backend.baseUrl}${resolveOperationPath(operation, payload)}`, {
    method: operation.method,
    headers: {
      Accept: 'application/json',
    },
    body: formData,
  });
  const body = await parseBackendResponse(response);

  if (!response.ok) {
    throw new Error(resolveBackendErrorMessage(body, response.status));
  }

  return body;
}

function resolveMediaAccessStatus(mediaType) {
  if (!['camera', 'microphone'].includes(mediaType)) {
    throw new Error('Media type must be camera or microphone.');
  }

  if (process.platform !== 'darwin' || typeof systemPreferences.getMediaAccessStatus !== 'function') {
    return 'unknown';
  }

  return systemPreferences.getMediaAccessStatus(mediaType);
}

async function requestMediaAccess(mediaType) {
  const status = resolveMediaAccessStatus(mediaType);
  if (status === 'granted') {
    return {
      granted: true,
      status,
    };
  }

  if (process.platform !== 'darwin' || typeof systemPreferences.askForMediaAccess !== 'function') {
    return {
      granted: status !== 'denied',
      status,
    };
  }

  const granted = await systemPreferences.askForMediaAccess(mediaType);
  return {
    granted,
    status: resolveMediaAccessStatus(mediaType),
  };
}

function bindBackendExit(child) {
  child.once('exit', (code) => {
    backendContext = null;

    if (!isQuitting && code && code !== 0) {
      if (isSmokeNoWindow) {
        process.stderr.write('The local backend exited unexpectedly.\n');
        return;
      }

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
    const dataRoot = resolveDataRoot();

    backendStartupPromise = startBackendProcess({
      dataRoot,
      packaged: app.isPackaged,
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

function createCaptureOverlay() {
  if (isSmokeNoWindow) return null;

  const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;

  captureOverlay = new BrowserWindow({
    width: 64,
    height: 64,
    x: screenWidth - 80,
    y: 80,
    alwaysOnTop: true,
    frame: false,
    transparent: true,
    skipTaskbar: true,
    resizable: false,
    movable: true,
    hasShadow: false,
    focusable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload-capture.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  captureOverlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  captureOverlay.setAlwaysOnTop(true, 'floating');

  if (app.isPackaged) {
    captureOverlay.loadFile(path.join(__dirname, '..', '..', 'dist', 'capture-overlay', 'capture-overlay.html'));
  } else {
    const url = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
    captureOverlay.loadURL(`${url}/capture-overlay/capture-overlay.html`);
  }

  captureOverlay.on('closed', () => {
    captureOverlay = null;
  });

  return captureOverlay;
}

function broadcastCaptureState(state) {
  if (captureOverlay && !captureOverlay.isDestroyed()) {
    captureOverlay.webContents.send('capture:state-changed', state);
  }
}

async function toggleCaptureSession() {
  if (captureSession && captureSession.state === 'capturing') {
    const result = await captureSession.stop();
    if (result && result.captureCount > 0) {
      await createNoteFromSession(result);
    }
    return;
  }

  if (captureSession && captureSession.state === 'finalizing') {
    return;
  }

  const screenStatus = checkScreenPermission();
  if (screenStatus !== 'granted') {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('capture:permission-missing', {
        screen: screenStatus,
      });
    }
    return;
  }

  const dataRoot = resolveDataRoot();
  const sessionDir = path.join(dataRoot, 'captures', `session-${Date.now()}`);

  captureSession = new CaptureSession({
    savePath: sessionDir,
    onStateChange: broadcastCaptureState,
  });

  await captureSession.start();
}

async function createNoteFromSession(sessionResult) {
  const fs = require('fs');

  try {
    const node = await proxyBackendRequest({
      operationId: v1.nodes.createNode.id,
      payload: {
        title: sessionResult.title,
        description: buildSessionDescription(sessionResult),
        tags: sessionResult.appNames.join(','),
      },
    });

    for (const [appName, captures] of Object.entries(sessionResult.grouped)) {
      for (const cap of captures) {
        try {
          const bytes = fs.readFileSync(cap.screenshotPath);
          await proxyBackendUpload({
            operationId: v1.attachments.createAttachment.id,
            payload: { nodeId: node.id },
            fileName: cap.fileName || path.basename(cap.screenshotPath),
            mimeType: 'image/png',
            bytes,
          });
        } catch {
          // Skip failed uploads, continue with remaining
        }
      }
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('capture:note-created', { nodeId: node.id });
    }

    return node;
  } catch (error) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('capture:note-error', { message: error.message });
    }
    return null;
  }
}

function buildSessionDescription(sessionResult) {
  const lines = [];
  const durationSec = Math.round(sessionResult.duration / 1000);
  const minutes = Math.floor(durationSec / 60);
  const seconds = durationSec % 60;
  lines.push(`Duration: ${minutes}m ${seconds}s`);
  lines.push(`Captured from ${sessionResult.appNames.length} app${sessionResult.appNames.length !== 1 ? 's' : ''}`);
  lines.push(`${sessionResult.captureCount} screenshot${sessionResult.captureCount !== 1 ? 's' : ''}`);

  for (const [appName, captures] of Object.entries(sessionResult.grouped)) {
    const textCaptures = captures.filter(c => c.extractedText && c.extractedText.length > 0);
    if (textCaptures.length > 0) {
      lines.push('');
      lines.push(`--- ${appName} ---`);
      for (const cap of textCaptures) {
        lines.push(cap.extractedText);
        if (cap.textMethod === 'ocr' && cap.textConfidence < 70) {
          lines.push('(Some text was extracted using image recognition and may contain errors.)');
        }
      }
    }
  }

  return lines.join('\n');
}

function registerIpcHandlers() {
  ipcMain.handle('backend:request', (_event, request) => proxyBackendRequest(request));
  ipcMain.handle('backend:upload', (_event, request) => proxyBackendUpload(request));
  ipcMain.handle('attachments:get-content-url', async (_event, attachmentId) => {
    const backend = await ensureBackendReady();
    return `${backend.baseUrl}${resolveOperationPath(v1.attachments.getAttachmentContent, {
      attachmentId,
    })}`;
  });
  ipcMain.handle('files:open-path', (_event, localPath) => shell.openPath(String(localPath || '')));
  ipcMain.handle('shell:open-external', (_event, url) => shell.openExternal(String(url || '')));
  ipcMain.handle('media:get-access-status', (_event, mediaType) => resolveMediaAccessStatus(mediaType));
  ipcMain.handle('media:request-access', (_event, mediaType) => requestMediaAccess(mediaType));

  ipcMain.handle('capture:start-session', async () => {
    await toggleCaptureSession();
    return captureSession ? captureSession.state : 'idle';
  });

  ipcMain.handle('capture:stop-session', async () => {
    await toggleCaptureSession();
    return 'idle';
  });

  ipcMain.handle('capture:get-state', () => {
    return captureSession ? captureSession.state : 'idle';
  });

  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'media' || permission === 'screen');
  });

  ipcMain.handle('files:pick', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select media file',
      properties: ['openFile'],
      filters: [
        {
          name: 'Media',
          extensions: ['mp3', 'wav', 'm4a', 'mp4', 'mov', 'mkv', 'webm'],
        },
        {
          name: 'All Files',
          extensions: ['*'],
        },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  ipcMain.handle('files:pick-directory', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Choose local media folder',
      properties: ['openDirectory', 'createDirectory'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });
}

async function createWindow() {
  await ensureBackendReady();

  if (isSmokeNoWindow) {
    return null;
  }

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

  mainWindow = win;
  win.on('closed', () => { mainWindow = null; });

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
    createCaptureOverlay();

    globalShortcut.register('CommandOrControl+Shift+R', () => {
      toggleCaptureSession();
    });
  } catch (error) {
    if (isSmokeNoWindow) {
      process.stderr.write(`${error.message || 'Unable to start the local backend.'}\n`);
      await shutdownBackend();
      process.exit(1);
      return;
    }

    dialog.showErrorBox('Privanote failed to start', error.message || 'Unable to start the local backend.');
    await shutdownBackend();
    app.quit();
    return;
  }

  app.on('activate', async () => {
    if (isSmokeNoWindow) {
      return;
    }

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
  if (captureSession) {
    captureSession.destroy();
    captureSession = null;
  }
});

app.on('window-all-closed', async () => {
  if (isSmokeNoWindow) {
    return;
  }

  if (captureSession) {
    captureSession.destroy();
    captureSession = null;
  }
  globalShortcut.unregisterAll();

  await shutdownBackend();

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

process.on('uncaughtException', async (error) => {
  if (isSmokeNoWindow) {
    process.stderr.write(`${error.message || 'The desktop shell hit an unexpected error.'}\n`);
    await shutdownBackend();
    process.exit(1);
    return;
  }

  dialog.showErrorBox('Privanote crashed', error.message || 'The desktop shell hit an unexpected error.');
  await shutdownBackend();
  process.exit(1);
});

process.on('unhandledRejection', async (error) => {
  const message = error instanceof Error ? error.message : 'The desktop shell hit an unexpected promise rejection.';

  if (isSmokeNoWindow) {
    process.stderr.write(`${message}\n`);
    await shutdownBackend();
    process.exit(1);
    return;
  }

  dialog.showErrorBox('Privanote backend error', message);
  await shutdownBackend();
  process.exit(1);
});

process.on('SIGTERM', async () => {
  await shutdownBackend();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await shutdownBackend();
  process.exit(0);
});
