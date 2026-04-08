const { Blob } = require('buffer');
const { app, BrowserWindow, desktopCapturer, dialog, globalShortcut, ipcMain, Menu, nativeImage, screen, session, shell, systemPreferences, Tray } = require('electron');
const path = require('path');
const { v1 } = require('@privanote/backend/contracts');
const { resolveBackendErrorMessage } = require('./backend-response');
const { startBackendProcess, stopBackendProcess } = require('./backend-process');
const { CaptureSession } = require('./capture-session');
const { ClipboardSession } = require('./clipboard-session');
const { checkScreenPermission } = require('./screen-capture');
const { PRESET_APPS, shouldShowOverlay, getBrowserTabUrl, BROWSER_BUNDLE_IDS } = require('./app-detector');
const { startPrService, stopPrService } = require('./pr-service-process');

app.commandLine.appendSwitch('enable-features', 'MacSckSystemAudioLoopbackOverride');

const operationsById = Object.values(v1.operations).reduce((result, operation) => {
  result[operation.id] = operation;
  return result;
}, {});
const isSmokeNoWindow = process.env.PRIVANOTE_SMOKE_NO_WINDOW === '1';
const prAnalysisEnabled = process.env.PRIVANOTE_PR_ANALYSIS === 'true';

let backendContext = null;
let prServiceContext = null;
let backendStartupPromise = null;
let isQuitting = false;
let captureOverlay = null;
let avatarOverlay = null;
let captureSession = null;
let clipboardSession = null;
let mainWindow = null;
let tray = null;
let appDetectionTimer = null;
let mediaDetectionState = { active: false, appName: null, bundleId: null };
let callRecordingActive = false;  // Tracks if a call recording is in progress
let callRecordingAppName = '';    // App name when recording started
let callRecordingStartTime = 0;  // Timestamp when recording started
let mediaDetectionCounter = 0;    // Counter to throttle media detection to every ~2.5s

const PR_URL_PATTERN = /github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/;
let prAnalysisJobId = null;
let prAnalysisPolling = null;
let lastDetectedPrUrl = null;

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
    .replace(':provider', provider || ':provider')
    .replace(':jobId', String(payload.jobId || ':jobId'));
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
    width: 48,
    height: 48,
    x: screenWidth - 64,
    y: 80,
    alwaysOnTop: true,
    frame: false,
    transparent: true,
    skipTaskbar: true,
    resizable: false,
    movable: true,
    hasShadow: false,
    focusable: false,
    type: process.platform === 'darwin' ? 'panel' : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload-capture.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  captureOverlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  captureOverlay.setAlwaysOnTop(true, 'floating');

  // Always load the overlay directly from disk — it's self-contained HTML with no build step.
  captureOverlay.loadFile(path.join(__dirname, '..', 'renderer', 'capture-overlay', 'capture-overlay.html'));

  captureOverlay.on('closed', () => {
    captureOverlay = null;
  });

  return captureOverlay;
}

function createAvatarOverlay() {
  if (isSmokeNoWindow) return null;

  const { height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  const overlayHeight = 160; // avatar (80) + bubble space above (80)

  avatarOverlay = new BrowserWindow({
    width: 80,
    height: overlayHeight,
    x: 16,
    y: screenHeight - overlayHeight - 16,
    alwaysOnTop: true,
    frame: false,
    transparent: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    hasShadow: false,
    focusable: false,
    type: process.platform === 'darwin' ? 'panel' : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload-avatar.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  avatarOverlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  avatarOverlay.setAlwaysOnTop(true, 'floating');
  avatarOverlay.loadFile(path.join(__dirname, '..', 'renderer', 'avatar-overlay', 'avatar-overlay.html'));
  avatarOverlay.on('closed', () => { avatarOverlay = null; });

  return avatarOverlay;
}

function broadcastCaptureState(state) {
  if (captureOverlay && !captureOverlay.isDestroyed()) {
    captureOverlay.webContents.send('capture:state-changed', state);
  }
  updateTray(state);
}

function broadcastClipboardState(state) {
  if (captureOverlay && !captureOverlay.isDestroyed()) {
    captureOverlay.webContents.send('clipboard:state-changed', state);
  }
}

function broadcastClipboardCount(count) {
  if (captureOverlay && !captureOverlay.isDestroyed()) {
    captureOverlay.webContents.send('clipboard:count-changed', count);
  }
}

function updateOverlayForMedia(mediaActive) {
  if (!captureOverlay || captureOverlay.isDestroyed()) return;
  if (mediaActive) {
    captureOverlay.webContents.send('media:detected', {
      appName: mediaDetectionState.appName,
      bundleId: mediaDetectionState.bundleId,
    });
    // Ensure overlay is visible when media is detected
    if (!captureOverlay.isVisible()) {
      captureOverlay.showInactive();
    }
  } else {
    captureOverlay.webContents.send('media:ended');
  }
}

function broadcastCallEnded() {
  if (!captureOverlay || captureOverlay.isDestroyed()) return;
  captureOverlay.webContents.send('media:call-ended');
}

function broadcastMediaUpdate() {
  if (!captureOverlay || captureOverlay.isDestroyed()) return;
  captureOverlay.webContents.send('media:detected', {
    appName: mediaDetectionState.appName,
    bundleId: mediaDetectionState.bundleId,
  });
}

function broadcastCallRecordingState(state) {
  if (!captureOverlay || captureOverlay.isDestroyed()) return;
  captureOverlay.webContents.send('call-recording:state-changed', state);
}

function createTrayIcon(recording) {
  const iconName = recording ? 'trayRecTemplate' : 'trayTemplate';
  const iconPath = path.join(__dirname, '..', '..', 'resources', `${iconName}.png`);
  return nativeImage.createFromPath(iconPath);
}

function setupTray() {
  tray = new Tray(createTrayIcon(false));
  tray.setToolTip('Privanote Capture');
  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
  updateTray('idle');
}

function updateTray(state) {
  if (!tray) return;

  const isRecording = state === 'capturing' || state === 'recording';

  // Swap tray icon between idle P and recording P+red-dot (per D-12, D-14)
  tray.setImage(createTrayIcon(isRecording));

  if (isRecording) {
    // Remove emoji title — icon alone signals state (per D-12)
    tray.setTitle('');
    tray.setToolTip('Privanote -- Recording...');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Recording...', enabled: false },
      { label: 'Stop Capture', click: () => toggleCaptureSession() },
      { type: 'separator' },
      { label: 'Show Privanote', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } },
      { label: 'Quit Privanote', click: () => { app.quit(); } },
    ]));
  } else {
    tray.setTitle('');
    tray.setToolTip('Privanote Capture');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Start Capture', click: () => toggleCaptureSession() },
      { type: 'separator' },
      { label: 'Show Privanote', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } },
      { label: 'Quit Privanote', click: () => { app.quit(); } },
    ]));
  }

  // Dock badge — shows "REC" on the app icon in the taskbar when recording
  if (process.platform === 'darwin' && app.dock) {
    app.dock.setBadge(isRecording ? 'REC' : '');
  }
}

async function toggleCaptureSession() {
  // Mutual exclusion: cannot start screen capture while call recording is active (Pitfall 5)
  if (callRecordingActive) {
    return;
  }

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
    // Attempt a capture so macOS registers the app in the Screen Recording list
    const { desktopCapturer } = require('electron');
    await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1, height: 1 } }).catch(() => {});

    const { response } = await dialog.showMessageBox({
      type: 'info',
      title: 'Screen Recording Permission',
      message: 'Screen Recording permission is required to capture screenshots.',
      detail: app.isPackaged
        ? 'Open System Settings → Privacy & Security → Screen Recording, then enable "Privanote". You may need to restart the app after granting permission.'
        : 'Since you are running in development mode, enable "Visual Studio Code" (or your terminal app) in System Settings → Privacy & Security → Screen Recording. Restart the dev server after granting.',
      buttons: ['Open System Settings', 'Cancel'],
      defaultId: 0,
    });
    if (response === 0) {
      shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
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

async function toggleClipboardSession() {
  if (clipboardSession && clipboardSession.state === 'monitoring') {
    const result = await clipboardSession.stop();
    if (result && result.entryCount > 0) {
      await createNoteFromClipboard(result);
    }
    clipboardSession = null;
    updateTray();
    return;
  }
  if (clipboardSession && clipboardSession.state === 'finalizing') {
    return; // Already stopping
  }
  clipboardSession = new ClipboardSession({
    onStateChange: broadcastClipboardState,
    onCountChange: broadcastClipboardCount,
  });
  await clipboardSession.start();
  updateTray();
}

async function createNoteFromClipboard(sessionResult) {
  if (sessionResult.entryCount === 0) return null;
  try {
    const node = await proxyBackendRequest({
      operationId: v1.nodes.createNode.id,
      payload: {
        title: sessionResult.title,
        description: buildClipboardNoteDescription(sessionResult),
        tags: sessionResult.appNames.join(','),
      },
    });
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

async function createNoteFromCallRecording(blobInfo) {
  try {
    const fs = require('fs');
    // Per D-12: Auto-title with source app and timestamp
    // Format: "Zoom call \u2014 Apr 1, 2:30 PM"
    const startDate = new Date(callRecordingStartTime);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[startDate.getMonth()];
    const day = startDate.getDate();
    let hours = startDate.getHours();
    const minutes = startDate.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const timeStr = `${hours}:${minutes} ${ampm}`;

    const appLabel = callRecordingAppName || 'Call recording';
    const title = `${appLabel} call \u2014 ${month} ${day}, ${timeStr}`;

    const durationMs = Date.now() - callRecordingStartTime;
    const durationSec = Math.round(durationMs / 1000);
    const durationMin = Math.floor(durationSec / 60);
    const durationRemSec = durationSec % 60;
    const description = `Duration: ${durationMin}m ${durationRemSec}s\nSource: ${appLabel}`;

    const node = await proxyBackendRequest({
      operationId: v1.nodes.createNode.id,
      payload: {
        title,
        description,
        tags: callRecordingAppName || 'call',
      },
    });

    // Attach the recording file to the note
    if (blobInfo.path && fs.existsSync(blobInfo.path)) {
      await proxyBackendRequest({
        operationId: v1.attachments.addAttachment.id,
        payload: {
          nodeId: node.id,
          kind: blobInfo.kind || 'audio',
          localPath: blobInfo.path,
        },
      });
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

function buildClipboardNoteDescription(sessionResult) {
  const lines = [];
  lines.push(`${sessionResult.entryCount} clipboard entries captured`);
  for (const [appName, entries] of Object.entries(sessionResult.grouped)) {
    lines.push('');
    lines.push(`--- From ${appName} ---`);
    for (const entry of entries) {
      const time = new Date(entry.timestamp).toLocaleTimeString();
      lines.push(`[${time}] ${entry.text}`);
    }
  }
  return lines.join('\n');
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
            operationId: v1.attachments.addAttachment.id,
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

function getWhitelistPath() {
  return path.join(app.getPath('userData'), 'capture-apps.json');
}

function loadWhitelist() {
  try {
    const data = JSON.parse(require('fs').readFileSync(getWhitelistPath(), 'utf8'));
    // Only return keys that are valid preset app IDs
    const result = {};
    for (const key of Object.keys(PRESET_APPS)) {
      result[key] = Boolean(data[key]);
    }
    return result;
  } catch {
    return {}; // Empty by default (D-01)
  }
}

function saveWhitelist(whitelist) {
  require('fs').writeFileSync(getWhitelistPath(), JSON.stringify(whitelist, null, 2));
}

function getScreenDenialPath() {
  return path.join(app.getPath('userData'), 'screen-denial.json');
}

function loadScreenDenialCount() {
  try {
    const data = JSON.parse(require('fs').readFileSync(getScreenDenialPath(), 'utf8'));
    return typeof data.count === 'number' ? data.count : 0;
  } catch {
    return 0;
  }
}

function saveScreenDenialCount(count) {
  require('fs').writeFileSync(getScreenDenialPath(), JSON.stringify({ count }, null, 2));
}

function startAppDetection() {
  if (appDetectionTimer) return;
  const { getActiveWindowInfo } = require('./screen-capture');

  appDetectionTimer = setInterval(async () => {
    // Always show overlay during active capture, clipboard session, or call recording
    if ((captureSession && captureSession.state === 'capturing') ||
        (clipboardSession && clipboardSession.state === 'monitoring') ||
        callRecordingActive) {
      if (captureOverlay && !captureOverlay.isDestroyed() && !captureOverlay.isVisible()) {
        captureOverlay.showInactive();
      }
      // Still run media detection even during active sessions so we can detect call end
    } else {
      try {
        const windowInfo = await getActiveWindowInfo();

        // Skip detection when Privanote itself is focused — keep overlay as-is
        if (windowInfo.bundleId === 'com.privanote.desktop' || windowInfo.appName === 'Electron') {
          // Still run media detection below
        } else {
          // Always show overlay (clipboard is always available)
          if (captureOverlay && !captureOverlay.isDestroyed() && !captureOverlay.isVisible()) {
            captureOverlay.showInactive();
            // Re-broadcast media state when overlay becomes visible
            if (mediaDetectionState.active) {
              updateOverlayForMedia(true);
            }
          }
          // Pre-fetch browser URL once to share between whitelist check and PR detection
          const isBrowser = BROWSER_BUNDLE_IDS.has(windowInfo.bundleId);
          const url = isBrowser ? await getBrowserTabUrl(windowInfo.bundleId) : '';

          // Tell overlay whether current app is whitelisted (for screen capture button)
          const whitelist = loadWhitelist();
          const overlayResult = await shouldShowOverlay(windowInfo, whitelist, url);
          if (captureOverlay && !captureOverlay.isDestroyed()) {
            captureOverlay.webContents.send('overlay:whitelist-state', overlayResult.show);
          }

          // PR URL detection (per D-18, D-19) -- only when feature is enabled
          if (prAnalysisEnabled && isBrowser) {
            const prMatch = url ? url.match(PR_URL_PATTERN) : null;
            if (prMatch && prMatch[0] !== lastDetectedPrUrl) {
              lastDetectedPrUrl = prMatch[0];
              if (captureOverlay && !captureOverlay.isDestroyed()) {
                captureOverlay.webContents.send('pr:url-detected', {
                  url: url,
                  owner: prMatch[1],
                  repo: prMatch[2],
                  number: parseInt(prMatch[3]),
                });
              }
            } else if (!prMatch && lastDetectedPrUrl) {
              lastDetectedPrUrl = null;
              if (captureOverlay && !captureOverlay.isDestroyed()) {
                captureOverlay.webContents.send('pr:url-cleared');
              }
            }
          }
        }
      } catch {
        // Silently skip failed detection cycles
      }
    }

    // Media detection — runs every 5th cycle (~2.5 seconds)
    mediaDetectionCounter++;
    if (mediaDetectionCounter >= 5) {
      mediaDetectionCounter = 0;
      try {
        const { detectActiveMedia } = require('./media-detector');
        const mediaResult = await detectActiveMedia();
        const wasActive = mediaDetectionState.active;
        const isNowActive = mediaResult.active;

        if (isNowActive && !wasActive) {
          // Media just became active
          mediaDetectionState = { active: true, appName: mediaResult.appName || 'Unknown', bundleId: mediaResult.bundleId || '' };
          updateOverlayForMedia(true);
        } else if (!isNowActive && wasActive) {
          // Media just ended
          mediaDetectionState = { active: false, appName: null, bundleId: null };
          if (!callRecordingActive) {
            updateOverlayForMedia(false);
          } else {
            // Call ended while recording — notify overlay of amber state (per D-07)
            broadcastCallEnded();
          }
        } else if (isNowActive && wasActive && mediaResult.appName !== mediaDetectionState.appName) {
          // App changed while media still active
          mediaDetectionState.appName = mediaResult.appName || 'Unknown';
          mediaDetectionState.bundleId = mediaResult.bundleId || '';
          broadcastMediaUpdate();
        }
      } catch {
        // Silently skip failed media detection cycles
      }
    }
  }, 500); // 500ms polling interval
}

function stopAppDetection() {
  if (appDetectionTimer) {
    clearInterval(appDetectionTimer);
    appDetectionTimer = null;
  }
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

  ipcMain.handle('media:get-screen-status', () => {
    return {
      status: checkScreenPermission(),
      denialCount: loadScreenDenialCount(),
    };
  });

  ipcMain.handle('media:record-screen-denial', () => {
    const current = loadScreenDenialCount();
    const next = current + 1;
    saveScreenDenialCount(next);
    return { denialCount: next };
  });

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

  ipcMain.handle('clipboard:start-session', async () => {
    await toggleClipboardSession();
    return clipboardSession ? clipboardSession.state : 'idle';
  });

  ipcMain.handle('clipboard:stop-session', async () => {
    await toggleClipboardSession();
  });

  ipcMain.handle('clipboard:get-state', () => {
    return clipboardSession ? clipboardSession.state : 'idle';
  });

  ipcMain.on('overlay:resize', (_event, { width, height }) => {
    if (captureOverlay && !captureOverlay.isDestroyed()) {
      const bounds = captureOverlay.getBounds();
      // Keep the right edge of the overlay fixed when width changes so that
      // any popover extending leftward stays on-screen (overlay is docked to
      // the right side of the screen).
      const x = bounds.x + bounds.width - width;
      captureOverlay.setBounds({ x, y: bounds.y, width, height });
    }
  });

  ipcMain.on('overlay:set-focusable', (_event, focusable) => {
    if (captureOverlay && !captureOverlay.isDestroyed()) {
      captureOverlay.setFocusable(focusable);
      if (focusable) {
        captureOverlay.focus();
      }
    }
  });

  ipcMain.handle('media:get-detection-state', () => ({
    active: mediaDetectionState.active,
    appName: mediaDetectionState.appName,
    bundleId: mediaDetectionState.bundleId,
    callRecordingActive,
  }));

  ipcMain.handle('call-recording:start', async (_event, mode) => {
    // Mutual exclusion: cannot record call while screen capture is active (Pitfall 5)
    if (captureSession && captureSession.state === 'capturing') {
      return { success: false, error: 'Screen capture is active' };
    }

    if (callRecordingActive) {
      return { success: false, error: 'Call recording already active' };
    }

    callRecordingActive = true;
    callRecordingAppName = mediaDetectionState.appName || 'Unknown';
    callRecordingStartTime = Date.now();
    broadcastCallRecordingState('recording');

    // Tell the main window renderer to start recording
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('call-recording:trigger-start', {
        appName: callRecordingAppName,
        mode: mode || 'audio', // 'audio' or 'video'
      });
    }

    return { success: true };
  });

  ipcMain.handle('call-recording:stop', async () => {
    if (!callRecordingActive) {
      return { success: false, error: 'No active call recording' };
    }

    broadcastCallRecordingState('finalizing');

    // Tell the main window renderer to stop recording
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('call-recording:trigger-stop');
    }

    return { success: true };
  });

  ipcMain.on('call-recording:completed', async (_event, result) => {
    // result: { success: boolean, blob?: { path, mimeType, size }, error?: string }
    if (result.success && result.blob) {
      await createNoteFromCallRecording(result.blob);
    }

    callRecordingActive = false;
    broadcastCallRecordingState('idle');

    // If media is no longer active, remove the button
    if (!mediaDetectionState.active) {
      updateOverlayForMedia(false);
    }

    callRecordingAppName = '';
    callRecordingStartTime = 0;
  });

  ipcMain.handle('call-recording:save-temp', async (_event, { data, filename }) => {
    const fs = require('fs');
    const tempDir = path.join(resolveDataRoot(), 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const tempPath = path.join(tempDir, `${Date.now()}-${filename}`);
    fs.writeFileSync(tempPath, Buffer.from(data));
    return tempPath;
  });

  ipcMain.handle('capture-apps:get-presets', () => {
    return Object.values(PRESET_APPS).map(a => ({
      id: a.id,
      label: a.label,
      description: a.description,
    }));
  });

  ipcMain.handle('capture-apps:get', () => loadWhitelist());

  ipcMain.handle('capture-apps:update', (_event, whitelist) => {
    saveWhitelist(whitelist);
    const hasEnabled = Object.values(whitelist).some(Boolean);
    if (hasEnabled) {
      startAppDetection();
    } else {
      stopAppDetection();
      if (captureOverlay && !captureOverlay.isDestroyed() && captureOverlay.isVisible()) {
        captureOverlay.hide();
      }
    }
    return whitelist;
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

  // --- PR analysis IPC handlers ---
  ipcMain.handle('pr:is-enabled', () => prAnalysisEnabled);

  ipcMain.handle('pr:start-analysis', async (_event, prUrl) => {
    if (!prAnalysisEnabled) return { success: false, error: 'PR analysis not enabled' };
    if (!prUrl || !PR_URL_PATTERN.test(prUrl)) {
      return { success: false, error: 'Enter a valid GitHub PR URL' };
    }

    try {
      const result = await proxyBackendRequest({
        operationId: v1.analyze.startAnalysis.id,
        payload: { url: prUrl },
      });

      prAnalysisJobId = result.job_id;

      // Start polling for status updates (per D-20)
      startPrAnalysisPolling(result.job_id);

      return { success: true, jobId: result.job_id };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('pr:get-status', async (_event, jobId) => {
    if (!prAnalysisEnabled) return null;
    try {
      return await proxyBackendRequest({
        operationId: v1.analyze.getAnalysisStatus.id,
        payload: { jobId },
      });
    } catch {
      return null;
    }
  });
}

function startPrAnalysisPolling(jobId) {
  if (prAnalysisPolling) clearInterval(prAnalysisPolling);

  prAnalysisPolling = setInterval(async () => {
    try {
      const status = await proxyBackendRequest({
        operationId: v1.analyze.getAnalysisStatus.id,
        payload: { jobId },
      });

      // Send status update to overlay (per D-20)
      if (captureOverlay && !captureOverlay.isDestroyed()) {
        captureOverlay.webContents.send('pr:status-update', {
          status: status.status,
          phase: status.status,
        });
      }

      if (status.status === 'completed') {
        clearInterval(prAnalysisPolling);
        prAnalysisPolling = null;
        prAnalysisJobId = null;

        // Notify overlay (per D-21)
        if (captureOverlay && !captureOverlay.isDestroyed()) {
          captureOverlay.webContents.send('pr:analysis-complete');
        }

        // Toast + auto-select in main window (per D-21)
        // NOTE: Python API returns snake_case fields (node_id, not nodeId)
        // via Pydantic model_dump(). We normalize to camelCase for the renderer.
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('pr:analysis-complete', {
            title: status.result?.title || 'PR Analysis',
            nodeId: status.result?.node_id,
          });
        }
      } else if (status.status === 'failed') {
        clearInterval(prAnalysisPolling);
        prAnalysisPolling = null;
        prAnalysisJobId = null;

        const errorMsg = status.error || 'Analysis failed. Retry from the overlay button.';

        if (captureOverlay && !captureOverlay.isDestroyed()) {
          captureOverlay.webContents.send('pr:analysis-error', { error: errorMsg });
        }

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('pr:analysis-error', { error: errorMsg });
        }
      }
    } catch {
      // Polling failure -- ignore, try next cycle
    }
  }, 2000); // Poll every 2 seconds
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
    icon: path.join(__dirname, '..', '..', 'resources', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow = win;

  // Set custom dock icon for development mode (macOS).
  // In production, the .icns in the .app bundle handles this.
  if (process.platform === 'darwin' && app.dock) {
    const iconPath = path.join(__dirname, '..', '..', 'resources', 'icon.png');
    if (require('fs').existsSync(iconPath)) {
      app.dock.setIcon(nativeImage.createFromPath(iconPath));
    }
  }

  // Minimize to tray on close (per D-15). Actual quit happens via Cmd+Q / app.quit().
  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });
  // Cleanup reference after actual window destruction (during quit)
  win.on('closed', () => { mainWindow = null; });

  if (app.isPackaged) {
    win.loadFile(path.join(__dirname, '..', '..', 'dist', 'index.html'));
    return;
  }

  const url = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
  win.loadURL(url);
}

app.whenReady().then(async () => {
  // Ensure Dock icon is visible on macOS
  if (process.platform === 'darwin' && app.dock) {
    app.dock.show();
  }

  registerIpcHandlers();

  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
      if (sources.length === 0) {
        callback(null);
        return;
      }
      callback({ video: sources[0], audio: 'loopback' });
    }).catch(() => {
      callback(null);
    });
  });

  try {
    await createWindow();
    createCaptureOverlay();
    createAvatarOverlay();
    setupTray();

    // Hide overlay by default until whitelist match (D-01, Pitfall 6)
    if (captureOverlay && !captureOverlay.isDestroyed()) {
      captureOverlay.hide();
    }

    // Start PR analysis service if enabled (per D-14)
    if (prAnalysisEnabled) {
      prServiceContext = await startPrService();
    }

    // Start app detection polling if any apps are whitelisted
    const initialWhitelist = loadWhitelist();
    const hasEnabledApps = Object.values(initialWhitelist).some(Boolean);
    if (hasEnabledApps) {
      startAppDetection();
    }

    globalShortcut.register('CommandOrControl+Shift+R', () => {
      toggleCaptureSession();
    });

    globalShortcut.register('CommandOrControl+Shift+C', () => {
      toggleClipboardSession();
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

    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    } else if (BrowserWindow.getAllWindows().length === 0) {
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
  if (prAnalysisPolling) {
    clearInterval(prAnalysisPolling);
    prAnalysisPolling = null;
  }
  if (prServiceContext) {
    stopPrService(prServiceContext);
    prServiceContext = null;
  }
  // Clean up tray icon to prevent ghost icon (Pitfall 7 from RESEARCH.md)
  if (tray) {
    tray.destroy();
    tray = null;
  }
  stopAppDetection();
  if (captureSession) {
    captureSession.destroy();
    captureSession = null;
  }
  if (clipboardSession) {
    clipboardSession.destroy();
    clipboardSession = null;
  }
  if (avatarOverlay && !avatarOverlay.isDestroyed()) {
    avatarOverlay.close();
  }
});

app.on('window-all-closed', async () => {
  if (isSmokeNoWindow) {
    return;
  }

  stopAppDetection();
  if (captureSession) {
    captureSession.destroy();
    captureSession = null;
  }
  if (clipboardSession) {
    clipboardSession.destroy();
    clipboardSession = null;
  }
  globalShortcut.unregisterAll();

  if (prServiceContext) {
    await stopPrService(prServiceContext);
    prServiceContext = null;
  }

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
