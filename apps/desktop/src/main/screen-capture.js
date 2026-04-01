const { desktopCapturer, systemPreferences } = require('electron');
const fs = require('fs');
const path = require('path');
const { extractTextFromAccessibilityTree } = require('./ax-tree-extractor');

let activeWinModule = null;
let tesseractWorker = null;

async function getActiveWin() {
  if (!activeWinModule) {
    activeWinModule = await import('active-win');
  }
  return activeWinModule;
}

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

async function getActiveWindowInfo() {
  try {
    const mod = await getActiveWin();
    const info = await mod.default();
    if (!info) return { appName: 'Unknown', windowTitle: '', bundleId: '', pid: 0 };
    return {
      appName: info.owner?.name || 'Unknown',
      windowTitle: info.title || '',
      bundleId: info.owner?.bundleId || '',
      pid: info.owner?.processId || 0,
    };
  } catch {
    return { appName: 'Unknown', windowTitle: '', bundleId: '', pid: 0 };
  }
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
