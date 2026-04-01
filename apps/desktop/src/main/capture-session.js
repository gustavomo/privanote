const { captureActiveScreen, extractTextFromImage, getActiveWindowInfo, terminateTesseractWorker } = require('./screen-capture');

class CaptureSession {
  constructor({ savePath, onStateChange }) {
    this.state = 'idle';       // idle | capturing | finalizing
    this.captures = [];         // Array of capture objects
    this.startTime = null;
    this.savePath = savePath;
    this.onStateChange = onStateChange || (() => {});
    this._pollTimer = null;
    this._lastAppName = null;
    this._lastCaptureTime = 0;
  }

  get captureCount() {
    return this.captures.length;
  }

  get duration() {
    if (!this.startTime) return 0;
    return Date.now() - this.startTime;
  }

  _setState(newState) {
    this.state = newState;
    this.onStateChange(newState);
  }

  async start() {
    if (this.state !== 'idle') return;

    this.captures = [];
    this.startTime = Date.now();
    this._lastAppName = null;
    this._lastCaptureTime = 0;
    this._setState('capturing');

    // Take an initial capture immediately
    await this._captureNow();

    // Start polling for window focus changes every 2 seconds
    // Event-driven: captures when app changes or 10s elapsed with same app
    this._pollTimer = setInterval(() => this._pollForCapture(), 2000);
  }

  async _pollForCapture() {
    if (this.state !== 'capturing') return;

    try {
      const info = await getActiveWindowInfo();
      const now = Date.now();
      const appChanged = info.appName !== this._lastAppName;
      const timeSinceLastCapture = now - this._lastCaptureTime;

      // Capture when: app changed, or 10 seconds elapsed (heartbeat for same app)
      if (appChanged || timeSinceLastCapture >= 10000) {
        await this._captureNow();
      }
    } catch {
      // Silently skip failed polls
    }
  }

  async _captureNow() {
    if (this.state !== 'capturing') return;

    try {
      const capture = await captureActiveScreen(this.savePath);
      if (!capture) return;

      // Skip captures of Privanote itself
      if (capture.bundleId === 'com.privanote.desktop' || capture.appName === 'Electron') {
        return;
      }

      // Extract text via OCR in the background
      const textResult = await extractTextFromImage(capture.pngBuffer);

      this.captures.push({
        screenshotPath: capture.screenshotPath,
        appName: capture.appName,
        windowTitle: capture.windowTitle,
        bundleId: capture.bundleId,
        timestamp: capture.timestamp,
        fileName: capture.fileName,
        extractedText: textResult.text,
        textMethod: textResult.method,
        textConfidence: textResult.confidence,
      });

      this._lastAppName = capture.appName;
      this._lastCaptureTime = capture.timestamp;

      // Free pngBuffer -- no longer needed after OCR
      capture.pngBuffer = null;
    } catch {
      // Silently skip failed captures
    }
  }

  async stop() {
    if (this.state !== 'capturing') return null;

    this._setState('finalizing');

    // Stop polling
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }

    const result = await this.finalize();

    // Terminate OCR worker to free memory
    await terminateTesseractWorker();

    this._setState('idle');

    return result;
  }

  async finalize() {
    // Group captures by app name
    const grouped = {};
    for (const cap of this.captures) {
      const key = cap.appName || 'Unknown';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(cap);
    }

    const appNames = Object.keys(grouped);
    const title = appNames.length > 0
      ? `${appNames.join(', ')} session -- ${new Date().toLocaleString()}`
      : `Screen capture session -- ${new Date().toLocaleString()}`;

    return {
      title,
      appNames,
      grouped,
      captureCount: this.captures.length,
      duration: this.duration,
      startTime: this.startTime,
      endTime: Date.now(),
    };
  }

  destroy() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
    this.captures = [];
    this.state = 'idle';
  }
}

module.exports = { CaptureSession };
