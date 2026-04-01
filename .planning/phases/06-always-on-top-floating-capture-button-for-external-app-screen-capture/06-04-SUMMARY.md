---
phase: 06-always-on-top-floating-capture-button-for-external-app-screen-capture
plan: 04
subsystem: capture
tags: [accessibility, ax-tree, ocr, macos, objective-c, text-extraction]

requires:
  - phase: 06-02
    provides: "screen-capture.js with OCR text extraction and capture pipeline"
  - phase: 06-03
    provides: "capture-session.js with _captureNow() calling extractTextFromImage"
provides:
  - "AX tree walker binary for macOS accessibility text extraction"
  - "Node.js wrapper (ax-tree-extractor.js) with timeout and error handling"
  - "extractText() function that tries AX tree first, falls back to OCR"
affects: [capture-pipeline, text-extraction]

tech-stack:
  added: [objective-c, ApplicationServices.framework]
  patterns: [ax-tree-first-ocr-fallback, native-binary-via-child-process]

key-files:
  created:
    - apps/desktop/src/main/native/ax_walker.m
    - apps/desktop/src/main/native/build.sh
    - apps/desktop/src/main/ax-tree-extractor.js
  modified:
    - apps/desktop/src/main/screen-capture.js
    - apps/desktop/src/main/capture-session.js
    - .gitignore

key-decisions:
  - "Used Objective-C instead of Swift for AX walker due to Swift toolchain/SDK version mismatch on build machine"
  - "Manual JSON output in Objective-C to avoid any Swift Foundation dependency"

patterns-established:
  - "AX-tree-first, OCR-fallback: extractText() tries accessibility tree before falling back to Tesseract OCR"
  - "Native binary pattern: compile Objective-C via build.sh, invoke via child_process.execFile with timeout"

requirements-completed: [EXT-06]

duration: 7min
completed: 2026-04-01
---

# Phase 06 Plan 04: AX Tree Text Extraction Summary

**Objective-C AX tree walker extracts text from app accessibility trees as primary method, with Tesseract OCR as automatic fallback**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-01T05:06:07Z
- **Completed:** 2026-04-01T05:12:58Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Built Objective-C CLI binary that walks macOS accessibility tree for any PID, extracting AXValue/AXTitle/AXDescription
- Created Node.js wrapper with 3-second timeout and graceful error handling (never throws)
- Integrated AX tree as primary text extraction in capture pipeline, OCR kicks in automatically when AX fails

## Task Commits

Each task was committed atomically:

1. **Task 1: Create AX tree walker binary and Node.js wrapper** - `971c4d8` (feat)
2. **Task 2: Integrate AX tree extraction as primary method with OCR fallback** - `ff5ac17` (feat)

## Files Created/Modified
- `apps/desktop/src/main/native/ax_walker.m` - Objective-C CLI that walks AX tree for a PID, outputs JSON
- `apps/desktop/src/main/native/build.sh` - Build script compiling ax_walker with clang
- `apps/desktop/src/main/ax-tree-extractor.js` - Node wrapper invoking ax_walker via execFile with timeout
- `apps/desktop/src/main/screen-capture.js` - Added extractText() with AX-first, OCR-fallback strategy
- `apps/desktop/src/main/capture-session.js` - Uses extractText() instead of extractTextFromImage()
- `.gitignore` - Added compiled ax_walker binary to ignore list

## Decisions Made
- Used Objective-C instead of Swift: Swift compiler 6.2.4 had a SwiftBridging module redefinition error with the installed CommandLineTools SDK (built with Swift 6.2). Objective-C compiles cleanly with clang and has identical AX API access.
- Manual JSON construction in the binary avoids JSONSerialization overhead and keeps the binary minimal.
- The binary filters out menu bar items and window chrome (Close/Minimize/Zoom/Full Screen) to return only content text.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Switched from Swift to Objective-C for AX walker binary**
- **Found during:** Task 1 (binary compilation)
- **Issue:** Swift compiler (6.2.4) has a known SwiftBridging module redefinition error with the installed CommandLineTools SDK, preventing compilation of any Swift code importing Foundation or ApplicationServices
- **Fix:** Rewrote ax_walker.swift as ax_walker.m (Objective-C) with identical functionality. Updated build.sh to use clang instead of swiftc.
- **Files modified:** ax_walker.m (created instead of .swift), build.sh
- **Verification:** Binary compiles, runs, outputs correct JSON for no-args, invalid PID, and valid PID cases
- **Committed in:** 971c4d8 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Language change from Swift to Objective-C. Same AX API, same JSON output, same binary name. No functional difference.

## Issues Encountered
- Swift toolchain/SDK version mismatch (compiler 6.2.4 vs SDK built with 6.2) caused SwiftBridging module redefinition. Resolved by using Objective-C which compiles with clang and avoids the Swift module system entirely.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all functionality is fully wired.

## Next Phase Readiness
- Phase 06 is now complete: floating capture button, screen capture, overlay window, main.js wiring, and AX tree text extraction are all in place
- AX tree extraction will return empty results without Accessibility permission granted to the app - this is expected macOS behavior and the OCR fallback handles it transparently

## Self-Check: PASSED

All files verified present. All commit hashes verified in git log.

---
*Phase: 06-always-on-top-floating-capture-button-for-external-app-screen-capture*
*Completed: 2026-04-01*
