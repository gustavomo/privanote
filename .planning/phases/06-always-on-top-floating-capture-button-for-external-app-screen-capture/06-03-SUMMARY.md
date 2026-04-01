---
phase: 06-always-on-top-floating-capture-button-for-external-app-screen-capture
plan: 03
subsystem: ui
tags: [electron, ipc, browserwindow, tray, globalshortcut, screen-capture]

requires:
  - phase: 06-01
    provides: Overlay BrowserWindow, preload-capture IPC bridge
  - phase: 06-02
    provides: CaptureSession state machine, screen-capture module
provides:
  - End-to-end capture flow wired in main.js
  - Overlay window created at launch with panel type
  - IPC handlers for capture start/stop/state
  - Global shortcut Cmd+Shift+R for capture toggle
  - Note auto-creation with screenshot attachments on session end
  - Menu bar tray icon with recording state indicator
  - Dock badge during recording
  - Auto-refresh of notes list when capture creates a note
affects: [phase-06-04, main-window, note-creation]

tech-stack:
  added: []
  patterns: [panel-type-overlay, text-tray-icon, self-contained-html-overlay]

key-files:
  created: []
  modified:
    - apps/desktop/src/main/main.js
    - apps/desktop/src/main/preload.js
    - apps/desktop/src/renderer/App.jsx
    - apps/desktop/src/renderer/capture-overlay/capture-overlay.html

key-decisions:
  - "Self-contained HTML overlay instead of React — Vite dev server SPA routing made React overlay unreachable"
  - "Panel type BrowserWindow on macOS — prevents overlay clicks from activating/focusing the main app"
  - "Text-based tray icon (emoji) — nativeImage doesn't support SVG, used setTitle with eye/red dot emoji"
  - "Screen Recording permission dialog explains VS Code link — in dev mode, macOS ties permission to parent process"

patterns-established:
  - "Self-contained HTML overlays: load via loadFile, no React/Vite dependency"
  - "State mapping: CaptureSession 'capturing' maps to overlay 'recording' CSS class"

requirements-completed: [EXT-01, EXT-02, EXT-03, EXT-05]

duration: 45min
completed: 2026-04-01
---

# Plan 06-03: Wire Overlay, Capture, and Notes Summary

**End-to-end capture flow: overlay button and Cmd+Shift+R toggle capture, screenshots uploaded as note attachments, tray icon and Dock badge show recording state**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-04-01T04:30:00Z
- **Completed:** 2026-04-01T05:15:00Z
- **Tasks:** 1 of 2 (Task 2 is human-verify checkpoint)
- **Files modified:** 4

## Accomplishments
- Wired overlay window, capture session engine, and note creation into main.js
- Added macOS menu bar tray icon with idle/recording states and context menu
- Added Dock badge ("REC") during active capture sessions
- Auto-refresh notes list when capture session creates a new note

## Task Commits

1. **Task 1: Wire capture into main.js** — multiple commits (iterative with user testing):
   - `2bb8765` fix: prevent overlay from activating app, permission prompt, eye icon
   - `32629af` fix: replace React overlay with self-contained HTML, load via loadFile
   - `9103e44` fix: show native dialog for Screen Recording permission
   - `fe7d242` fix: trigger desktopCapturer before permission dialog
   - `89817ff` feat: add menu bar tray icon with recording state
   - `b58cae9` fix: fix tray icon rendering and permission dialog for dev mode
   - `fa1708a` fix: map 'capturing' state to 'recording' in overlay UI
   - `15792d6` feat: add REC badge on Dock icon during capture
   - `7b8bcba` fix: force Dock icon visibility on macOS at startup
   - `5785015` feat: auto-refresh notes list when capture creates note

## Files Created/Modified
- `apps/desktop/src/main/main.js` — Overlay window, capture IPC, tray, shortcut, note creation
- `apps/desktop/src/main/preload.js` — Added onCaptureNoteCreated IPC bridge
- `apps/desktop/src/renderer/App.jsx` — Listen for capture:note-created, auto-refresh + select
- `apps/desktop/src/renderer/capture-overlay/capture-overlay.html` — Rewritten as self-contained HTML

## Decisions Made
- Replaced React overlay with self-contained HTML because Vite dev server SPA routing served the main app at the overlay URL
- Used `type: 'panel'` on macOS to prevent overlay clicks from bringing Privanote to front
- Used emoji-based tray titles because Electron nativeImage doesn't support SVG buffers
- Permission dialog mentions VS Code in dev mode since macOS ties screen recording to parent process

## Deviations from Plan

Multiple iterative fixes during user testing:
- React overlay → self-contained HTML (Vite routing issue)
- SVG tray icons → emoji text titles (nativeImage limitation)
- Added tray icon, Dock badge, and auto-refresh (not in original plan but needed for usability)

**Impact on plan:** Deviations improved UX significantly. Core functionality matches plan spec.

## Issues Encountered
- Vite dev server served main SPA at overlay URL — fixed by using loadFile instead
- nativeImage.createFromBuffer doesn't accept SVG — fixed with emoji setTitle
- macOS Screen Recording permission tied to VS Code in dev mode — added explanatory dialog
- CaptureSession emits 'capturing' but overlay CSS expected 'recording' — added state mapping

## Next Phase Readiness
- Task 2 (human-verify checkpoint) pending user approval
- Phase 06-04 (AX tree text extraction) can proceed after checkpoint

---
*Phase: 06-always-on-top-floating-capture-button-for-external-app-screen-capture*
*Completed: 2026-04-01*
