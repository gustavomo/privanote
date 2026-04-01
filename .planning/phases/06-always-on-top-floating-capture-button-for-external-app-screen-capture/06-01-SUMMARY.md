---
phase: 06-always-on-top-floating-capture-button-for-external-app-screen-capture
plan: 01
subsystem: ui
tags: [electron, react, vite, overlay, ipc, preload, css-animations]

# Dependency graph
requires:
  - phase: 05-make-record-or-import-always-accessible-as-a-persistent-entry-point
    provides: existing Electron shell, preload pattern, Vite build config
provides:
  - CaptureOverlay React component with idle/recording/finalizing visual states
  - preload-capture.js IPC bridge exposing captureApi (startSession, stopSession, getSessionState, onStateChange)
  - Vite multi-page build producing both index.html and capture-overlay.html
  - capture-overlay standalone CSS with OKLCH colors and pulse animation
affects: [06-02, 06-03, 06-04]

# Tech tracking
tech-stack:
  added: []
  patterns: [standalone CSS micro-app without Tailwind, inline SVG icons, multi-page Vite build]

key-files:
  created:
    - apps/desktop/src/main/preload-capture.js
    - apps/desktop/src/renderer/capture-overlay/CaptureOverlay.jsx
    - apps/desktop/src/renderer/capture-overlay/capture-overlay.css
    - apps/desktop/src/renderer/capture-overlay/capture-overlay.html
    - apps/desktop/src/renderer/capture-overlay/main.jsx
  modified:
    - apps/desktop/vite.config.js

key-decisions:
  - "Overlay uses standalone CSS with system-ui font, no Tailwind or shadcn (per UI-SPEC isolation)"
  - "Inline SVG icons instead of external icon library to keep overlay lightweight"
  - "State driven entirely by main process via IPC onStateChange listener"

patterns-established:
  - "Overlay micro-app pattern: separate HTML entry, dedicated preload, standalone CSS"
  - "captureApi IPC bridge pattern: invoke for commands, on/removeListener for state streaming"

requirements-completed: [EXT-01, EXT-02]

# Metrics
duration: 8min
completed: 2026-03-31
---

# Phase 06 Plan 01: Overlay Shell Summary

**Floating capture overlay with preload IPC bridge, 3-state React button (idle/recording/finalizing), and Vite multi-page build**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-01T04:22:37Z
- **Completed:** 2026-04-01T04:30:37Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Created preload-capture.js exposing 4 captureApi methods (startSession, stopSession, getSessionState, onStateChange) via contextBridge
- Built CaptureOverlay React component with idle (camera icon, dark fill), recording (stop icon, red fill, pulse animation), and finalizing (spinner, muted fill) visual states
- Updated Vite config for multi-page build producing both main app and capture-overlay entry points
- Standalone CSS with OKLCH colors, drag region support, and keyframe animations

## Task Commits

Each task was committed atomically:

1. **Task 1: Create overlay preload bridge and Vite multi-page entry** - PENDING COMMIT (feat)
2. **Task 2: Create CaptureOverlay React component with visual states and standalone CSS** - PENDING COMMIT (feat)

## Files Created/Modified
- `apps/desktop/src/main/preload-capture.js` - IPC bridge exposing captureApi to overlay renderer
- `apps/desktop/src/renderer/capture-overlay/capture-overlay.html` - HTML entry point with transparent body
- `apps/desktop/src/renderer/capture-overlay/main.jsx` - React root for overlay mini-app
- `apps/desktop/src/renderer/capture-overlay/CaptureOverlay.jsx` - Floating button with 3 visual states
- `apps/desktop/src/renderer/capture-overlay/capture-overlay.css` - Standalone styles with OKLCH colors and animations
- `apps/desktop/vite.config.js` - Added rollupOptions.input for multi-page build

## Decisions Made
- Overlay uses standalone CSS with system-ui font, no Tailwind or shadcn (per UI-SPEC isolation)
- Inline SVG icons instead of external icon library to keep overlay lightweight
- State driven entirely by main process via IPC onStateChange listener -- overlay reflects state, does not own it

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Overlay shell ready for Plan 02 to create the BrowserWindow that hosts it
- preload-capture.js ready to be wired as the BrowserWindow preload script
- captureApi IPC channels ready for main process handler registration

---
*Phase: 06-always-on-top-floating-capture-button-for-external-app-screen-capture*
*Completed: 2026-03-31*
