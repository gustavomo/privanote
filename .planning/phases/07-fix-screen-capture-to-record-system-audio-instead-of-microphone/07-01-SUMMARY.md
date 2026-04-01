---
phase: 07-fix-screen-capture-to-record-system-audio-instead-of-microphone
plan: 01
subsystem: media
tags: [electron, system-audio, loopback, ipc, screen-capture]

requires:
  - phase: 06-always-on-top-floating-capture-button-for-external-app-screen-capture
    provides: screen-capture infrastructure, capture overlay, screen permission checking

provides:
  - Chromium MacSckSystemAudioLoopbackOverride flag for system audio capture
  - setDisplayMediaRequestHandler with audio loopback in main process
  - IPC channels for screen permission status and denial count persistence
  - Preload bridges for getScreenPermissionStatus and recordScreenDenial

affects: [07-02, renderer-audio-capture]

tech-stack:
  added: []
  patterns: [display-media-handler-loopback, denial-count-persistence]

key-files:
  created: []
  modified:
    - apps/desktop/src/main/main.js
    - apps/desktop/src/main/preload.js

key-decisions:
  - "desktopCapturer added to top-level require destructure rather than only local re-require in toggleCaptureSession"
  - "Screen denial count persisted as JSON in userData following existing whitelist pattern"

patterns-established:
  - "Display media handler registered after registerIpcHandlers() but before createWindow() in app.whenReady()"
  - "Screen denial persistence uses same JSON-in-userData pattern as capture-apps.json"

requirements-completed: [SYSAUD-01, SYSAUD-02, SYSAUD-03]

duration: 2min
completed: 2026-04-01
---

# Phase 07 Plan 01: Main Process System Audio Infrastructure Summary

**Chromium loopback flag, display media handler with audio loopback, and screen permission IPC with denial persistence in Electron main process**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-01T10:09:35Z
- **Completed:** 2026-04-01T10:11:16Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Chromium MacSckSystemAudioLoopbackOverride flag set at module scope before app.whenReady() so renderer getDisplayMedia returns system audio
- Display media request handler registered with audio: 'loopback' to route all getDisplayMedia calls through system audio capture
- Screen permission status and denial count queryable from renderer via new IPC channels with persistent storage

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Chromium flag, display media handler, and screen permission IPC to main.js** - `2ac29b4` (feat)
2. **Task 2: Expose screen permission IPC channels in preload.js** - `8cc3d78` (feat)

## Files Created/Modified
- `apps/desktop/src/main/main.js` - Added loopback flag, desktopCapturer import, setDisplayMediaRequestHandler, screen denial persistence functions, screen status and denial IPC handlers
- `apps/desktop/src/main/preload.js` - Added getScreenPermissionStatus and recordScreenDenial bridges

## Decisions Made
- Added desktopCapturer to the top-level electron require destructure for use in setDisplayMediaRequestHandler, keeping the existing local re-require in toggleCaptureSession as-is
- Followed existing capture-apps.json persistence pattern for screen-denial.json in userData directory

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all functionality is fully wired.

## Next Phase Readiness
- Main process infrastructure ready for Plan 02 renderer-side audio capture
- Renderer can call window.api.getScreenPermissionStatus() and window.api.recordScreenDenial()
- getDisplayMedia calls from renderer will receive system audio via loopback

---
*Phase: 07-fix-screen-capture-to-record-system-audio-instead-of-microphone*
*Completed: 2026-04-01*
