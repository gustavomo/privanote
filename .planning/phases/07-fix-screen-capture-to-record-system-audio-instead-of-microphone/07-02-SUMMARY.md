---
phase: 07-fix-screen-capture-to-record-system-audio-instead-of-microphone
plan: 02
subsystem: media
tags: [electron, system-audio, web-audio-api, getDisplayMedia, mixed-recording, permission-gating]

requires:
  - phase: 07-fix-screen-capture-to-record-system-audio-instead-of-microphone
    provides: Chromium loopback flag, setDisplayMediaRequestHandler, screen permission IPC channels

provides:
  - Mixed system audio + microphone recording in renderer via Web Audio API
  - Screen recording permission gating with denial tracking and three-state error messages
  - Proper cleanup of display streams and AudioContext on recording stop

affects: [renderer-audio-capture, recording-flow]

tech-stack:
  added: []
  patterns: [web-audio-api-stream-mixing, getDisplayMedia-loopback-audio, screen-permission-denial-tracking]

key-files:
  created: []
  modified:
    - apps/desktop/src/renderer/App.jsx

key-decisions:
  - "Removed resolveCaptureConstraints as dead code since stream acquisition is now inline per mode"
  - "Screen permission errors use three distinct constants matching UI-SPEC copy contract"

patterns-established:
  - "getDisplayMedia with minimal video constraint { width: 1, height: 1 } for audio-only loopback"
  - "Web Audio API AudioContext mixer pattern: createMediaStreamSource + createMediaStreamDestination"

requirements-completed: [SYSAUD-01, SYSAUD-02, SYSAUD-03, SYSAUD-04]

duration: 3min
completed: 2026-04-01
status: checkpoint-pending
---

# Phase 07 Plan 02: Renderer Mixed Audio Recording Summary

**Mixed system audio + microphone recording via Web Audio API with three-state screen permission gating in App.jsx**

## Status

CHECKPOINT PENDING -- Task 1 complete, Task 2 (human-verify) awaiting user verification of mixed audio recording.

## Performance

- **Duration:** 3 min (Task 1 only)
- **Started:** 2026-04-01T10:14:32Z
- **Completed:** pending checkpoint
- **Tasks:** 1/2 (Task 2 is human-verify checkpoint)
- **Files modified:** 1

## Accomplishments
- Replaced getUserMedia-only recording with getDisplayMedia + getUserMedia + Web Audio API mixing for system audio capture
- Added screen permission denial tracking with three error messages: not-determined, denied (re-prompt once), blocked (after 2 denials)
- All streams (displayStream, micStream) and AudioContext properly cleaned up on recording stop
- Video-only mode unchanged (no screen permission needed)

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace recording flow with mixed system audio + microphone and permission gating** - `8527c5e` (feat)
2. **Task 2: Verify mixed audio recording works end-to-end** - pending (checkpoint:human-verify)

## Files Created/Modified
- `apps/desktop/src/renderer/App.jsx` - Replaced recording flow with mixed stream acquisition, added permission error constants, new refs for cleanup, updated ensureCapturePermissions for screen denial tracking, removed dead resolveCaptureConstraints function

## Decisions Made
- Removed resolveCaptureConstraints function entirely rather than leaving it with an "unused" comment, since the old single-stream logic no longer applies
- Used three separate error message constants (screenPermissionNotDetermined, screenPermissionDenied, screenPermissionBlocked) to match UI-SPEC copy contract exactly

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all functionality is fully wired to the IPC channels established in Plan 01.

## Next Phase Readiness
- Pending human verification that mixed audio recording works correctly in all three capture modes
- After verification, phase 07 is complete

---
*Phase: 07-fix-screen-capture-to-record-system-audio-instead-of-microphone*
*Completed: pending checkpoint*
