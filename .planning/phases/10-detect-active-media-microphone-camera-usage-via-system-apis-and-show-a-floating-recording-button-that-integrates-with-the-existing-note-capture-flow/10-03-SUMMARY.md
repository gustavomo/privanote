---
phase: 10-detect-active-media-microphone-camera-usage-via-system-apis-and-show-a-floating-recording-button-that-integrates-with-the-existing-note-capture-flow
plan: 03
subsystem: ui, desktop
tags: [electron, ipc, mediarecorder, webm, call-recording]

requires:
  - phase: 10-02
    provides: overlay call button, media detection IPC bridge

provides:
  - Call recording IPC handlers (start/stop/completed) in main.js
  - Call recording trigger handling in App.jsx with audio/video mode support
  - Auto-titled note creation with recording attachment
  - Mutual exclusion between screen capture and call recording
  - Audio/video mode picker in overlay
  - Conditional button visibility (clipboard always, capture for whitelisted, call on media)
  - IOKit camera detection replacing CMIO (deadlock fix under Electron)
  - Grace period for VAD-based mic toggling

affects: [capture-overlay, main-process, renderer]

tech-stack:
  added: []
  patterns: [mode-picker-in-overlay, ipc-mode-propagation, iokit-camera-detection]

key-files:
  created: []
  modified:
    - apps/desktop/src/main/main.js
    - apps/desktop/src/renderer/App.jsx
    - apps/desktop/src/main/preload.js
    - apps/desktop/src/main/preload-capture.js
    - apps/desktop/src/renderer/capture-overlay/capture-overlay.html
    - apps/desktop/src/main/native/media_detector.m
    - apps/desktop/src/main/native/build.sh
    - apps/desktop/src/main/media-detector.js
---

## What was done

Wired the full call recording flow from overlay button through main process to renderer:

1. **Call recording IPC** — `call-recording:start` (with mode), `call-recording:stop`, `call-recording:completed` handlers in main.js
2. **Renderer recording** — App.jsx handles `call-recording:trigger-start` with audio-only or audio+video mode, using MediaRecorder with mixed system audio + mic
3. **Auto-note creation** — Note titled "[App] call — [Date], [Time]" with recording attached as audio or video kind
4. **Mode picker** — Overlay shows mic icon (audio) and camera icon (audio+video) options when call button clicked
5. **Conditional button visibility** — Clipboard always visible, screen capture only for whitelisted apps, call recording only when media detected
6. **Bug fixes** — CMIO→IOKit for camera detection (CMIO deadlocked under Electron), 8s grace period for VAD mic toggling, correct backend contract (`addAttachment` with `kind`)

## Deviations

- Replaced CMIO camera detection with IOKit: CoreMediaIO's `CMIOObjectGetPropertyData` hangs when Electron holds the CMIO system object lock via `desktopCapturer`. IOKit's `AppleH13CameraInterface` `DeviceIsRunning` property works without conflicts.
- Added audio/video mode picker: original plan only had audio recording, but user requested the option during verification.
- Restructured overlay to show clipboard button always, screen capture conditionally (whitelisted apps only), and call recording conditionally (media detected only).

## Self-Check: PASSED
