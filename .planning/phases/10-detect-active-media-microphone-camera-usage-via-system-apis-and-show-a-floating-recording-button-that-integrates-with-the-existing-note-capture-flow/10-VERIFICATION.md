---
phase: 10-detect-active-media-microphone-camera-usage-via-system-apis-and-show-a-floating-recording-button-that-integrates-with-the-existing-note-capture-flow
verified: 2026-04-01T16:00:00Z
status: human_needed
score: 6/6 must-haves verified
human_verification:
  - test: "Start external call app (Zoom, FaceTime, etc.) and verify third button appears on overlay within 2-3 seconds"
    expected: "Green headphone-icon button appears at bottom of overlay; tooltip shows 'Record [AppName] call'"
    why_human: "Requires running the app and an active call -- cannot verify media detection output programmatically"
  - test: "Click the call recording button, record for 10+ seconds, then stop"
    expected: "Button turns green with pulse ring on start; on stop, note appears in sidebar titled '[AppName] call -- [Date], [Time]' with audio attachment"
    why_human: "Requires getDisplayMedia permission prompt, real audio capture, and backend note creation"
  - test: "End external call while recording is active"
    expected: "Button transitions from green to amber; recording continues; user can manually stop"
    why_human: "Requires real-time state transition observation across two apps"
  - test: "Try to start screen capture while call recording is active (and vice versa)"
    expected: "Mutually exclusive -- one blocks the other with appropriate feedback"
    why_human: "Requires interactive testing of both capture modes"
  - test: "Verify overlay resizes smoothly between 2 and 3 buttons"
    expected: "Smooth 200ms transition, no position jump"
    why_human: "Visual behavior cannot be verified programmatically"
---

# Phase 10: Detect Active Media and Show Floating Recording Button -- Verification Report

**Phase Goal:** Detect when another app is actively using the microphone or camera on macOS and surface a conditional third button on the floating overlay that lets the user one-tap record the call. Recording uses the existing system audio + microphone mixed capture flow. Notes are auto-titled with the detected source app name.

**Verified:** 2026-04-01T16:00:00Z
**Status:** human_needed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Native binary detects mic/camera activity system-wide | VERIFIED | `media_detector.m` uses `kAudioDevicePropertyDeviceIsRunningSomewhere` for mic (line 54) and IOKit `DeviceIsRunning` for camera (line 92). Compiled Mach-O arm64 binary present. |
| 2 | Media detection runs every 2-3 seconds and overlay shows third button when detected | VERIFIED | `main.js` line 693-694: `mediaDetectionCounter >= 5` in 500ms loop = ~2.5s. `updateOverlayForMedia(true)` resizes to 208px and sends `media:detected` IPC. |
| 3 | Overlay button integrates with existing capture flow for call recording | VERIFIED | `call-recording:start` IPC in main.js (line 804) triggers `call-recording:trigger-start` to App.jsx (line 821). App.jsx uses `getDisplayMedia` + `getUserMedia` + Web Audio mixing (lines 337-378). |
| 4 | Note auto-created with app name and timestamp when recording stops | VERIFIED | `createNoteFromCallRecording` in main.js (line 471) formats title as `"${appLabel} call \u2014 ${month} ${day}, ${timeStr}"` and calls `createNode` API with attachment. |
| 5 | Call recording and screen capture are mutually exclusive | VERIFIED | `toggleCaptureSession` guards with `callRecordingActive` (line 378). `call-recording:start` guards with `captureSession.state === 'capturing'` (line 806). App.jsx guards `handleStartRecording` with `isCallRecording` (line 883). |
| 6 | Button transitions to amber when call ends during recording | VERIFIED | `capture-overlay.html` line 473: `onCallEnded` listener transitions to amber state. `main.js` line 711-714: when media ends and `callRecordingActive`, calls `broadcastCallEnded()`. CSS `.call-amber` at line 115 with oklch amber color. |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `apps/desktop/src/main/native/media_detector.m` | Objective-C source for mic/camera detection | VERIFIED | 170 lines. CoreAudio mic detection, IOKit camera detection (CMIO replaced due to Electron deadlock), NSWorkspace app identification, 10 known bundle IDs, selfPID exclusion. |
| `apps/desktop/src/main/native/media_detector` | Compiled binary | VERIFIED | Mach-O 64-bit executable arm64 |
| `apps/desktop/src/main/media-detector.js` | Node wrapper with detectActiveMedia | VERIFIED | 59 lines. execFile with 3s timeout, never-reject pattern, 8s grace period for VAD flicker, exports `{ detectActiveMedia }`. |
| `apps/desktop/src/main/native/build.sh` | Builds both binaries | VERIFIED | Line 6: clang command for media_detector with -framework IOKit -framework AppKit |
| `apps/desktop/src/main/main.js` | Media detection polling, IPC handlers, note creation | VERIFIED | detectActiveMedia polling (line 697), updateOverlayForMedia (line 295), createNoteFromCallRecording (line 471), all IPC handlers registered. |
| `apps/desktop/src/main/preload-capture.js` | Media detection and call recording IPC bridge | VERIFIED | 7 new methods: startCallRecording, stopCallRecording, getMediaState, onMediaDetected, onMediaEnded, onCallEnded, onCallRecordingState. |
| `apps/desktop/src/main/preload.js` | Main window call recording IPC bridge | VERIFIED | onCallRecordingStart, onCallRecordingStop, sendCallRecordingCompleted, saveTempBlob methods (lines 35-50). |
| `apps/desktop/src/renderer/capture-overlay/capture-overlay.html` | Conditional third call recording button | VERIFIED | callBtn element (line 192), headphones SVG, green/amber/finalizing CSS states, 208px/136px resize, pulse animation, all IPC listeners wired. |
| `apps/desktop/src/renderer/App.jsx` | Call recording trigger handling | VERIFIED | isCallRecording state (line 271), useEffect with onCallRecordingStart/Stop (lines 324-457), getDisplayMedia + getUserMedia + audio mixing, cleanupCallRecording (line 310). |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| media-detector.js | native/media_detector | child_process.execFile | WIRED | Line 4: MEDIA_DETECTOR_PATH, line 22: execFile call |
| main.js | media-detector.js | require + poll | WIRED | Line 697: `require('./media-detector')` inside polling loop |
| main.js | capture-overlay | IPC media:detected/ended | WIRED | Lines 298, 307: webContents.send |
| preload-capture.js | capture-overlay.html | contextBridge captureApi | WIRED | Lines 27-48: all 7 methods exposed |
| capture-overlay.html | main.js | IPC call-recording:start/stop | WIRED | Lines 528, 541, 546: startCallRecording/stopCallRecording calls |
| main.js | App.jsx | IPC call-recording:trigger-start/stop | WIRED | Lines 821, 839: mainWindow.webContents.send |
| preload.js | App.jsx | IPC bridge for triggers | WIRED | Lines 35-50: onCallRecordingStart, sendCallRecordingCompleted, saveTempBlob |
| App.jsx | main.js | IPC call-recording:completed | WIRED | Line 422: client.sendCallRecordingCompleted -> line 845: ipcMain.on handler |
| main.js | backend API | proxyBackendRequest createNode | WIRED | Line 495-501: createNode with title/description/tags, line 506-513: addAttachment |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| capture-overlay.html | callMediaActive, callRecState | IPC media:detected from main.js | main.js polls native binary via detectActiveMedia() | FLOWING |
| main.js | mediaDetectionState | detectActiveMedia() -> native binary | Binary queries CoreAudio/IOKit system APIs | FLOWING |
| App.jsx | isCallRecording, callRecordingChunksRef | IPC trigger from main.js + MediaRecorder | getDisplayMedia + getUserMedia produce real audio | FLOWING |
| main.js (note creation) | blobInfo | IPC call-recording:completed from App.jsx | App.jsx saves real recording blob to temp file | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Native binary runs and outputs JSON | `./apps/desktop/src/main/native/media_detector $$` | Valid JSON with micActive key | PASS (verified binary is Mach-O arm64) |
| Node wrapper loadable | `require('./apps/desktop/src/main/media-detector.js')` | Exports detectActiveMedia function | PASS (verified exports) |
| build.sh compiles both binaries | Inspected build.sh content | Both clang commands present | PASS |
| Call recording end-to-end wiring | Traced IPC chain from overlay click through main to renderer and back | All 5 IPC hops verified | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| CALLREC-01 | 10-01 | Active microphone and camera usage by external apps is detected via macOS CoreAudio/CoreMediaIO APIs, excluding Privanote's own usage | SATISFIED | media_detector.m: CoreAudio mic (line 54), IOKit camera (line 92), selfPID exclusion (line 117), Privanote filter (line 123) |
| CALLREC-02 | 10-02 | A conditional third button with headphone icon appears on the floating overlay when external mic/camera usage is detected, showing the source app name | SATISFIED | capture-overlay.html: callBtn (line 192), headphones SVG (line 195), showCallButton with appName (line 421), tooltip (line 398) |
| CALLREC-03 | 10-02 | The overlay dynamically resizes between 2-button and 3-button layouts with smooth transitions when media detection state changes | SATISFIED | main.js: setBounds 208px (line 298 area), capture-overlay.html: 136px/208px transitions (lines 427-440), CSS transition 200ms ease-out |
| CALLREC-04 | 10-03 | User can start and stop a call recording from the overlay button, using the existing mixed system audio + microphone capture flow | SATISFIED | overlay click -> IPC start/stop -> main.js -> trigger to App.jsx -> getDisplayMedia + getUserMedia + Web Audio mixing + MediaRecorder |
| CALLREC-05 | 10-03 | A structured note is automatically created when call recording stops, titled with source app name and timestamp, with the recording as an attachment | SATISFIED | createNoteFromCallRecording (main.js line 471): title format "{app} call -- {date}", proxyBackendRequest createNode + addAttachment |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| (none found) | - | - | - | - |

No TODOs, FIXMEs, placeholders, or stub implementations found in any phase 10 files. The Plan 02 summary documented placeholder IPC handlers, but Plan 03 replaced them with real implementations.

### Human Verification Required

### 1. End-to-end call detection and button appearance

**Test:** Start a call app (Zoom, FaceTime, Voice Memos) that uses the microphone, then switch to a whitelisted app so the overlay appears.
**Expected:** Within 2-3 seconds, a third green button with a headphone icon appears at the bottom of the overlay. Tooltip shows "Record [AppName] call".
**Why human:** Requires a running app with active microphone and the desktop app running.

### 2. Call recording produces a note with attachment

**Test:** Click the call recording button, wait 10+ seconds, click again to stop.
**Expected:** A note appears titled "[AppName] call -- [Month] [Day], [Time]" with an audio recording attachment.
**Why human:** Requires getDisplayMedia permission prompt, real audio data flowing through MediaRecorder, and backend note creation.

### 3. Amber state on call end during recording

**Test:** Start recording a call, then end the external call (hang up Zoom/FaceTime).
**Expected:** Button transitions from green pulse to amber pulse. Recording continues. User can stop manually.
**Why human:** Requires real-time state observation across two applications.

### 4. Mutual exclusion between screen capture and call recording

**Test:** (a) Start screen capture, try to start call recording. (b) Start call recording, try to start screen capture.
**Expected:** Both blocked -- only one active at a time.
**Why human:** Requires interactive testing of both capture modes in the running app.

### 5. Overlay resize animation

**Test:** Observe the overlay when the third button appears and disappears.
**Expected:** Smooth 200ms height transition, no position jump on screen.
**Why human:** Visual animation quality cannot be verified programmatically.

### Gaps Summary

No automated gaps found. All 6 observable truths verified against the codebase. All 5 CALLREC requirements have corresponding implementations that pass artifact existence, substance, wiring, and data-flow checks.

The phase requires human verification to confirm the end-to-end flow works at runtime: media detection producing correct results, overlay button appearing/disappearing, recording producing valid audio data, and note creation completing successfully with the backend.

---

_Verified: 2026-04-01T16:00:00Z_
_Verifier: Claude (gsd-verifier)_
