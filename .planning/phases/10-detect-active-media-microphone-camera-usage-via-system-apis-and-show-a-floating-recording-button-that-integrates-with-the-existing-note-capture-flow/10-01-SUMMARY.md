---
phase: 10-detect-active-media-microphone-camera-usage-via-system-apis-and-show-a-floating-recording-button-that-integrates-with-the-existing-note-capture-flow
plan: 01
subsystem: native
tags: [objective-c, coreaudio, coremediaio, macos, native-binary]

requires:
  - phase: 06
    provides: Native binary build pattern (ax_walker, build.sh)
provides:
  - Compiled media_detector binary for mic/camera detection
  - Node.js wrapper (detectActiveMedia) for main process consumption
  - Updated build.sh compiling both ax_walker and media_detector
affects: [10-02, 10-03]

tech-stack:
  added: [CoreAudio, CoreMediaIO]
  patterns: [native-binary-with-node-wrapper]

key-files:
  created:
    - apps/desktop/src/main/native/media_detector.m
    - apps/desktop/src/main/native/media_detector
    - apps/desktop/src/main/media-detector.js
  modified:
    - apps/desktop/src/main/native/build.sh

key-decisions:
  - "Used same native binary + Node wrapper pattern established by ax_walker in Phase 6"
  - "CMIOObjectGetPropertyData requires 7 args including dataUsed output parameter"

patterns-established:
  - "Media detection binary pattern: CoreAudio for mic, CoreMediaIO for camera, NSWorkspace for app identification"

requirements-completed: [CALLREC-01]

duration: 2min
completed: 2026-04-01
---

# Phase 10 Plan 01: Native Media Detection Binary Summary

**Objective-C binary detecting mic/camera activity via CoreAudio and CoreMediaIO with Node.js wrapper for call app identification**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-01T14:53:25Z
- **Completed:** 2026-04-01T14:55:42Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Native media_detector binary detecting microphone activity via CoreAudio kAudioDevicePropertyDeviceIsRunningSomewhere
- Camera detection via CoreMediaIO kCMIODevicePropertyDeviceIsRunningSomewhere with screen capture device enumeration
- Call app identification across 10 known bundle IDs (Zoom, Teams, Slack, Skype, FaceTime, Chrome, Brave, Discord, WebEx) with selfPID exclusion
- Node.js wrapper with 3s timeout, never-reject error handling, and derived `active` boolean

## Task Commits

Each task was committed atomically:

1. **Task 1: Create media_detector.m native binary and compile** - `b5201dc` (feat)
2. **Task 2: Create media-detector.js Node wrapper** - `5652472` (feat)

## Files Created/Modified
- `apps/desktop/src/main/native/media_detector.m` - Objective-C source for mic/camera detection and call app identification
- `apps/desktop/src/main/native/media_detector` - Compiled Mach-O binary
- `apps/desktop/src/main/media-detector.js` - Node wrapper exporting detectActiveMedia()
- `apps/desktop/src/main/native/build.sh` - Updated to compile both ax_walker and media_detector

## Decisions Made
- Followed ax_walker native binary pattern from Phase 6 for consistency
- CMIOObjectGetPropertyData API requires 7 arguments (includes dataUsed output parameter) unlike AudioObjectGetPropertyData which uses 6

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed CMIOObjectGetPropertyData call signature**
- **Found during:** Task 1 (compilation)
- **Issue:** CMIOObjectGetPropertyData requires 7 arguments (including dataUsed output param), not 6 like AudioObjectGetPropertyData
- **Fix:** Added dataUsed parameter to both CMIO calls
- **Files modified:** apps/desktop/src/main/native/media_detector.m
- **Verification:** Compilation succeeded, binary runs and outputs valid JSON
- **Committed in:** b5201dc (part of Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** API signature correction required for compilation. No scope creep.

## Issues Encountered
None beyond the CMIO API signature fix documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- media_detector binary and detectActiveMedia wrapper ready for Plan 02 polling integration
- Build.sh compiles both native binaries in one step

---
*Phase: 10-detect-active-media-microphone-camera-usage-via-system-apis-and-show-a-floating-recording-button-that-integrates-with-the-existing-note-capture-flow*
*Completed: 2026-04-01*
