---
phase: quick
plan: 260408-n3y
subsystem: desktop-overlay
tags: [avatar, electron, always-on-top, browserwindow, overlay]
dependency_graph:
  requires: []
  provides: [avatar-overlay-window]
  affects: [apps/desktop/src/main/main.js, apps/desktop/src/renderer/App.jsx]
tech_stack:
  added: []
  patterns: [captureOverlay pattern, self-contained HTML overlay, Electron BrowserWindow panel type]
key_files:
  created:
    - apps/desktop/src/renderer/avatar-overlay/avatar-overlay.html
    - apps/desktop/src/main/preload-avatar.js
  modified:
    - apps/desktop/src/main/main.js
    - apps/desktop/src/renderer/App.jsx
decisions:
  - Modeled createAvatarOverlay() exactly on createCaptureOverlay() for consistency (panel type, setVisibleOnAllWorkspaces, setAlwaysOnTop floating)
  - Avatar overlay is always visible (no hide() call on startup, unlike captureOverlay)
  - preload-avatar.js is a placeholder — avatar is self-contained with no IPC needed for MVP
  - floating-avatar.jsx kept as visual spec source-of-truth, not deleted
metrics:
  duration: "10min"
  completed: "2026-04-08"
  tasks: 2
  files: 4
---

# Quick Task 260408-n3y: Avatar Always-On-Top Overlay Summary

**One-liner:** Dedicated Electron BrowserWindow avatar overlay (80x80, always-on-top, non-focusable, left edge) replaces in-React FloatingAvatar for persistent global visibility.

## What Was Built

The Nota avatar was moved from the React renderer into a standalone Electron `BrowserWindow` overlay, mirroring the existing `captureOverlay` pattern from Phase 6. The avatar now persists on the left edge of the screen (`x=16`, vertically centered) even when the main Privanote window is hidden or behind other applications.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create avatar-overlay.html and preload-avatar.js | e4ab5d1 | apps/desktop/src/renderer/avatar-overlay/avatar-overlay.html, apps/desktop/src/main/preload-avatar.js |
| 2 | Wire avatar overlay in main.js and remove from React renderer | 283220b | apps/desktop/src/main/main.js, apps/desktop/src/renderer/App.jsx |

## Key Technical Details

**avatar-overlay.html:** Self-contained single-file HTML with inline SVG avatar (identical visual to floating-avatar.jsx), inline CSS, and inline JS. Implements blinking (random 2-5s intervals, eye ry 0.3 for 160ms), hover mouth toggle (open/closed path), click bounce animation (CSS keyframe, 600ms), and speech bubble greeting (3s display, array of 5 Spanish greetings). Uses `-webkit-app-region: no-drag` on button and `drag` on container for correct interaction in frameless window.

**main.js changes:**
- `let avatarOverlay = null` module-level variable
- `createAvatarOverlay()` function: `BrowserWindow` with `width: 80, height: 80, x: 16, y: screenHeight/2 - 40`, `alwaysOnTop: true, frame: false, transparent: true, focusable: false, type: 'panel'` (macOS), `setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })`, `setAlwaysOnTop(true, 'floating')`
- Called in `app.whenReady()` immediately after `createCaptureOverlay()` — no `hide()` call
- Cleanup in `before-quit`: `avatarOverlay.close()` if not destroyed

**App.jsx changes:** Removed `import FloatingAvatar` line and `<FloatingAvatar />` JSX element. `floating-avatar.jsx` component file preserved.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] `apps/desktop/src/renderer/avatar-overlay/avatar-overlay.html` exists
- [x] `apps/desktop/src/main/preload-avatar.js` exists
- [x] `createAvatarOverlay` present in main.js (line 286)
- [x] `FloatingAvatar` absent from App.jsx
- [x] Commits e4ab5d1 and 283220b exist

## Self-Check: PASSED
