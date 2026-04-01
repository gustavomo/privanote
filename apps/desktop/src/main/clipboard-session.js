const { clipboard } = require('electron');
const { getActiveWindowInfo } = require('./screen-capture');

class ClipboardSession {
  constructor({ onStateChange, onCountChange }) {
    this.state = 'idle';           // idle | monitoring | finalizing
    this.entries = [];              // Array of { text, appName, timestamp }
    this.seenTexts = new Set();    // Global dedup (D-08)
    this._pollTimer = null;
    this._lastText = '';           // Baseline to detect clipboard changes
    this.onStateChange = onStateChange || (() => {});
    this.onCountChange = onCountChange || (() => {});
  }

  get entryCount() {
    return this.entries.length;
  }

  _setState(newState) {
    this.state = newState;
    this.onStateChange(newState);
  }

  async start() {
    if (this.state !== 'idle') return;

    this.entries = [];
    this.seenTexts.clear();

    // Snapshot baseline to avoid capturing pre-existing clipboard content (Pitfall 1)
    this._lastText = clipboard.readText().trim();

    this._setState('monitoring');

    // Poll clipboard at 500ms intervals (research recommendation)
    this._pollTimer = setInterval(() => this._poll(), 500);
  }

  async _poll() {
    if (this.state !== 'monitoring') return;

    try {
      // D-10: Check concealed type BEFORE reading text (Pitfall 6: timing)
      // Password managers mark entries with this pasteboard type
      if (clipboard.has('org.nspasteboard.ConcealedType')) {
        return;
      }

      const text = clipboard.readText().trim();

      // No change from last poll
      if (text === this._lastText) return;
      this._lastText = text;

      // D-09: Minimum length filter
      if (text.length < 5) return;

      // D-08: Global dedup — skip already-captured text
      if (this.seenTexts.has(text)) return;
      this.seenTexts.add(text);

      // D-07: Get source app metadata
      const windowInfo = await getActiveWindowInfo();

      // Skip captures from Privanote itself
      if (windowInfo.bundleId === 'com.privanote.desktop' || windowInfo.appName === 'Electron') {
        return;
      }

      this.entries.push({
        text,
        appName: windowInfo.appName || 'Unknown',
        timestamp: Date.now(),
      });

      this.onCountChange(this.entries.length);
    } catch {
      // Silently skip failed polls
    }
  }

  async stop() {
    if (this.state !== 'monitoring') return null;

    this._setState('finalizing');

    clearInterval(this._pollTimer);
    this._pollTimer = null;

    const result = this.finalize();

    this._setState('idle');

    return result;
  }

  finalize() {
    // D-06: Group entries by source app
    const grouped = {};
    for (const entry of this.entries) {
      const key = entry.appName;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(entry);
    }

    const title = `Clipboard captures - ${new Date().toLocaleString()}`;

    return {
      title,
      appNames: Object.keys(grouped),
      grouped,
      entryCount: this.entries.length,
    };
  }

  destroy() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
    this.entries = [];
    this.seenTexts.clear();
    this.state = 'idle';
  }
}

module.exports = { ClipboardSession };
