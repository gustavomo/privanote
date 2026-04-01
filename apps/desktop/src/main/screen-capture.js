const { desktopCapturer, systemPreferences } = require('electron');
const fs = require('fs');
const path = require('path');
const { extractTextFromAccessibilityTree } = require('./ax-tree-extractor');

const { execFile } = require('child_process');

let tesseractWorker = null;

async function getTesseractWorker() {
  if (!tesseractWorker) {
    const Tesseract = await import('tesseract.js');
    tesseractWorker = await Tesseract.default.createWorker('eng');
  }
  return tesseractWorker;
}

async function terminateTesseractWorker() {
  if (tesseractWorker) {
    await tesseractWorker.terminate();
    tesseractWorker = null;
  }
}

function checkScreenPermission() {
  if (process.platform !== 'darwin') return 'granted';
  return systemPreferences.getMediaAccessStatus('screen');
}

const ACTIVE_WIN_SCRIPT = `
tell application "System Events"
  set frontApp to first application process whose frontmost is true
  set appName to name of frontApp
  set bundleId to bundle identifier of frontApp
  set windowTitle to ""
  try
    set windowTitle to name of front window of frontApp
  end try
  set pid to unix id of frontApp
  return appName & "|" & bundleId & "|" & windowTitle & "|" & pid
end tell
`.trim();

async function getActiveWindowInfo() {
  if (process.platform !== 'darwin') {
    return { appName: 'Unknown', windowTitle: '', bundleId: '', pid: 0 };
  }

  return new Promise((resolve) => {
    execFile('osascript', ['-e', ACTIVE_WIN_SCRIPT], { timeout: 2000 }, (error, stdout) => {
      if (error) {
        resolve({ appName: 'Unknown', windowTitle: '', bundleId: '', pid: 0 });
        return;
      }
      const parts = (stdout || '').trim().split('|');
      resolve({
        appName: parts[0] || 'Unknown',
        bundleId: parts[1] || '',
        windowTitle: parts[2] || '',
        pid: parseInt(parts[3], 10) || 0,
      });
    });
  });
}

async function captureActiveScreen(savePath) {
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: 1920, height: 1080 },
  });

  if (sources.length === 0) return null;

  const screenshot = sources[0].thumbnail;
  const pngBuffer = screenshot.toPNG();
  const windowInfo = await getActiveWindowInfo();
  const timestamp = Date.now();
  const fileName = `capture-${timestamp}.png`;
  const filePath = path.join(savePath, fileName);

  fs.mkdirSync(savePath, { recursive: true });
  fs.writeFileSync(filePath, pngBuffer);

  return {
    screenshotPath: filePath,
    pngBuffer,
    appName: windowInfo.appName,
    windowTitle: windowInfo.windowTitle,
    bundleId: windowInfo.bundleId,
    pid: windowInfo.pid,
    timestamp,
    fileName,
  };
}

async function extractTextFromImage(pngBuffer) {
  try {
    const worker = await getTesseractWorker();
    const { data } = await worker.recognize(pngBuffer);
    return {
      text: (data.text || '').trim(),
      confidence: data.confidence || 0,
      method: 'ocr',
    };
  } catch {
    return { text: '', confidence: 0, method: 'ocr-failed' };
  }
}

async function extractText(pid, pngBuffer) {
  // Try accessibility tree first (primary method per CONTEXT.md)
  const axResult = await extractTextFromAccessibilityTree(pid);

  if (axResult.success && axResult.texts.length > 0) {
    return {
      text: axResult.texts.join('\n'),
      confidence: 100,
      method: 'accessibility',
    };
  }

  // Fallback to OCR
  const ocrResult = await extractTextFromImage(pngBuffer);
  return ocrResult;
}

module.exports = {
  captureActiveScreen,
  extractTextFromImage,
  extractText,
  getActiveWindowInfo,
  checkScreenPermission,
  terminateTesseractWorker,
};
