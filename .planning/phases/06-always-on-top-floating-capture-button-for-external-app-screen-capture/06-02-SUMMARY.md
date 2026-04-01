---
phase: 06-always-on-top-floating-capture-button-for-external-app-screen-capture
plan: 02
subsystem: capture
tags: [electron, desktopCapturer, active-win, tesseract.js, ocr, screen-capture, state-machine]

# Dependency graph
requires:
  - phase: 06-always-on-top-floating-capture-button-for-external-app-screen-capture
    provides: "Plan 01 overlay window infrastructure"
provides:
  - "CaptureSession state machine managing idle/capturing/finalizing lifecycle"
  - "screen-capture module with screenshot, active window detection, and OCR text extraction"
  - "active-win and tesseract.js dependencies in desktop workspace"
affects: [06-03-wiring, 06-04-polish]

# Tech tracking
tech-stack:
  added: [active-win@9, tesseract.js@7]
  patterns: [lazy-esm-import, singleton-worker-pool, event-driven-polling]

key-files:
  created:
    - apps/desktop/src/main/screen-capture.js
    - apps/desktop/src/main/capture-session.js
  modified:
    - apps/desktop/package.json

key-decisions:
  - "Used dynamic import() for active-win@9 (ESM-only) from CommonJS main process"
  - "Tesseract worker lazily initialized and reused across captures for performance"
  - "Event-driven capture: polls every 2s, screenshots on app focus change or 10s heartbeat"
  - "Self-capture filtered by bundleId and appName to avoid capturing Privanote itself"

patterns-established:
  - "Lazy ESM import: ESM-only packages loaded via dynamic import() in CommonJS main process"
  - "Singleton worker: Tesseract worker created once, reused, terminated on session end"
  - "Event-driven polling: lightweight poll detects change, expensive operation only on trigger"

requirements-completed: [EXT-03, EXT-04]

# Metrics
duration: 2min
completed: 2026-04-01
---

# Phase 06 Plan 02: Capture Session Engine Summary

**Main-process capture engine with desktopCapturer screenshots, active-win window detection, and Tesseract.js OCR text extraction in an event-driven state machine**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-01T04:18:52Z
- **Completed:** 2026-04-01T04:20:45Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Screen capture module that takes screenshots via Electron desktopCapturer, identifies the active window via active-win, and extracts text via Tesseract.js OCR
- CaptureSession state machine with idle/capturing/finalizing lifecycle and event-driven capture on app focus change or 10s heartbeat
- Dependencies active-win@9 and tesseract.js@7 installed in desktop workspace

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies and create screen-capture module** - `d567962` (feat)
2. **Task 2: Create capture session state machine** - `78127fb` (feat)

## Files Created/Modified
- `apps/desktop/src/main/screen-capture.js` - Screenshot capture, active window detection, OCR text extraction
- `apps/desktop/src/main/capture-session.js` - CaptureSession state machine managing capture lifecycle
- `apps/desktop/package.json` - Added active-win@9 and tesseract.js@7 dependencies

## Decisions Made
- Used dynamic `import()` for active-win@9 since it is ESM-only and the main process uses CommonJS
- Tesseract worker is lazily initialized as a singleton and reused across captures (creating per-screenshot is too slow)
- Adjusted Tesseract.js import to use `Tesseract.default.createWorker` for v7 ESM-from-CJS dynamic import
- Adjusted active-win import to use `mod.default()` for v9 ESM default export
- Event-driven polling every 2s with capture on app change or 10s heartbeat balances responsiveness and resource usage

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Adjusted ESM dynamic import calls for active-win v9 and tesseract.js v7**
- **Found during:** Task 1 (screen-capture module creation)
- **Issue:** Plan code used `mod.activeWindow()` for active-win and `Tesseract.createWorker` for tesseract.js, but v9 active-win exports the function as default and v7 tesseract.js needs `Tesseract.default.createWorker` when dynamically imported from CJS
- **Fix:** Changed to `mod.default()` for active-win and `Tesseract.default.createWorker('eng')` for tesseract.js
- **Files modified:** apps/desktop/src/main/screen-capture.js
- **Verification:** Code follows correct ESM dynamic import patterns for both libraries
- **Committed in:** d567962 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Essential correction for ESM interop. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - both modules are fully implemented with all exports wired.

## Next Phase Readiness
- screen-capture.js and capture-session.js are ready for Plan 03 (wiring) to connect to the overlay UI and note creation flow
- CaptureSession exposes onStateChange callback for main process to relay state to overlay window
- finalize() returns grouped captures with extracted text ready for note creation

---
*Phase: 06-always-on-top-floating-capture-button-for-external-app-screen-capture*
*Completed: 2026-04-01*

## Self-Check: PASSED
- All created files verified on disk
- All commit hashes verified in git log
