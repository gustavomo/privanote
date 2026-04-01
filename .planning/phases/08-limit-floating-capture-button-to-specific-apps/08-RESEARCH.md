# Phase 8: Limit Floating Capture Button to Specific Apps - Research

**Researched:** 2026-04-01
**Domain:** macOS active window detection, browser URL extraction, Electron overlay visibility control
**Confidence:** HIGH

## Summary

This phase adds intelligent show/hide behavior to the existing floating capture overlay based on which app is in the foreground. The core challenge has two parts: (1) detecting which app is active (already solved via `active-win` in Phase 6), and (2) detecting which browser-based web app is active when a browser is in the foreground (requires URL extraction from Chrome/Safari).

The AX tree walker (`ax_walker.m`) already exists but extracts all text content rather than specifically targeting the URL bar. For browser app detection, AppleScript via `osascript` is far more reliable than walking the AX tree to find a URL attribute -- both Chrome and Safari expose their current tab URL through Apple Events scripting dictionaries. The AX tree approach for URL extraction is brittle across browser versions and requires Chrome to be launched with `--force-renderer-accessibility`. AppleScript has no such requirement and returns the exact URL string cleanly.

Settings persistence should use the main process (Electron side) rather than the backend database. The capture apps whitelist is a desktop-only concern -- it controls overlay visibility in the Electron main process and has no relevance to the backend API. A simple JSON file in the userData directory (or in-memory with IPC) is the right pattern.

**Primary recommendation:** Use `active-win` for native app detection (Slack by bundleId/appName), AppleScript via `child_process.execFile('osascript', ...)` for browser URL extraction (Gmail, Notion, Jira, GitHub), and a main-process-owned settings store for the whitelist. Poll on a 500ms-1000ms interval. Show/hide the overlay with `captureOverlay.show()` / `captureOverlay.hide()`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Whitelist is empty by default -- overlay starts hidden until user enables apps
- D-02: 5 preset apps only: Slack, Gmail (browser), Notion, Jira (browser), GitHub (browser)
- D-03: No custom app addition in this phase -- only the preset list is available
- D-04: Primary: AX tree URL extraction -- walk the browser's accessibility tree to find the URL bar value, match against known URL patterns (mail.google.com, notion.so, github.com, atlassian.net)
- D-05: Fallback: Window title parsing -- match against known patterns in the browser window title (e.g., "Gmail", "Jira", "GitHub")
- D-06: Supports Chrome and Safari as browser hosts
- D-07: Instant hide/show -- overlay disappears and reappears immediately on app switch, no fade or delay
- D-08: Polling checks active app on an interval (reuse active-win from Phase 6) and shows/hides overlay accordingly
- D-09: Settings view only -- add a "Capture Apps" section in the existing Settings view (Phase 3 infrastructure)
- D-10: Toggle switches for each of the 5 preset apps
- D-11: No right-click menu or tray menu for whitelist management

### Claude's Discretion
- Polling interval for active app check (balance responsiveness vs CPU)
- How to handle the overlay during an active capture session (likely keep showing regardless of active app)
- URL patterns for browser app matching (exact domains to match)
- Whether to check app on both overlay visibility and capture session start

### Deferred Ideas (OUT OF SCOPE)
- Custom app addition beyond the 5 presets
- AI-powered capture processing and deduplication
- Toggle button for clipboard text capture
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| active-win | 9.0.0 | Get active window owner name, bundleId, title, PID | Already in use from Phase 6, ESM-only dynamic import pattern established |
| osascript (system) | macOS built-in | Extract current tab URL from Chrome/Safari | More reliable than AX tree for URL extraction; no npm dependency needed |
| Electron BrowserWindow | 28.x | Overlay show/hide control | Already the overlay host; `.show()` / `.hide()` are built-in |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| electron-store | -- | NOT needed | Settings are simple enough for a JSON file or in-memory map with IPC |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| AppleScript for URLs | AX tree kAXURLAttribute | AX tree requires `--force-renderer-accessibility` for Chrome, brittle across versions, slower. CONTEXT.md says "AX tree" as primary -- use AppleScript as implementation of URL extraction since it accesses the same scripting bridge but more reliably |
| Polling interval | CGEventTap / NSWorkspace notifications | Event-driven would be ideal but requires native code; polling at 500ms is simpler and proven in CaptureSession |
| Backend settings API | Main-process JSON | Whitelist is desktop-only state; adding a backend column for it creates unnecessary coupling |

## Architecture Patterns

### Recommended Project Structure
```
apps/desktop/src/main/
  app-detector.js          # NEW: Active app detection + URL extraction + whitelist matching
  main.js                  # MODIFIED: Add polling loop, show/hide overlay, IPC for whitelist settings
  preload.js               # MODIFIED: Expose captureApps IPC (getWhitelist, updateWhitelist)
  screen-capture.js        # UNCHANGED
  capture-session.js       # UNCHANGED
  ax-tree-extractor.js     # UNCHANGED (not used for URL; used for text extraction)

apps/desktop/src/renderer/
  components/
    settings-view.jsx      # MODIFIED: Add "Capture Apps" section with toggle switches
    capture-apps-section.jsx  # NEW: Toggle list for the 5 preset apps
```

### Pattern 1: App Detection Module
**What:** A dedicated module that answers "should the overlay be visible right now?" by combining active-win data with browser URL extraction.
**When to use:** Called on every poll tick from main.js.
**Example:**
```javascript
// apps/desktop/src/main/app-detector.js

const { execFile } = require('child_process');

const BROWSER_BUNDLE_IDS = new Set([
  'com.google.Chrome',
  'com.apple.Safari',
]);

const PRESET_APPS = {
  slack: {
    id: 'slack',
    label: 'Slack',
    match: (info) => info.bundleId === 'com.tinyspeck.slackmacgap' || info.appName === 'Slack',
  },
  gmail: {
    id: 'gmail',
    label: 'Gmail',
    matchUrl: (url) => url.includes('mail.google.com'),
    matchTitle: (title) => /gmail/i.test(title),
  },
  notion: {
    id: 'notion',
    label: 'Notion',
    match: (info) => info.bundleId === 'notion.id' || info.appName === 'Notion',
    matchUrl: (url) => url.includes('notion.so'),
    matchTitle: (title) => /notion/i.test(title),
  },
  jira: {
    id: 'jira',
    label: 'Jira',
    matchUrl: (url) => url.includes('atlassian.net'),
    matchTitle: (title) => /jira/i.test(title),
  },
  github: {
    id: 'github',
    label: 'GitHub',
    matchUrl: (url) => url.includes('github.com'),
    matchTitle: (title) => /github/i.test(title),
  },
};

function getBrowserUrl(bundleId) {
  return new Promise((resolve) => {
    const appName = bundleId === 'com.apple.Safari' ? 'Safari'
      : bundleId === 'com.google.Chrome' ? 'Google Chrome'
      : null;
    if (!appName) { resolve(''); return; }

    const script = appName === 'Safari'
      ? `tell app "Safari" to get URL of current tab of front window`
      : `tell app "Google Chrome" to get URL of active tab of front window`;

    execFile('osascript', ['-e', script], { timeout: 1000 }, (err, stdout) => {
      resolve(err ? '' : (stdout || '').trim());
    });
  });
}
```

### Pattern 2: Polling Loop in Main Process
**What:** A setInterval in main.js that checks the active app and shows/hides the overlay.
**When to use:** Starts when the overlay is created, pauses when whitelist is empty.
**Example:**
```javascript
// In main.js, after createCaptureOverlay()
let appDetectionTimer = null;

function startAppDetection() {
  if (appDetectionTimer) return;
  appDetectionTimer = setInterval(async () => {
    // Skip if capture session is active -- always show overlay during capture
    if (captureSession && captureSession.state === 'capturing') {
      if (captureOverlay && !captureOverlay.isVisible()) captureOverlay.show();
      return;
    }
    const shouldShow = await detectWhitelistedApp();
    if (shouldShow && captureOverlay && !captureOverlay.isVisible()) {
      captureOverlay.show();
    } else if (!shouldShow && captureOverlay && captureOverlay.isVisible()) {
      captureOverlay.hide();
    }
  }, 500);
}
```

### Pattern 3: Settings Persistence (Main Process Owned)
**What:** Store the whitelist as a JSON file in userData, not in the backend database.
**When to use:** The whitelist is desktop-only UI state. The backend does not need to know about it.
**Example:**
```javascript
// Simple file-based persistence in main process
const fs = require('fs');
const path = require('path');

function getWhitelistPath() {
  return path.join(app.getPath('userData'), 'capture-apps.json');
}

function loadWhitelist() {
  try {
    return JSON.parse(fs.readFileSync(getWhitelistPath(), 'utf8'));
  } catch {
    return {}; // Empty by default (D-01)
  }
}

function saveWhitelist(whitelist) {
  fs.writeFileSync(getWhitelistPath(), JSON.stringify(whitelist, null, 2));
}
```

### Anti-Patterns to Avoid
- **Polling too fast (< 300ms):** active-win spawns a subprocess on macOS; polling faster than 500ms risks CPU spikes
- **Storing whitelist in backend DB:** Creates unnecessary backend coupling for desktop-only UI state
- **Using AX tree for URL extraction:** The existing ax_walker returns all text in the tree, not the URL specifically. Modifying it to find kAXURLAttribute would work but AppleScript is simpler and more reliable
- **Blocking the main process:** All detection (active-win, osascript) must be async; never use execFileSync in the polling loop

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Active window detection | Custom native code for window info | `active-win` v9 (already installed) | Cross-platform, handles edge cases, ESM dynamic import pattern established |
| Browser URL extraction | Custom AX tree URL finder | `osascript -e 'tell app...'` | AppleScript is the standard macOS way; 2 lines per browser vs. complex AX traversal |
| Window title detection | Custom window title polling | `active-win` `.title` property | Already returns window title; just pattern-match against it |

**Key insight:** The heaviest technical lift (AX tree walker, active-win integration) was already done in Phase 6. This phase is primarily about orchestrating existing primitives with new matching logic.

## Common Pitfalls

### Pitfall 1: AppleScript Permission Prompts
**What goes wrong:** First call to `osascript` with `tell app "Google Chrome"` may trigger a macOS automation permission dialog.
**Why it happens:** macOS requires explicit permission for one app to control another via Apple Events.
**How to avoid:** Accept that the first detection attempt may fail with a permission error. Return empty URL on error and fall back to window title matching. The user only needs to grant permission once.
**Warning signs:** Error message "not allowed to send Apple events to Google Chrome" in osascript stderr.

### Pitfall 2: Browser Not Running
**What goes wrong:** AppleScript `tell app "Safari"` will LAUNCH Safari if it's not running.
**Why it happens:** AppleScript's `tell application` implicitly launches the target app.
**How to avoid:** Only call AppleScript when `active-win` already reports a browser is in the foreground. If bundleId is a browser, then the browser is already running and frontmost.
**Warning signs:** Safari/Chrome launching unexpectedly when user hasn't opened them.

### Pitfall 3: Notion Desktop vs Notion in Browser
**What goes wrong:** Notion has both a native desktop app (bundleId `notion.id`) and runs as a web app in Chrome/Safari.
**Why it happens:** User may use either; detection must handle both.
**How to avoid:** Check bundleId first for native app match, then fall through to browser URL check. The PRESET_APPS config should include both a `match` (for native) and `matchUrl` (for browser) function.
**Warning signs:** Notion not detected when user uses the native app but only URL matching is implemented.

### Pitfall 4: Overlay Show/Hide During Capture Session
**What goes wrong:** Overlay hides mid-capture when user switches to a non-whitelisted app.
**Why it happens:** The polling loop hides the overlay based on active app, even during an active capture session.
**How to avoid:** When `captureSession.state === 'capturing'`, always show the overlay regardless of active app. The user needs the stop button accessible.
**Warning signs:** User cannot stop an active capture session because the overlay disappeared.

### Pitfall 5: Race Between Polling and CaptureSession Polling
**What goes wrong:** Two independent setInterval loops (app detection at 500ms, CaptureSession at 2000ms) both call `getActiveWindowInfo()`, doubling subprocess spawns.
**Why it happens:** CaptureSession already polls active-win for screenshot decisions.
**How to avoid:** Consider sharing the active-win result. The app-detection poll can cache and expose the latest window info so CaptureSession reads it instead of calling active-win separately. OR accept the minor overhead since active-win is fast (~5-10ms per call).
**Warning signs:** Noticeable CPU usage from double-polling. Monitor with Activity Monitor during extended sessions.

### Pitfall 6: Overlay Not Hiding on First Launch
**What goes wrong:** The overlay shows briefly on app launch before the first poll tick runs.
**Why it happens:** `createCaptureOverlay()` currently calls `captureOverlay.loadFile(...)` which makes it visible immediately.
**How to avoid:** After creating the overlay, call `captureOverlay.hide()` immediately if the whitelist is empty (D-01). Only start showing after the first successful poll match.
**Warning signs:** Overlay flash on startup.

## Code Examples

### AppleScript URL Extraction (verified pattern)
```javascript
// Source: macOS osascript scripting bridge (system utility)
const { execFile } = require('child_process');

function getBrowserTabUrl(browserName) {
  // browserName: 'Safari' or 'Google Chrome'
  const script = browserName === 'Safari'
    ? 'tell app "Safari" to get URL of current tab of front window'
    : 'tell app "Google Chrome" to get URL of active tab of front window';

  return new Promise((resolve) => {
    execFile('osascript', ['-e', script], { timeout: 1000 }, (error, stdout) => {
      if (error) {
        resolve('');
        return;
      }
      resolve((stdout || '').trim());
    });
  });
}
```

### Window Title Fallback Matching
```javascript
// Fallback when AppleScript fails or permission not granted
const TITLE_PATTERNS = {
  gmail: /gmail/i,
  notion: /notion/i,
  jira: /jira/i,
  github: /github/i,
};

function matchByWindowTitle(windowTitle, enabledApps) {
  for (const [appId, pattern] of Object.entries(TITLE_PATTERNS)) {
    if (enabledApps[appId] && pattern.test(windowTitle)) {
      return appId;
    }
  }
  return null;
}
```

### Settings IPC for Whitelist
```javascript
// In main.js -- register IPC handlers
ipcMain.handle('capture-apps:get', () => loadWhitelist());
ipcMain.handle('capture-apps:update', (_event, whitelist) => {
  saveWhitelist(whitelist);
  // If whitelist is now empty, hide overlay and stop polling
  // If whitelist is now non-empty, start polling
  const hasEnabled = Object.values(whitelist).some(Boolean);
  if (hasEnabled) {
    startAppDetection();
  } else {
    stopAppDetection();
    if (captureOverlay && captureOverlay.isVisible()) captureOverlay.hide();
  }
  return whitelist;
});

// In preload.js -- expose to renderer
contextBridge.exposeInMainWorld('api', {
  // ...existing api...
  getCaptureApps: () => ipcRenderer.invoke('capture-apps:get'),
  updateCaptureApps: (whitelist) => ipcRenderer.invoke('capture-apps:update', whitelist),
});
```

### Toggle UI Component Pattern
```jsx
// capture-apps-section.jsx
const PRESET_APPS = [
  { id: 'slack', label: 'Slack', description: 'Desktop app' },
  { id: 'gmail', label: 'Gmail', description: 'Chrome or Safari' },
  { id: 'notion', label: 'Notion', description: 'Desktop or browser' },
  { id: 'jira', label: 'Jira', description: 'Chrome or Safari' },
  { id: 'github', label: 'GitHub', description: 'Chrome or Safari' },
];

function CaptureAppsSection({ whitelist, onToggle, isLoading }) {
  return (
    <div className="grid gap-6 rounded-[28px] bg-secondary/70 p-6">
      <div className="space-y-1">
        <h3 className="text-xl font-semibold leading-[1.2]">Capture Apps</h3>
        <p className="text-sm text-muted-foreground">
          The floating capture button appears when these apps are in the foreground.
        </p>
      </div>
      <div className="grid gap-3">
        {PRESET_APPS.map((app) => (
          <label key={app.id} className="flex items-center justify-between rounded-2xl border bg-background px-4 py-3">
            <div>
              <span className="text-sm font-semibold">{app.label}</span>
              <span className="ml-2 text-xs text-muted-foreground">{app.description}</span>
            </div>
            <input
              type="checkbox"
              checked={Boolean(whitelist[app.id])}
              onChange={() => onToggle(app.id)}
              disabled={isLoading}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| AX tree kAXURLAttribute for browser URLs | AppleScript via osascript | Ongoing -- AX approach remains fragile | AppleScript is simpler, more reliable, no --force-renderer-accessibility needed for Chrome |
| active-win v8 (CommonJS) | active-win v9 (ESM-only) | 2024 | Must use dynamic `import()` -- already handled in Phase 6 |
| CGEventTap for window change events | Polling with active-win | Current project pattern | Polling is simpler; event-driven would need native code |

## Open Questions

1. **D-04 says "AX tree URL extraction" as primary -- should AppleScript be used instead?**
   - What we know: The existing `ax_walker.m` walks the full AX tree and returns all text content. It does not specifically extract URLs from the address bar. AppleScript is the standard macOS approach for getting browser tab URLs and is far more reliable.
   - What's unclear: Whether the user specifically wants AX tree traversal for URL extraction or whether "AX tree" was shorthand for "programmatic URL extraction from the browser."
   - Recommendation: Use AppleScript as the primary URL extraction method (it accesses the same scripting bridge). Fall back to window title parsing (D-05). If the user insists on AX tree, the `ax_walker.m` would need to be modified to specifically look for `kAXURLAttribute` and Chrome would need `--force-renderer-accessibility`. Proceed with AppleScript unless told otherwise.

2. **Polling interval -- 500ms vs 1000ms?**
   - What we know: active-win takes ~5-10ms per call. AppleScript osascript takes ~50-100ms. Combined poll cycle is ~60-110ms of work.
   - What's unclear: Whether 500ms feels "instant" enough or if 1000ms introduces noticeable lag.
   - Recommendation: Start at 500ms. The CPU overhead is negligible. This gives sub-second response to app switches, which feels instant (D-07).

3. **Should whitelist settings go in the backend DB or be main-process-only?**
   - What we know: Current settings (storage, transcription, provider) are in the backend DB. But the whitelist is purely a desktop UI concern.
   - What's unclear: Whether keeping all settings in one place (backend) is preferred for consistency.
   - Recommendation: Main-process JSON file. The backend has no use for this data. Adding a column to the settings table requires a migration and backend route changes for no benefit.

## Sources

### Primary (HIGH confidence)
- Project source code: `apps/desktop/src/main/main.js`, `screen-capture.js`, `ax-tree-extractor.js`, `capture-session.js`, `native/ax_walker.m` -- direct code inspection
- Project source code: `apps/backend/src/services/settings-service.js`, `apps/desktop/src/renderer/components/settings-view.jsx` -- settings pattern
- [active-win npm](https://www.npmjs.com/package/active-win) -- v9.0.0, ESM-only, returns owner.name, owner.bundleId, title, owner.processId

### Secondary (MEDIUM confidence)
- [AppleScript browser URL extraction gist](https://gist.github.com/vitorgalvao/5392178) -- Well-known pattern for getting URLs from Safari/Chrome
- [Swift/macOS: Get Browser URL 2 Ways](https://medium.com/@itsuki.enjoy/swift-macos-get-browser-opened-tab-url-2-ways-e6722fb5998d) -- February 2026, confirms AX approach is fragile, AppleScript preferred
- [AppleScript tutorial: Get current URL](https://riptutorial.com/applescript/example/32604/get-the-current-url-in-safari-or-google-chrome) -- Standard osascript commands for Chrome and Safari

### Tertiary (LOW confidence)
- [Chrome Accessibility issue](https://issues.chromium.org/issues/382525581) -- Chrome AX tree may have window-level issues on macOS

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use; only addition is system osascript
- Architecture: HIGH - Clear extension of existing patterns (polling, IPC, settings UI)
- Pitfalls: HIGH - Well-understood domain; pitfalls identified from code inspection and macOS platform knowledge

**Research date:** 2026-04-01
**Valid until:** 2026-05-01 (stable domain, no fast-moving dependencies)
