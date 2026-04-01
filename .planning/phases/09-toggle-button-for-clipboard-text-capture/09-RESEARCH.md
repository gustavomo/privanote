# Phase 9: Toggle Button for Clipboard Text Capture - Research

**Researched:** 2026-04-01
**Domain:** Electron clipboard monitoring, overlay UI extension, session management
**Confidence:** HIGH

## Summary

This phase adds clipboard text monitoring to the existing floating overlay. The implementation follows well-established patterns already present in the codebase: a session class (modeled on `CaptureSession`), IPC bridge methods (modeled on `preload-capture.js`), overlay UI extension (modeled on `capture-overlay.html`), and note creation via the backend proxy (modeled on `createNoteFromSession`).

Electron provides `clipboard.readText()` for reading clipboard content and `clipboard.has(format)` (experimental) for checking pasteboard types. There is no clipboard change event in Electron -- polling is the only mechanism. The `org.nspasteboard.ConcealedType` pasteboard format marks password manager entries and can be detected via `clipboard.has('org.nspasteboard.ConcealedType')` before reading content.

**Primary recommendation:** Build a `ClipboardSession` class in a new `clipboard-session.js` file following the exact `CaptureSession` pattern (state machine, `onStateChange` callback, `start()/stop()/finalize()` lifecycle). Use polling with `setInterval` to detect clipboard changes by comparing `clipboard.readText()` against the last captured value. Extend the overlay HTML, preload bridge, and main.js with clipboard-specific handlers parallel to the existing capture session code.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Clipboard monitoring is a separate toggle, independent of screen capture sessions. Both can run simultaneously and produce separate notes.
- **D-02:** Toggle lives as a second button on the existing floating overlay, next to the capture button.
- **D-03:** Entries buffer in memory until the user manually stops monitoring, then a single note is created automatically (no review step).
- **D-04:** A global keyboard shortcut (e.g., Cmd+Shift+V) toggles clipboard monitoring on/off in addition to the overlay button.
- **D-05:** Text only -- no images or file references from clipboard.
- **D-06:** Entries are grouped by source app in the resulting note (headings like "From Slack", "From Chrome").
- **D-07:** Each entry stores timestamp and source app name as metadata. Source app is the active foreground window at the time of the clipboard change.
- **D-08:** Deduplicate globally -- if the same text is copied again (from any app), skip it.
- **D-09:** Minimum text length threshold (~5 characters) to filter noise from accidental copies, single characters, whitespace.
- **D-10:** Skip concealed clipboard entries (macOS password manager convention) automatically.
- **D-11:** Clipboard button appears as a second icon button beside the existing capture button in the floating overlay.
- **D-12:** A badge counter on the clipboard button shows the live count of captured entries during an active session.
- **D-13:** Auto-save on stop -- note is created immediately when monitoring stops, no preview/review step. Consistent with screen capture behavior.

### Claude's Discretion
- Exact polling interval for clipboard changes
- Global shortcut key combination (avoid conflicts with common shortcuts)
- Badge counter styling and position
- Clipboard button icon choice
- Exact minimum text length threshold value

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Electron `clipboard` module | 28.3.3 (built-in) | Read clipboard text, check formats | Built into Electron, no external dependency |
| Electron `globalShortcut` module | 28.3.3 (built-in) | Register Cmd+Shift+V toggle | Already used for Cmd+Shift+R capture shortcut |
| Electron `ipcMain`/`ipcRenderer` | 28.3.3 (built-in) | Main-renderer communication | Established project pattern |

### Supporting
No additional libraries needed. All functionality is covered by Electron built-ins and existing project utilities.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual polling | electron-clipboard-watcher npm package | Adds dependency for ~20 lines of polling code; not worth it |
| `clipboard.has()` for concealed detection | Native module / AppleScript | `clipboard.has()` is simpler and works in Electron 28 for checking pasteboard types |

## Architecture Patterns

### Recommended Project Structure
```
apps/desktop/src/main/
  clipboard-session.js     # NEW: ClipboardSession class (parallel to capture-session.js)
  main.js                  # MODIFIED: Add clipboard IPC handlers, global shortcut, lifecycle
  preload-capture.js       # MODIFIED: Add clipboard bridge methods
  screen-capture.js        # UNCHANGED: reuse getActiveWindowInfo()

apps/desktop/src/renderer/capture-overlay/
  capture-overlay.html     # MODIFIED: Add clipboard button, badge, second column
```

### Pattern 1: ClipboardSession State Machine
**What:** A session class with `idle -> monitoring -> finalizing -> idle` states, mirroring `CaptureSession` pattern.
**When to use:** Always -- this is the core session management pattern.
**Example:**
```javascript
// clipboard-session.js
const { clipboard } = require('electron');
const { getActiveWindowInfo } = require('./screen-capture');

class ClipboardSession {
  constructor({ onStateChange, onCountChange }) {
    this.state = 'idle';       // idle | monitoring | finalizing
    this.entries = [];          // Array of { text, appName, timestamp }
    this.seenTexts = new Set(); // For global deduplication (D-08)
    this.onStateChange = onStateChange || (() => {});
    this.onCountChange = onCountChange || (() => {});
    this._pollTimer = null;
    this._lastText = '';
  }

  get entryCount() { return this.entries.length; }

  _setState(newState) {
    this.state = newState;
    this.onStateChange(newState);
  }

  async start() {
    if (this.state !== 'idle') return;
    this.entries = [];
    this.seenTexts.clear();
    // Snapshot current clipboard to avoid capturing pre-existing content
    this._lastText = clipboard.readText().trim();
    this._setState('monitoring');
    this._pollTimer = setInterval(() => this._poll(), 500);
  }

  async _poll() {
    if (this.state !== 'monitoring') return;
    try {
      // D-10: Skip concealed entries (password managers)
      if (clipboard.has('org.nspasteboard.ConcealedType')) return;

      const text = clipboard.readText().trim();
      if (text === this._lastText) return;
      this._lastText = text;

      // D-09: Minimum length threshold
      if (text.length < 5) return;

      // D-08: Global deduplication
      if (this.seenTexts.has(text)) return;
      this.seenTexts.add(text);

      // D-07: Get source app
      const windowInfo = await getActiveWindowInfo();
      // Skip Privanote itself
      if (windowInfo.bundleId === 'com.privanote.desktop' || windowInfo.appName === 'Electron') return;

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
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
    const result = this.finalize();
    this._setState('idle');
    return result;
  }

  finalize() {
    // D-06: Group by source app
    const grouped = {};
    for (const entry of this.entries) {
      const key = entry.appName;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(entry);
    }

    const appNames = Object.keys(grouped);
    const title = `Clipboard captures - ${new Date().toLocaleString()}`;

    return { title, appNames, grouped, entryCount: this.entries.length };
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
```

### Pattern 2: IPC Bridge Extension
**What:** Add clipboard methods to the existing `preload-capture.js` `captureApi` bridge.
**When to use:** For all overlay-to-main communication.
**Example:**
```javascript
// Added to preload-capture.js contextBridge
startClipboard: () => ipcRenderer.invoke('clipboard:start-session'),
stopClipboard: () => ipcRenderer.invoke('clipboard:stop-session'),
getClipboardState: () => ipcRenderer.invoke('clipboard:get-state'),
onClipboardStateChange: (callback) => {
  const handler = (_event, state) => callback(state);
  ipcRenderer.on('clipboard:state-changed', handler);
  return () => ipcRenderer.removeListener('clipboard:state-changed', handler);
},
onClipboardCount: (callback) => {
  const handler = (_event, count) => callback(count);
  ipcRenderer.on('clipboard:count-changed', handler);
  return () => ipcRenderer.removeListener('clipboard:count-changed', handler);
},
```

### Pattern 3: Overlay UI Extension (Vertical Stack)
**What:** Expand the overlay from a single 64x64 button to a 64x136 vertical stack of two buttons.
**When to use:** For the overlay HTML changes.
**Key details from UI-SPEC:**
- Container changes from `64x64` to `64x136` with `flex-direction: column` and `gap: 8px`
- BrowserWindow dimensions in main.js must also change from `64x64` to `64x136`
- Clipboard button uses blue accent (`oklch(0.488 0.243 264.376)`) for active state vs red for capture
- Badge is 20px circle, top-right of clipboard button, hidden when count is 0

### Pattern 4: Note Content Generation
**What:** Build a text note body with entries grouped by source app.
**When to use:** When clipboard session stops and note is created.
**Example:**
```javascript
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
```

### Anti-Patterns to Avoid
- **Using clipboard change events:** Electron has no clipboard change event. Do not look for one or try to use web `clipboardchange` event (renderer-only, different scope).
- **Reading clipboard in renderer process:** Always read clipboard in the main process via IPC. The overlay preload has `contextIsolation: true`.
- **Storing entries to disk during session:** D-03 specifies in-memory buffering only. No file I/O during monitoring.
- **Sharing session state between clipboard and capture:** D-01 specifies they are independent. Separate state variables, separate IPC channels.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Clipboard polling | Event-driven clipboard watcher via native module | `setInterval` + `clipboard.readText()` | Simple polling is standard practice in Electron; no native module overhead |
| Active window detection | New window info function | `getActiveWindowInfo()` from `screen-capture.js` | Already implemented and proven |
| Note creation | Direct database calls | `proxyBackendRequest` with `v1.nodes.createNode` | Established backend proxy pattern |
| Concealed entry detection | AppleScript / native module | `clipboard.has('org.nspasteboard.ConcealedType')` | Built into Electron clipboard API |

**Key insight:** This phase requires zero new dependencies. Every capability needed exists in Electron's built-in modules or the project's existing code.

## Common Pitfalls

### Pitfall 1: Capturing Pre-existing Clipboard Content on Start
**What goes wrong:** When monitoring starts, the current clipboard content is immediately captured as the "first entry" even though the user didn't just copy it.
**Why it happens:** The first poll finds text that differs from the initial empty `_lastText` value.
**How to avoid:** Snapshot `clipboard.readText()` into `_lastText` during `start()` before beginning the poll timer. This establishes a baseline.
**Warning signs:** First entry in every session is old/unexpected text.

### Pitfall 2: Overlay Window Size Not Updated
**What goes wrong:** The second button is added to HTML but gets clipped because the BrowserWindow is still 64x64.
**Why it happens:** The BrowserWindow dimensions in `createCaptureOverlay()` (main.js) are separate from the HTML body/container dimensions.
**How to avoid:** Update BOTH the `BrowserWindow` constructor (`width: 64, height: 136`) AND the HTML body/container CSS simultaneously.
**Warning signs:** Second button invisible or partially visible.

### Pitfall 3: Overlay Hidden During Active Clipboard Session
**What goes wrong:** Clipboard monitoring is active but the overlay disappears when the user switches to a non-whitelisted app.
**Why it happens:** The `startAppDetection` function currently only keeps the overlay visible during an active *capture* session (`captureSession.state === 'capturing'`). It doesn't check for active clipboard sessions.
**How to avoid:** Extend the app detection logic to also keep the overlay visible when `clipboardSession.state === 'monitoring'`.
**Warning signs:** Overlay disappears while clipboard badge still shows entries.

### Pitfall 4: Cmd+Shift+V Conflicts with Paste Special
**What goes wrong:** The shortcut interferes with "Paste and Match Style" or "Paste Without Formatting" in some apps.
**Why it happens:** Cmd+Shift+V is commonly used for paste-without-formatting in many macOS apps (Chrome, Slack, etc.).
**How to avoid:** Use a different shortcut. Recommended: `Cmd+Shift+C` (less commonly bound) or `Cmd+Option+V`. The CONTEXT.md says "e.g., Cmd+Shift+V" leaving the exact choice to Claude's discretion.
**Warning signs:** User reports paste-without-formatting stops working in other apps while Privanote is running.

### Pitfall 5: Global Deduplication Memory Growth
**What goes wrong:** The `seenTexts` Set grows unboundedly during very long sessions.
**Why it happens:** Every unique clipboard text is stored for dedup checking.
**How to avoid:** This is acceptable for typical sessions (tens to hundreds of entries). If concerned, cap at 10,000 entries -- but unlikely to be hit in practice.
**Warning signs:** Memory usage climbing during extended sessions.

### Pitfall 6: Concealed Type Detection Timing
**What goes wrong:** Concealed entry is captured because `clipboard.has()` is checked after `clipboard.readText()`.
**Why it happens:** Race condition in poll order.
**How to avoid:** Always check `clipboard.has('org.nspasteboard.ConcealedType')` BEFORE calling `clipboard.readText()`. If concealed, skip entirely without reading.
**Warning signs:** Password manager entries appearing in notes.

### Pitfall 7: Tray Menu Not Updated for Clipboard State
**What goes wrong:** The tray menu only shows capture session state, not clipboard monitoring state.
**Why it happens:** `updateTray()` only knows about capture states.
**How to avoid:** Extend tray to reflect clipboard monitoring state (optional -- low priority since the overlay is the primary UI).
**Warning signs:** Tray shows idle while clipboard is actively monitoring.

## Code Examples

### Concealed Entry Detection
```javascript
// Source: Electron clipboard.has() docs + nspasteboard.org
const { clipboard } = require('electron');

function isClipboardConcealed() {
  try {
    return clipboard.has('org.nspasteboard.ConcealedType');
  } catch {
    return false; // Fail open -- if check fails, proceed with capture
  }
}
```

### Building Note from Clipboard Session
```javascript
// Follows createNoteFromSession pattern in main.js (line 367)
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
```

### Global Shortcut Registration
```javascript
// Parallel to existing Cmd+Shift+R registration in main.js (line 650)
globalShortcut.register('CommandOrControl+Shift+C', () => {
  toggleClipboardSession();
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Native clipboard watchers | Polling with setInterval | Always been the standard in Electron | No native module needed |
| Ignoring concealed entries | Checking `org.nspasteboard.ConcealedType` | Convention since ~2015 (nspasteboard.org) | Password managers respect this; Privanote should too |
| macOS 15.4 pasteboard privacy | New consent prompt for clipboard reads | 2025 | Electron apps may trigger a clipboard access prompt on macOS 15.4+; user grants once |

**Note on macOS 15.4+ clipboard privacy:** Apple introduced pasteboard privacy previews in macOS 15.4 where apps reading the clipboard trigger a system consent prompt. Electron apps will trigger this prompt the first time `clipboard.readText()` is called. Once granted, subsequent reads are silent. This is a one-time user interaction, not a blocker.

## Open Questions

1. **Exact shortcut key combination**
   - What we know: Cmd+Shift+V is suggested but conflicts with paste-without-formatting in major apps.
   - Recommendation: Use `Cmd+Shift+C` -- less commonly bound globally, intuitive ("C" for clipboard). If that conflicts, fallback to `Cmd+Option+V`.

2. **Polling interval**
   - What we know: 500ms is responsive enough for clipboard changes without excessive CPU. `electron-clipboard-watcher` defaults to 1000ms.
   - Recommendation: 500ms -- fast enough to feel instant, light enough to be imperceptible on CPU.

3. **Minimum text length threshold**
   - What we know: D-09 suggests ~5 characters.
   - Recommendation: 5 characters after trimming whitespace. Filters single chars, empty copies, short accidental selections.

## Sources

### Primary (HIGH confidence)
- Electron clipboard API docs (https://www.electronjs.org/docs/latest/api/clipboard) -- verified `readText()`, `has()`, `availableFormats()` methods
- nspasteboard.org (http://nspasteboard.org/) -- verified `org.nspasteboard.ConcealedType` format string and handling guidelines
- Project source code: `capture-session.js`, `main.js`, `preload-capture.js`, `capture-overlay.html` -- verified all patterns

### Secondary (MEDIUM confidence)
- electron-clipboard-watcher npm package docs -- confirmed polling is standard approach
- Bitwarden desktop issue #350 -- confirmed concealed type usage by password managers
- macOS 15.4 pasteboard privacy (https://mjtsai.com/blog/2025/05/12/pasteboard-privacy-preview-in-macos-15-4/) -- clipboard consent prompt behavior

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all Electron built-ins, no new dependencies, verified against Electron 28 docs
- Architecture: HIGH -- direct parallel to existing CaptureSession pattern in the codebase
- Pitfalls: HIGH -- identified from code analysis and clipboard monitoring domain knowledge

**Research date:** 2026-04-01
**Valid until:** 2026-05-01 (stable domain -- Electron 28 is pinned, clipboard API unlikely to change)
