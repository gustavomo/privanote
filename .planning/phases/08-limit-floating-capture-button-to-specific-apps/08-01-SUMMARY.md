---
phase: 08-limit-floating-capture-button-to-specific-apps
plan: 01
subsystem: desktop
tags: [electron, ipc, applescript, active-win, app-detection]

# Dependency graph
requires:
  - phase: 06-always-on-top-floating-capture-button-for-external-app-screen-capture
    provides: captureOverlay BrowserWindow, capture session lifecycle
provides:
  - App detection module with 5 preset apps (Slack, Gmail, Notion, Jira, GitHub)
  - Browser tab URL extraction via AppleScript (Chrome, Safari)
  - Whitelist persistence in userData/capture-apps.json
  - 500ms polling loop toggling overlay visibility based on active foreground app
  - IPC bridge (capture-apps:get-presets, capture-apps:get, capture-apps:update)
  - Preload API methods (getCaptureAppPresets, getCaptureApps, updateCaptureApps)
affects: [08-02 settings UI for toggling app whitelist]

# Tech tracking
tech-stack:
  added: []
  patterns: [AppleScript URL extraction for browser tab detection, polling-based app detection with bundleId and title fallback]

key-files:
  created:
    - apps/desktop/src/main/app-detector.js
  modified:
    - apps/desktop/src/main/main.js
    - apps/desktop/src/main/preload.js

key-decisions:
  - "AppleScript for browser URL extraction instead of AX tree -- more reliable for URL-specific data"
  - "Whitelist stored as JSON file in userData, not in backend DB -- desktop-only UI state"
  - "Overlay hidden by default on startup until whitelist match (D-01)"

patterns-established:
  - "App detection via bundleId for native apps, URL for browser tabs, title as fallback"
  - "Polling at 500ms with capture session override to keep overlay visible during recording"

requirements-completed: [APPVIS-01, APPVIS-02, APPVIS-03, APPVIS-04]

# Metrics
duration: 2min
completed: 2026-04-01
---

# Phase 08 Plan 01: App Detection Infrastructure Summary

**App detection module with 5 preset apps, AppleScript URL extraction, whitelist persistence, 500ms polling loop, and IPC bridge for overlay visibility control**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-01T06:50:59Z
- **Completed:** 2026-04-01T06:53:04Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created app-detector.js with PRESET_APPS (Slack, Gmail, Notion, Jira, GitHub), shouldShowOverlay, and getBrowserTabUrl
- Added whitelist persistence via JSON file in userData, 500ms polling loop, and IPC handlers to main.js
- Added getCaptureAppPresets, getCaptureApps, updateCaptureApps to preload.js bridge
- Overlay starts hidden by default and only appears when a whitelisted app is in the foreground

## Task Commits

Each task was committed atomically:

1. **Task 1: Create app-detector module with URL extraction and whitelist matching** - `5cfc431` (feat)
2. **Task 2: Add whitelist persistence, polling loop, and IPC bridge to main.js and preload.js** - `06c55c9` (feat)

## Files Created/Modified
- `apps/desktop/src/main/app-detector.js` - App detection module: PRESET_APPS, shouldShowOverlay, getBrowserTabUrl
- `apps/desktop/src/main/main.js` - Whitelist persistence, polling loop, IPC handlers, overlay hidden by default
- `apps/desktop/src/main/preload.js` - captureApps IPC bridge for renderer

## Decisions Made
- Used AppleScript for browser URL extraction instead of AX tree walker -- the existing ax_walker returns all text content, not URLs specifically; AppleScript accesses the scripting bridge more reliably for URL data
- Stored whitelist as JSON file in userData directory rather than backend DB -- this is desktop-only UI state
- Overlay hidden by default on startup (D-01) with conditional polling start only when whitelist has enabled apps

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Known Stubs

None - all data flows are wired end-to-end (IPC handlers read/write the whitelist file, polling loop calls shouldShowOverlay with live window info).

## Next Phase Readiness
- App detection infrastructure is complete and ready for the settings UI (Plan 02)
- IPC bridge is in place for the renderer to read presets, get current whitelist, and update it
- Overlay visibility is fully controlled by the polling loop based on whitelist state

---
*Phase: 08-limit-floating-capture-button-to-specific-apps*
*Completed: 2026-04-01*

## Self-Check: PASSED

All files exist. All commit hashes verified.
