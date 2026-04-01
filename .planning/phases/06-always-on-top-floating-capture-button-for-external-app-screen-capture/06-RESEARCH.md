# Phase 6: Always-on-top Floating Capture Button for External App Screen Capture - Research

**Researched:** 2026-03-31
**Domain:** Electron multi-window, macOS screen capture, accessibility API, OCR, system audio
**Confidence:** MEDIUM

## Summary

This phase introduces a second Electron BrowserWindow that floats above all other applications, enabling users to capture screenshots and text from whatever app they are currently using. The technical challenge spans five distinct domains: (1) Electron multi-window management with always-on-top overlays, (2) screen capture via `desktopCapturer`, (3) text extraction via macOS Accessibility API, (4) OCR fallback for apps without accessible UI trees, and (5) optional system audio loopback capture.

The Electron APIs for floating windows and screen capture are mature and well-documented. The most significant technical risk is the macOS Accessibility tree walking -- there is no turnkey npm package that walks another app's UI tree and extracts text. This will require a custom native addon (Swift/Obj-C via napi-rs or node-addon-api) or shelling out to a helper binary. OCR via Tesseract.js is a viable pure-JS fallback. System audio capture on macOS remains the hardest sub-problem, requiring either a virtual audio device (BlackHole) or Apple's newer CoreAudio Tap API, and should be treated as a stretch goal.

**Primary recommendation:** Build the floating window and desktopCapturer screenshot pipeline first (well-supported Electron APIs), then layer in accessibility text extraction as a native addon, with Tesseract.js OCR as fallback. Defer system audio to last -- it has the highest complexity-to-value ratio.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Always-on-top Electron BrowserWindow with `alwaysOnTop: true`, `frame: false`, `transparent: true`, `skipTaskbar: true`
- Two states: idle (icon) and recording (red pulsing indicator); click to toggle
- Use Electron `desktopCapturer` API for periodic screenshots of the active window
- Capture frequency: event-driven preferred (on window focus change, scroll pause)
- Tag each capture with: timestamp, active app name, window title
- Primary text extraction: macOS Accessibility API
- Fallback: OCR via Tesseract.js or Apple Vision
- Optional audio capture: detect system audio, capture + transcribe using existing Phase 3 pipeline
- Note creation on session end: group by source app, auto-title, use existing `ensureCaptureNode()` flow
- macOS-first (v1 is macOS only)

### Claude's Discretion
- Exact drag/positioning UX for the floating button
- Whether to show a mini preview of captured content before finalizing the note
- Exact capture frequency / change-detection algorithm
- How to handle multi-monitor setups

### Deferred Ideas (OUT OF SCOPE)
- Slack/Gmail/Notion native API integrations
- AI Q&A over captured sessions
- MCP server to expose captured content
- Browser extension as alternative capture method
- Multi-language OCR support
- Automatic call detection across all platforms (v1 is macOS-first)
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| electron (existing) | 28.3.3 | Desktop runtime, BrowserWindow, desktopCapturer, globalShortcut, IPC | Already in project; v28 supports all needed APIs |
| active-win | 9.0.0 | Get frontmost app name, window title, bundle ID, PID | Most popular package for active window metadata; ESM-only |
| mac-screen-capture-permissions | 2.1.0 | Check/request Screen Recording permission on macOS | Native addon for reliable permission detection |
| node-mac-permissions | 2.5.0 | Check/request Accessibility permission on macOS | Covers accessibility + screen + microphone status |
| tesseract.js | 7.0.0 | OCR fallback for text extraction from screenshots | Pure JS, no native deps, supports 100+ languages |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| globalShortcut (Electron built-in) | -- | Register Cmd+Shift+R to toggle capture | Always; provides keyboard alternative to clicking button |
| sharp (optional) | latest | Image preprocessing before OCR | Only if Tesseract accuracy is poor on raw screenshots |

### Custom Native Code Required
| Component | Language | Purpose | Why Custom |
|-----------|----------|---------|------------|
| ax-tree-walker | Swift via node-addon-api or napi-rs | Walk macOS AXUIElement tree, extract text from frontmost app | No npm package exists that does this; `macos_accessibility_client` only checks permissions |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| active-win | @paymoapp/active-window (v2.1.4) | active-win is more popular, maintained by sindresorhus; @paymoapp is viable fallback |
| Custom AX tree walker | Shelling out to `osascript` / AppleScript | Slower, less reliable, can't traverse full AX tree |
| Tesseract.js | Apple Vision via Swift native addon | Better accuracy on macOS, but adds another native addon build requirement |
| Custom native addon | screenpipe as subprocess | Screenpipe is a full application, not a library; massive overhead for just text extraction |

**Installation:**
```bash
npm install active-win mac-screen-capture-permissions node-mac-permissions tesseract.js
```

Note: `active-win` v9 is ESM-only. Since the Electron main process uses CommonJS (`"type": "commonjs"` in package.json), it must be loaded via dynamic `import()` or a wrapper. Alternatively, use `get-windows` v9.3.0 (same package, renamed) which has the same constraint.

## Architecture Patterns

### Recommended Project Structure
```
apps/desktop/src/
├── main/
│   ├── main.js                    # Existing — add floating window creation
│   ├── preload.js                 # Existing main window preload
│   ├── preload-capture.js         # NEW: floating window preload (minimal IPC bridge)
│   ├── capture-session.js         # NEW: capture session state machine (main process)
│   ├── screen-capture.js          # NEW: desktopCapturer wrapper + screenshot logic
│   ├── ax-tree-extractor.js       # NEW: accessibility tree text extraction (calls native addon)
│   └── native/                    # NEW: native addon for AX tree walking
│       ├── binding.gyp            # or napi-rs build config
│       └── ax_walker.swift        # Swift code for AXUIElement traversal
├── renderer/
│   ├── App.jsx                    # Existing main window
│   └── capture-overlay/           # NEW: floating button React mini-app
│       ├── CaptureOverlay.jsx     # Floating button UI (idle/recording states)
│       └── capture-overlay.html   # Entry point for floating window
```

### Pattern 1: Multi-Window IPC Relay
**What:** The floating window communicates with the main process via its own preload bridge. The main process relays events to the main window when needed (e.g., to create a note).
**When to use:** Always -- Electron does not support direct renderer-to-renderer communication.
**Example:**
```javascript
// main.js — create floating capture window
function createCaptureOverlay() {
  const overlay = new BrowserWindow({
    width: 64,
    height: 64,
    alwaysOnTop: true,
    frame: false,
    transparent: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    focusable: false,       // Don't steal focus from user's active app
    webPreferences: {
      preload: path.join(__dirname, 'preload-capture.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlay.setAlwaysOnTop(true, 'floating');
  // Position at top-right corner
  const { width: screenWidth } = require('electron').screen.getPrimaryDisplay().workAreaSize;
  overlay.setPosition(screenWidth - 80, 80);

  if (app.isPackaged) {
    overlay.loadFile(path.join(__dirname, '..', '..', 'dist', 'capture-overlay.html'));
  } else {
    overlay.loadURL((process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173') + '/capture-overlay.html');
  }

  return overlay;
}
```

### Pattern 2: Capture Session State Machine (Main Process)
**What:** A state machine in the main process manages the capture session lifecycle: idle -> capturing -> finalizing -> idle.
**When to use:** Keeps all capture logic in one place; the floating window only sends start/stop signals.
**Example:**
```javascript
// capture-session.js
class CaptureSession {
  constructor() {
    this.state = 'idle';    // idle | capturing | finalizing
    this.captures = [];      // { timestamp, appName, windowTitle, screenshotPath, extractedText }
    this.startTime = null;
  }

  start() {
    this.state = 'capturing';
    this.captures = [];
    this.startTime = Date.now();
  }

  addCapture(capture) {
    this.captures.push(capture);
  }

  async finalize() {
    this.state = 'finalizing';
    // Group captures by app name
    const grouped = this.captures.reduce((acc, cap) => {
      const key = cap.appName || 'Unknown';
      if (!acc[key]) acc[key] = [];
      acc[key].push(cap);
      return acc;
    }, {});
    this.state = 'idle';
    return grouped;
  }
}
```

### Pattern 3: Event-Driven Screenshot Capture
**What:** Instead of interval-based polling, capture screenshots when meaningful events occur: active window changes, significant time elapsed since last capture with same window.
**When to use:** Always -- reduces redundant captures and CPU usage.
**Example:**
```javascript
// screen-capture.js
const { desktopCapturer } = require('electron');

async function captureActiveWindow(thumbnailSize = { width: 1920, height: 1080 }) {
  const sources = await desktopCapturer.getSources({
    types: ['window'],
    thumbnailSize,
    fetchWindowIcons: false,
  });

  // Get frontmost app info via active-win
  const activeWin = await import('active-win'); // ESM dynamic import
  const info = await activeWin.activeWindow();

  // Find matching source by window title or use screen capture
  const matchedSource = sources.find(s => s.name === info?.title);
  const source = matchedSource || (await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize,
  }))[0];

  return {
    thumbnail: source.thumbnail,  // NativeImage — call toPNG() to save
    appName: info?.owner?.name || 'Unknown',
    windowTitle: info?.title || '',
    bundleId: info?.owner?.bundleId || '',
    timestamp: Date.now(),
  };
}
```

### Pattern 4: Floating Window Drag Support
**What:** Make the floating button draggable by the user using `-webkit-app-region: drag`.
**When to use:** Always -- users need to reposition the button.
**Example:**
```css
/* In the capture overlay CSS */
.capture-button {
  -webkit-app-region: drag;
  cursor: grab;
  width: 56px;
  height: 56px;
  border-radius: 50%;
}

.capture-button button {
  -webkit-app-region: no-drag;  /* Button itself must be clickable */
}
```

### Anti-Patterns to Avoid
- **Rendering capture logic in the renderer process:** All screenshot capture, file I/O, and native addon calls MUST happen in the main process. The overlay renderer only handles UI state.
- **Fixed-interval screenshot polling:** Wastes CPU and disk. Use event-driven approach (window focus changes, timer only as heartbeat fallback).
- **Direct renderer-to-renderer IPC:** Impossible in Electron. Always relay through main process.
- **Making the overlay focusable:** Setting `focusable: true` would steal focus from the user's active app when they click the button, defeating the purpose. Use `focusable: false` and handle click events via `setIgnoreMouseEvents` toggling or by making only the button area non-transparent.
- **Loading the full App.jsx in the overlay window:** The overlay should be a tiny, separate entry point -- not the full Privanote app.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Active window detection | Custom AppleScript or NSWorkspace binding | `active-win` npm package | Handles macOS/Windows/Linux, returns app name, title, PID, bundle ID |
| Screen recording permission check | Manual CGWindow check hacks | `mac-screen-capture-permissions` | Handles prompt, re-check, system preferences redirect |
| Accessibility permission check | Shell out to `tccutil` | `node-mac-permissions` | Clean API for all macOS permission types |
| OCR text extraction | Custom image processing pipeline | `tesseract.js` | Proven WASM-based OCR, handles English text well out of box |
| Screenshot capture | Canvas-based screen grab | `desktopCapturer` (Electron built-in) | Native API, handles DPI scaling, returns NativeImage |
| Global keyboard shortcuts | Low-level keyboard hooks | `globalShortcut` (Electron built-in) | Cross-platform, handles conflicts gracefully |

**Key insight:** The only custom native code that MUST be written is the macOS Accessibility tree walker. Everything else has established packages or built-in Electron APIs. The AX tree walker is also the component with the highest long-term value, since OCR is always a fallback.

## Common Pitfalls

### Pitfall 1: desktopCapturer never resolves without Screen Recording permission
**What goes wrong:** On macOS 10.15+, `desktopCapturer.getSources()` silently hangs (never resolves) if Screen Recording permission is not granted.
**Why it happens:** Electron does not pre-check permissions before calling the API in older versions.
**How to avoid:** Check permission status BEFORE calling getSources using `systemPreferences.getMediaAccessStatus('screen')` or `mac-screen-capture-permissions`. If not granted, show a user-facing prompt directing them to System Preferences.
**Warning signs:** Promise that never resolves; app appears frozen.

### Pitfall 2: Floating window steals focus from active app
**What goes wrong:** Clicking the capture button switches focus away from the user's current app (e.g., Slack), so the next screenshot captures the Privanote overlay instead.
**Why it happens:** BrowserWindow is focusable by default; clicking it triggers macOS window activation.
**How to avoid:** Set `focusable: false` in BrowserWindow options. The overlay can still receive click events. Alternatively, use `win.setAlwaysOnTop(true, 'floating')` level and handle mouse events carefully. After the click handler fires, the previously active window retains focus.
**Warning signs:** Screenshots always show the Privanote overlay.

### Pitfall 3: active-win is ESM-only in v9
**What goes wrong:** `require('active-win')` throws `ERR_REQUIRE_ESM` because the project uses CommonJS.
**Why it happens:** `active-win` v9+ is published as ESM-only.
**How to avoid:** Use dynamic `import()` in the main process: `const activeWin = await import('active-win')`. This works in Node 18+ (which Electron 28 includes). Alternatively, pin to `active-win@8` which supports CJS, but loses latest fixes.
**Warning signs:** Crash on startup with module format error.

### Pitfall 4: Accessibility permission is separate from Screen Recording
**What goes wrong:** App has Screen Recording permission but AX tree extraction returns empty results.
**Why it happens:** macOS has separate permission toggles for Screen Recording and Accessibility. Both are needed.
**How to avoid:** Check both permissions independently on session start. Guide user to grant both in System Preferences > Privacy & Security.
**Warning signs:** Screenshots work but text extraction returns nothing.

### Pitfall 5: AX tree not available for all apps
**What goes wrong:** Some apps (games, remote desktop, Electron apps with poor accessibility, some Java apps) don't expose a useful AX tree.
**Why it happens:** AX tree availability depends on the app's accessibility implementation.
**How to avoid:** Always have the OCR fallback ready. Detect empty/minimal AX tree and auto-switch to Tesseract.js.
**Warning signs:** Extracted text is empty or contains only window chrome elements (close/minimize/zoom buttons).

### Pitfall 6: System audio capture requires third-party virtual audio device
**What goes wrong:** There is no built-in macOS API for capturing system audio output without user installing additional software.
**Why it happens:** macOS sandboxes audio output; apps cannot tap into the speaker stream natively without a virtual audio loopback device.
**How to avoid:** For v1, detect if BlackHole or a virtual audio device is installed. If not, skip audio capture gracefully and inform the user. The newer CoreAudio Tap API (macOS 14.2+, Electron 39+) may solve this but is not available on Electron 28.
**Warning signs:** Audio capture produces silence or errors.

### Pitfall 7: Transparent BrowserWindow click-through issues
**What goes wrong:** Transparent areas of the floating window either block clicks to underlying apps or the entire window becomes click-through.
**Why it happens:** macOS handles transparent window hit-testing differently than Windows/Linux.
**How to avoid:** Keep the window small (just the button size) rather than making a full-screen transparent overlay. This avoids the click-through problem entirely. If a larger overlay is needed, use `win.setIgnoreMouseEvents(true, { forward: true })` and toggle it based on mouse position.
**Warning signs:** Users can't click on apps behind the overlay, or can't click the capture button.

## Code Examples

### Creating the Floating Overlay Window
```javascript
// Source: Electron BrowserWindow docs + project conventions from main.js
const { BrowserWindow, screen, globalShortcut } = require('electron');

let captureOverlay = null;

function createCaptureOverlay() {
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

  return captureOverlay;
}
```

### Permission Check Flow
```javascript
// Source: mac-screen-capture-permissions docs, node-mac-permissions docs
const { systemPreferences } = require('electron');

async function checkCapturePermissions() {
  const results = {
    screen: systemPreferences.getMediaAccessStatus('screen'),
    microphone: systemPreferences.getMediaAccessStatus('microphone'),
    // Accessibility must be checked via node-mac-permissions
    // accessibility: permissions.getAuthorizationStatus('accessibility'),
  };

  return {
    canCapture: results.screen === 'granted',
    canRecordAudio: results.microphone === 'granted',
    screenStatus: results.screen,
    micStatus: results.microphone,
  };
}
```

### Screenshot Capture and Save
```javascript
// Source: Electron desktopCapturer docs
const { desktopCapturer } = require('electron');
const fs = require('fs');
const path = require('path');

async function takeScreenshot(savePath) {
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: 1920, height: 1080 },
  });

  if (sources.length === 0) return null;

  const screenshot = sources[0].thumbnail;
  const filePath = path.join(savePath, `capture-${Date.now()}.png`);
  fs.writeFileSync(filePath, screenshot.toPNG());

  return filePath;
}
```

### IPC Bridge for Floating Window
```javascript
// preload-capture.js — minimal preload for the overlay window
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('captureApi', {
  startSession: () => ipcRenderer.invoke('capture:start-session'),
  stopSession: () => ipcRenderer.invoke('capture:stop-session'),
  getSessionState: () => ipcRenderer.invoke('capture:get-state'),
  onStateChange: (callback) => {
    ipcRenderer.on('capture:state-changed', (_event, state) => callback(state));
  },
});
```

### Note Creation from Captures (Reusing Existing Pipeline)
```javascript
// Source: Existing App.jsx ensureCaptureNode pattern + backend client
async function createNoteFromSession(captureSession, backendClient) {
  const grouped = await captureSession.finalize();
  const appNames = Object.keys(grouped);
  const title = `${appNames.join(', ')} session — ${new Date().toLocaleString()}`;

  // Create note using existing backend client
  const node = await backendClient.request('createNode', {
    title,
    description: '',
    tags: appNames.join(','),
  });

  // Upload each screenshot as attachment
  for (const [appName, captures] of Object.entries(grouped)) {
    for (const cap of captures) {
      const bytes = fs.readFileSync(cap.screenshotPath);
      await backendClient.upload('createAttachment', {
        nodeId: node.id,
      }, {
        fileName: path.basename(cap.screenshotPath),
        mimeType: 'image/png',
        bytes,
      });
    }
  }

  return node;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| desktopCapturer in renderer | desktopCapturer in main process only | Electron 17+ | Must use IPC; renderer access deprecated |
| Soundflower for audio loopback | BlackHole or CoreAudio Tap (macOS 14.2+) | 2020+ / 2024 | Soundflower is dead; BlackHole is maintained |
| CGWindowListCreateImage for screenshots | desktopCapturer.getSources with thumbnailSize | Electron native | Electron wraps CGWindow; use the abstraction |
| Polling for active window changes | Event-driven via NSWorkspace notifications | Best practice | Reduces CPU; screenpipe validated this approach |

**Deprecated/outdated:**
- `desktopCapturer` in renderer process: Deprecated since Electron 17, removed access in later versions
- Soundflower: Unmaintained, replaced by BlackHole
- `remote` module: Removed; use IPC handles instead

## Open Questions

1. **Native addon build strategy for AX tree walker**
   - What we know: No npm package walks the AX tree and returns text. Need custom Swift/Obj-C native code.
   - What's unclear: Whether to use node-addon-api (C++ wrapper calling Obj-C), napi-rs (Rust calling Obj-C via FFI), or a standalone Swift CLI binary invoked via child_process.
   - Recommendation: Start with a standalone Swift helper binary invoked via `child_process.execFile`. Simpler to build, test, and debug than a native addon. Migrate to napi-rs addon later if performance matters. The helper takes a PID argument and outputs JSON with all text elements from the AX tree.

2. **ESM compatibility for active-win v9 in CommonJS main process**
   - What we know: `active-win` v9 is ESM-only; main process is CJS.
   - What's unclear: Whether dynamic `import()` in Electron 28's Node 18 works reliably in packaged app.
   - Recommendation: Test dynamic import in dev and packaged builds early. If problematic, use `active-win@8` (CJS-compatible) or `@paymoapp/active-window`.

3. **System audio capture feasibility on Electron 28**
   - What we know: CoreAudio Tap API requires macOS 14.2+ and Electron 39+. Electron 28 does not support it. BlackHole requires user to install a separate driver.
   - What's unclear: Whether audio capture is critical enough to require BlackHole installation, or whether to defer entirely.
   - Recommendation: Treat system audio as an optional stretch goal. Microphone capture (already working via Phase 2/3) can be offered as an alternative. Only attempt system audio if BlackHole is already installed.

4. **`focusable: false` behavior with click events**
   - What we know: Setting `focusable: false` prevents the window from stealing focus. 
   - What's unclear: Whether click events (mousedown/click) on the overlay's HTML elements still fire reliably on macOS when the window is not focusable.
   - Recommendation: Prototype this early. If clicks don't register, alternative is to make the window focusable but immediately re-focus the previously active window after handling the click.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Electron runtime | Yes | 18.18 (bundled with Electron 28) | -- |
| Xcode CLI tools | Native addon compilation | Needs verification | -- | Cannot build native AX walker without it |
| Swift compiler | AX tree walker addon | Needs verification | -- | Could use Obj-C or standalone binary |

**Missing dependencies with no fallback:**
- Xcode command line tools are required for building any native addon (the AX tree walker). Verify with `xcode-select -p`.

**Missing dependencies with fallback:**
- BlackHole virtual audio device: Not required; system audio capture is optional. Fallback is microphone-only capture.

## Sources

### Primary (HIGH confidence)
- [Electron desktopCapturer docs](https://www.electronjs.org/docs/latest/api/desktop-capturer) - API methods, macOS permission requirements, main-process-only constraint
- [Electron BrowserWindow docs](https://www.electronjs.org/docs/latest/api/browser-window) - alwaysOnTop, frame, transparent, focusable options
- [Electron globalShortcut docs](https://www.electronjs.org/docs/latest/api/global-shortcut) - keyboard shortcut registration
- [Electron IPC tutorial](https://www.electronjs.org/docs/latest/tutorial/ipc) - main-to-renderer and renderer-to-main patterns
- Existing codebase: `apps/desktop/src/main/main.js` - current BrowserWindow setup, IPC handler patterns, preload configuration

### Secondary (MEDIUM confidence)
- [active-win npm](https://www.npmjs.com/package/active-win) - v9.0.0, ESM-only, returns app name/title/bundleId/PID
- [mac-screen-capture-permissions npm](https://www.npmjs.com/package/mac-screen-capture-permissions) - v2.1.0, permission check and prompt
- [node-mac-permissions npm](https://www.npmjs.com/package/node-mac-permissions) - v2.5.0, accessibility/screen/mic permissions
- [tesseract.js GitHub](https://github.com/naptha/tesseract.js/) - v7.0.0, WASM-based OCR
- [Screenpipe architecture docs](https://docs.screenpi.pe/architecture) - event-driven capture, AX tree + OCR dual approach
- [MacPaw: Parsing macOS app UI](https://research.macpaw.com/publications/how-to-parse-macos-app-ui) - AXUIElement traversal techniques

### Tertiary (LOW confidence)
- [audiotee GitHub](https://github.com/makeusabrew/audiotee) - Swift-based audio loopback for Electron; not tested
- [FFI-NAPI Swift Native](https://codeberg.org/franzl96/FFI-NAPI-Swift-Native) - calling Swift from Node via FFI-NAPI; proof of concept only

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Electron APIs are well-documented, npm packages verified on registry
- Architecture: HIGH - Multi-window IPC and floating window patterns are established Electron patterns
- Text extraction (AX tree): LOW - No turnkey solution; requires custom native code, approach is validated by screenpipe but implementation is custom
- OCR fallback: MEDIUM - Tesseract.js is proven but accuracy on UI screenshots varies
- System audio: LOW - Requires virtual audio device or Electron upgrade; treat as stretch goal
- Pitfalls: HIGH - Well-documented macOS permission gotchas from community reports

**Research date:** 2026-03-31
**Valid until:** 2026-04-30 (stable domain; Electron 28 is pinned)
