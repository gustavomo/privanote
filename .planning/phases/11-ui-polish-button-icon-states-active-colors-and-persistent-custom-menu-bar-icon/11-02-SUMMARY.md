---
phase: 11-ui-polish-button-icon-states-active-colors-and-persistent-custom-menu-bar-icon
plan: 02
subsystem: ui
tags: [electron-tray, nativeimage, template-image, minimize-to-tray, macos-menu-bar, png-icons]

# Dependency graph
requires:
  - phase: 11-ui-polish-button-icon-states-active-colors-and-persistent-custom-menu-bar-icon
    plan: 01
    provides: Overlay button polish with teal active color and resized BrowserWindow
  - phase: 06-always-on-top-floating-capture-button-for-external-app-screen-capture
    provides: Original tray setup with emoji text, captureOverlay BrowserWindow
provides:
  - Monochrome P lettermark template image tray icon with automatic light/dark adaptation
  - Recording-state tray icon variant with red dot badge
  - Minimize-to-tray window close behavior
  - Tray click handler to reopen main window
  - Quit Privanote tray context menu item
  - Tray cleanup on quit to prevent ghost icon
affects: [desktop-lifecycle, tray-management, window-management]

# Tech tracking
tech-stack:
  added: []
  patterns: [template-image-naming-convention, minimize-to-tray-close-intercept, isQuitting-guard-pattern]

key-files:
  created:
    - apps/desktop/resources/trayTemplate.png
    - apps/desktop/resources/trayTemplate@2x.png
    - apps/desktop/resources/trayRecTemplate.png
    - apps/desktop/resources/trayRecTemplate@2x.png
  modified:
    - apps/desktop/src/main/main.js

key-decisions:
  - "Used nativeImage.createFromPath with Template filename suffix convention instead of createFromBuffer + setTemplateImage for cleaner @2x auto-detection"
  - "Generated tray icon PNGs programmatically using raw PNG buffer construction with Node.js built-in zlib, avoiding canvas npm dependency"
  - "Red dot badge uses #FF3B30 (Apple system red) which macOS preserves in template images since non-grayscale pixels are not inverted"
  - "Dock icon remains visible when window is hidden to allow standard macOS Alt-Tab and dock click behavior"

patterns-established:
  - "Template image naming: files named *Template.png are auto-detected as template images by Electron, no explicit setTemplateImage call needed"
  - "Minimize-to-tray: close event interceptor checks isQuitting flag before hiding; before-quit sets flag and destroys tray"

requirements-completed: [UIPOL-05, UIPOL-06, UIPOL-07]

# Metrics
duration: 3min
completed: 2026-04-01
---

# Phase 11 Plan 02: Menu Bar Icon and Minimize-to-Tray Summary

**Monochrome P lettermark tray icon with recording red-dot variant, minimize-to-tray window close, and Quit Privanote context menu**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-01T19:52:51Z
- **Completed:** 2026-04-01T19:56:09Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Created four tray icon PNG assets: idle P lettermark (16x16 + 32x32) and recording P+red-dot (16x16 + 32x32) using programmatic PNG generation
- Replaced emoji-based tray text with proper macOS template image that auto-adapts to light/dark menu bar
- Added minimize-to-tray behavior: closing main window hides it, tray click reopens it, Cmd+Q fully quits
- Added "Quit Privanote" to tray context menu in both idle and recording states
- Added tray.destroy() cleanup in before-quit handler to prevent ghost tray icon after quit

## Task Commits

Each task was committed atomically:

1. **Task 1: Create tray icon PNG assets** - `853e47e` (feat)
2. **Task 2: Replace tray emoji with template icon, add minimize-to-tray and quit behavior** - `61ce032` (feat)

## Files Created/Modified

- `apps/desktop/resources/trayTemplate.png` - 16x16 monochrome P lettermark for idle tray state
- `apps/desktop/resources/trayTemplate@2x.png` - 32x32 Retina variant of idle tray icon
- `apps/desktop/resources/trayRecTemplate.png` - 16x16 P with red dot badge for recording tray state
- `apps/desktop/resources/trayRecTemplate@2x.png` - 32x32 Retina variant of recording tray icon
- `apps/desktop/src/main/main.js` - Replaced createEmptyTrayImage with createTrayIcon using createFromPath, updated setupTray with click handler, updated updateTray to swap icons and remove emoji, added close interceptor for minimize-to-tray, added tray cleanup in before-quit, updated activate handler for hidden window

## Decisions Made

- Used nativeImage.createFromPath with Template filename suffix convention instead of createFromBuffer + setTemplateImage -- Electron auto-detects template images and @2x variants from the filename
- Generated PNGs programmatically with raw buffer construction using Node.js built-in zlib module, avoiding the canvas npm dependency entirely
- Red dot badge uses #FF3B30 (Apple system red) which macOS preserves in template images since non-grayscale pixels are not inverted
- Dock icon remains visible when window is hidden to allow standard macOS Alt-Tab and dock click behavior (matching Slack/Discord pattern)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Known Stubs

None - all changes are complete implementations with no placeholder data or TODO items.

## Next Phase Readiness

- Phase 11 complete: overlay button polish (Plan 01) and menu bar icon with minimize-to-tray (Plan 02) are both done
- The tray icon uses the Template naming convention; future icon updates only need to replace the PNG files in apps/desktop/resources/

## Self-Check: PASSED

- FOUND: apps/desktop/resources/trayTemplate.png
- FOUND: apps/desktop/resources/trayTemplate@2x.png
- FOUND: apps/desktop/resources/trayRecTemplate.png
- FOUND: apps/desktop/resources/trayRecTemplate@2x.png
- FOUND: apps/desktop/src/main/main.js
- FOUND: 11-02-SUMMARY.md
- FOUND: commit 853e47e
- FOUND: commit 61ce032

---
*Phase: 11-ui-polish-button-icon-states-active-colors-and-persistent-custom-menu-bar-icon*
*Completed: 2026-04-01*
