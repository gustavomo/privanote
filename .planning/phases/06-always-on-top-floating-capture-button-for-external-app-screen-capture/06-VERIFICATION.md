---
phase: 06-always-on-top-floating-capture-button-for-external-app-screen-capture
verified: 2026-04-01T06:00:00Z
status: human_needed
score: 7/7 must-haves verified (automated)
human_verification:
  - test: "Launch app, verify floating capture button appears on top of all apps"
    expected: "Dark circular button with eye icon visible in top-right corner, stays on top of other windows"
    why_human: "Visual appearance and window layering behavior cannot be verified programmatically"
  - test: "Click the floating button while another app is in focus"
    expected: "Button turns red with pulse animation, the previously focused app remains focused (no focus steal)"
    why_human: "Focus behavior requires runtime interaction"
  - test: "Switch between 2-3 apps during recording, then click button again"
    expected: "Spinner briefly appears, then button returns to idle. A new note appears in sidebar with title like 'Finder, Safari session -- [date]'"
    why_human: "End-to-end capture flow with note creation requires running app"
  - test: "Use Cmd+Shift+R keyboard shortcut to toggle capture"
    expected: "Same behavior as clicking the button"
    why_human: "Global shortcut requires runtime testing"
  - test: "View created note, check attachments"
    expected: "Screenshot attachments visible, description shows duration, app count, and extracted text"
    why_human: "Content verification requires visual inspection"
---

# Phase 06: Always-on-top Floating Capture Button Verification Report

**Phase Goal:** Always-on-top floating capture button for external app screen capture
**Verified:** 2026-04-01T06:00:00Z
**Status:** human_needed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A floating circular button is visible on top of all other apps when Privanote is running | VERIFIED | `main.js:225-263` creates BrowserWindow with `alwaysOnTop: true, frame: false, transparent: true, focusable: false, type: 'panel'`. `setAlwaysOnTop(true, 'floating')` and `setVisibleOnAllWorkspaces(true)` called. `capture-overlay.html` renders a 56px circular button. |
| 2 | The floating button is draggable to reposition it on screen | VERIFIED | `capture-overlay.html:23` sets `-webkit-app-region: drag` on container, line 27 sets `-webkit-app-region: no-drag` on the button itself (so clicks work). `movable: true` on BrowserWindow. |
| 3 | Clicking the button starts/stops a capture session with correct visual state transitions | VERIFIED | `capture-overlay.html:116-128` handles click events calling `captureApi.startSession()` / `captureApi.stopSession()`. `main.js:448-460` registers IPC handlers that call `toggleCaptureSession()`. State changes broadcast via `broadcastCaptureState()` at line 265. CSS classes `recording` and `finalizing` apply correct OKLCH colors and pulse animation. |
| 4 | Cmd+Shift+R toggles capture state identical to clicking the button | VERIFIED | `main.js:548` registers `globalShortcut.register('CommandOrControl+Shift+R', () => toggleCaptureSession())`. Same `toggleCaptureSession` function used by both IPC and shortcut. |
| 5 | Screenshots are captured from the active screen, tagged with app name, window title, and timestamp | VERIFIED | `screen-capture.js:52-79` uses `desktopCapturer.getSources` for screenshots, `getActiveWindowInfo()` calls `active-win` for metadata. Returns `{ screenshotPath, appName, windowTitle, bundleId, pid, timestamp }`. `capture-session.js:64-98` stores all metadata per capture. |
| 6 | A structured note is automatically created when the capture session ends, grouping content by source app | VERIFIED | `main.js:365-431` creates note via `proxyBackendRequest` with `v1.nodes.createNode`, uploads screenshots via `proxyBackendUpload` with `v1.attachments.createAttachment`. `buildSessionDescription()` groups text by app. Title format: `${appNames.join(', ')} session -- ${date}`. App.jsx lines 848-854 auto-refresh notes list and select new note. |
| 7 | Text is extracted from the active app's accessibility tree with OCR fallback | VERIFIED | `ax-tree-extractor.js` invokes compiled `ax_walker` binary (134-line Objective-C) via `execFile` with 3s timeout. `screen-capture.js:96-111` `extractText()` tries AX tree first, falls back to OCR. `capture-session.js:77` calls `extractText(capture.pid, capture.pngBuffer)`. |

**Score:** 7/7 truths verified (automated checks)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/desktop/src/main/preload-capture.js` | IPC bridge exposing captureApi | VERIFIED | 12 lines. Exposes startSession, stopSession, getSessionState, onStateChange via contextBridge. |
| `apps/desktop/src/renderer/capture-overlay/capture-overlay.html` | Self-contained overlay UI | VERIFIED | 131 lines. Self-contained HTML with inline CSS and JS (replaced React component per 06-03 deviation). 3 visual states, pulse animation, drag support. |
| `apps/desktop/src/renderer/capture-overlay/CaptureOverlay.jsx` | React component | MISSING (acceptable) | Replaced by self-contained HTML in capture-overlay.html. React overlay was unreachable via Vite dev server SPA routing. Documented deviation in 06-03-SUMMARY. |
| `apps/desktop/src/renderer/capture-overlay/capture-overlay.css` | Standalone CSS | MISSING (acceptable) | Styles inlined in capture-overlay.html. Same deviation as above. |
| `apps/desktop/src/renderer/capture-overlay/main.jsx` | React entry point | MISSING (acceptable) | Not needed with self-contained HTML approach. |
| `apps/desktop/vite.config.js` | Multi-page build with capture-overlay | MODIFIED (acceptable) | Only has `main` entry. Capture overlay loads via `loadFile` from source, no build step needed. |
| `apps/desktop/src/main/screen-capture.js` | Screenshot capture, active window detection, OCR | VERIFIED | 120 lines. Exports captureActiveScreen, extractText, extractTextFromImage, checkScreenPermission, etc. |
| `apps/desktop/src/main/capture-session.js` | CaptureSession state machine | VERIFIED | 157 lines. Exports CaptureSession class with start/stop/finalize/destroy. Event-driven polling. |
| `apps/desktop/src/main/ax-tree-extractor.js` | Node wrapper for AX walker binary | VERIFIED | 35 lines. Exports extractTextFromAccessibilityTree. Uses execFile with 3s timeout. |
| `apps/desktop/src/main/native/ax_walker` | Compiled AX tree walker binary | VERIFIED | Binary exists. Source is ax_walker.m (134 lines, Objective-C -- Swift replaced due to toolchain issue). |
| `apps/desktop/src/main/native/build.sh` | Build script for AX walker | VERIFIED | Exists and is executable. |
| `apps/desktop/src/main/main.js` | Wiring: overlay, IPC, shortcut, note creation | VERIFIED | 642 lines. Contains createCaptureOverlay, toggleCaptureSession, createNoteFromSession, broadcastCaptureState, IPC handlers, globalShortcut, tray icon, Dock badge. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| capture-overlay.html | window.captureApi | preload-capture.js bridge | WIRED | HTML calls `window.captureApi.startSession()`, `stopSession()`, `getSessionState()`, `onStateChange()` |
| preload-capture.js | ipcRenderer | contextBridge.exposeInMainWorld | WIRED | Line 3: `contextBridge.exposeInMainWorld('captureApi', {...})` |
| main.js | capture-session.js | CaptureSession instantiation | WIRED | Line 7: `require('./capture-session')`, line 357: `new CaptureSession({...})` |
| main.js | screen-capture.js | checkScreenPermission | WIRED | Line 8: `require('./screen-capture')`, line 332: `checkScreenPermission()` |
| main.js | preload-capture.js | BrowserWindow preload | WIRED | Line 245: `preload: path.join(__dirname, 'preload-capture.js')` |
| main.js | overlay webContents | capture:state-changed | WIRED | Line 267: `captureOverlay.webContents.send('capture:state-changed', state)` |
| main.js | backend API | proxyBackendRequest/Upload | WIRED | Lines 369-393: creates node and uploads attachments |
| capture-session.js | screen-capture.js | captureActiveScreen + extractText | WIRED | Line 1: imports, line 68: `captureActiveScreen()`, line 77: `extractText()` |
| screen-capture.js | ax-tree-extractor.js | AX-first OCR-fallback | WIRED | Line 4: `require('./ax-tree-extractor')`, line 98: `extractTextFromAccessibilityTree(pid)` |
| ax-tree-extractor.js | native/ax_walker | child_process.execFile | WIRED | Line 4: path to binary, line 14: `execFile(AX_WALKER_PATH, ...)` |
| preload.js | App.jsx | capture:note-created | WIRED | preload.js:30 exposes `onCaptureNoteCreated`, App.jsx:848-854 listens and auto-refreshes |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| capture-overlay.html | state (idle/recording/finalizing) | captureApi.onStateChange from main process | Yes -- CaptureSession._setState broadcasts real state | FLOWING |
| main.js createNoteFromSession | sessionResult | CaptureSession.stop() -> finalize() | Yes -- finalize() groups real captures from _captureNow() | FLOWING |
| App.jsx | nodeId from capture:note-created | main.js line 396 sends after proxyBackendRequest | Yes -- real DB-created node ID | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED (requires running Electron app -- no headless entry point available)

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| EXT-01 | 06-01, 06-03 | User can see and interact with a floating capture button that stays on top of all other apps | SATISFIED | createCaptureOverlay in main.js: alwaysOnTop, panel type, focusable:false, visible on all workspaces |
| EXT-02 | 06-01, 06-03 | User can start/stop capture from floating button or Cmd+Shift+R | SATISFIED | capture-overlay.html click handler, main.js globalShortcut registration, toggleCaptureSession |
| EXT-03 | 06-02, 06-03 | Screenshots captured automatically, tagged with app name and timestamp | SATISFIED | screen-capture.js captureActiveScreen, capture-session.js event-driven polling |
| EXT-04 | 06-02 | Text extracted from screenshots using OCR | SATISFIED | screen-capture.js extractTextFromImage via Tesseract.js |
| EXT-05 | 06-03 | Structured note auto-created when session ends, grouped by source app | SATISFIED | main.js createNoteFromSession, buildSessionDescription groups by app, uploads attachments |
| EXT-06 | 06-04 | Text extracted from accessibility tree when available, OCR fallback | SATISFIED | ax-tree-extractor.js + screen-capture.js extractText() AX-first strategy |

No orphaned requirements found.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | - | - | - | No TODOs, FIXMEs, placeholders, or stub patterns found in any phase 06 files |

### Human Verification Required

### 1. Floating Button Visibility and Always-On-Top Behavior

**Test:** Launch the app with `npm run dev`. Verify a floating circular button appears in the top-right corner of the screen on top of all other apps.
**Expected:** Dark circular button with eye icon visible, stays above all windows including fullscreen apps.
**Why human:** Window layering, transparency, and visual rendering require runtime observation.

### 2. Focus Behavior (No Focus Steal)

**Test:** Open another app (e.g., Safari or Terminal). Click the floating capture button.
**Expected:** The capture starts (button turns red with pulse) but the previously focused app remains in focus. Privanote main window does NOT come to front.
**Why human:** Focus management behavior requires multi-window interaction testing.

### 3. End-to-End Capture Flow

**Test:** Start a capture, switch between 2-3 apps over 15 seconds, then stop the capture.
**Expected:** A new note appears in the sidebar with title like "Finder, Safari session -- [date]". Note contains screenshot attachments and extracted text grouped by app.
**Why human:** Full pipeline requires live screen capture, OCR, and backend interaction.

### 4. Keyboard Shortcut

**Test:** Press Cmd+Shift+R while another app is focused.
**Expected:** Capture toggles on/off, identical to clicking the button.
**Why human:** Global keyboard shortcut requires runtime OS-level testing.

### 5. Screen Recording Permission Handling

**Test:** If Screen Recording permission is not granted, click the capture button.
**Expected:** A native dialog appears explaining how to grant permission (with System Settings link). Capture does NOT start.
**Why human:** macOS permission dialog requires runtime interaction.

### Gaps Summary

No automated gaps found. All artifacts exist, are substantive (well above minimum line counts), and are fully wired to each other. The three planned React artifacts (CaptureOverlay.jsx, capture-overlay.css, main.jsx) were replaced with a self-contained HTML file -- this is a documented and justified deviation that achieves the same functional goal.

The Vite config does not include capture-overlay as a build entry point because the overlay loads directly from disk via `loadFile`. This is functionally correct for the self-contained HTML approach.

All 6 requirements (EXT-01 through EXT-06) are covered by implementation evidence. Phase goal achievement depends on the 5 human verification items above, all of which relate to runtime behavior that cannot be tested statically.

---

_Verified: 2026-04-01T06:00:00Z_
_Verifier: Claude (gsd-verifier)_
