---
phase: 07-fix-screen-capture-to-record-system-audio-instead-of-microphone
verified: 2026-04-01T12:00:00Z
status: human_needed
score: 9/9 must-haves verified
human_verification:
  - test: "Record in Audio mode and verify both system audio and microphone are captured"
    expected: "Playback of the recording contains both system sounds (e.g. YouTube audio) and spoken voice"
    why_human: "Cannot verify actual audio mixing output programmatically -- requires listening to recording playback"
  - test: "Record in Video + Audio mode and verify mixed audio with camera video"
    expected: "Recording plays back with camera video, system audio, and microphone audio all present"
    why_human: "Requires running the Electron app and verifying real media output"
  - test: "Deny screen recording permission twice, then attempt to record"
    expected: "After two denials, error message reads: 'Screen recording permission is required. Open System Settings > Privacy & Security > Screen Recording and enable access for Privanote, then try again.'"
    why_human: "Requires interacting with macOS permission prompts which cannot be automated"
  - test: "Record in Video-only mode without granting screen permission"
    expected: "Recording starts without requesting screen permission -- only camera is used"
    why_human: "Requires running app to confirm no screen permission prompt appears"
---

# Phase 7: Fix Screen Capture to Record System Audio Verification Report

**Phase Goal:** Change the sidebar capture panel's audio recording to capture system audio (loopback) mixed with microphone input using Electron's setDisplayMediaRequestHandler with Web Audio API mixing, replacing the current microphone-only getUserMedia approach.
**Verified:** 2026-04-01T12:00:00Z
**Status:** human_needed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Main process registers setDisplayMediaRequestHandler with audio loopback before any renderer getDisplayMedia call | VERIFIED | `main.js:752` registers handler inside `app.whenReady().then()` before `createWindow()`, with `audio: 'loopback'` at line 758 |
| 2 | MacSckSystemAudioLoopbackOverride Chromium flag is set before app.whenReady() | VERIFIED | `main.js:12` sets flag at module scope; `app.whenReady()` at line 744 -- flag is 732 lines before ready |
| 3 | Renderer can query screen recording permission status via IPC | VERIFIED | `preload.js:43` exposes `getScreenPermissionStatus`, `main.js:606-611` handles IPC returning `{status, denialCount}` |
| 4 | Screen recording permission denial count persists across app relaunches | VERIFIED | `main.js:532-547` implements `getScreenDenialPath`, `loadScreenDenialCount`, `saveScreenDenialCount` using JSON file in userData |
| 5 | Recording captures system audio mixed with microphone in all audio-enabled modes | VERIFIED | `App.jsx:752-804` uses `getDisplayMedia` for system audio, `getUserMedia` for mic, Web Audio API `createMediaStreamDestination` for mixing at line 790 |
| 6 | Recording is blocked with a clear error when screen recording permission is denied | VERIFIED | `App.jsx:437-439` checks status denied/restricted, calls `recordScreenDenial()`, throws `screenPermissionDenied` message |
| 7 | After two denials, the app stops re-prompting and directs user to System Settings | VERIFIED | `App.jsx:433-434` checks `denialCount >= 2` and throws `screenPermissionBlocked` containing "Open System Settings" text |
| 8 | All media streams and AudioContext are cleaned up when recording stops | VERIFIED | `App.jsx:277-293` `stopMediaStream` stops `displayStreamRef` tracks, closes `audioContextRef`, stops `mediaStreamRef` tracks |
| 9 | Video modes include camera video track with mixed audio | VERIFIED | `App.jsx:795-800` builds `finalStream` with `micStream.getVideoTracks()` + `dest.stream.getAudioTracks()` for video+audio mode |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/desktop/src/main/main.js` | Chromium flag, display media handler, screen permission IPC, denial persistence | VERIFIED | All four capabilities present and wired. Flag at line 12, handler at 752, IPC at 606-618, persistence at 532-547 |
| `apps/desktop/src/main/preload.js` | IPC bridge for screen permission status and denial count | VERIFIED | `getScreenPermissionStatus` at line 43, `recordScreenDenial` at line 44, both inside `contextBridge.exposeInMainWorld` |
| `apps/desktop/src/renderer/App.jsx` | Mixed stream recording flow with permission gating and cleanup | VERIFIED | getDisplayMedia call at 756, Web Audio mixing at 780-792, permission gating at 426-459, cleanup at 277-293 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `preload.js` | `main.js` | IPC `media:get-screen-status` | WIRED | preload.js:43 invokes, main.js:606 handles |
| `preload.js` | `main.js` | IPC `media:record-screen-denial` | WIRED | preload.js:44 invokes, main.js:613 handles |
| `App.jsx` | `main.js` | `getDisplayMedia` triggers `setDisplayMediaRequestHandler` | WIRED | App.jsx:756 calls getDisplayMedia, main.js:752 handles with loopback |
| `App.jsx` | `preload.js` | `client.getScreenPermissionStatus()` | WIRED | App.jsx:431 calls via client, preload.js:43 bridges to IPC |
| `App.jsx` | `AudioContext destination` | Web Audio API stream mixing | WIRED | App.jsx:790 creates destination, 791-792 connects both sources |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `App.jsx` | `displayStream` | `navigator.mediaDevices.getDisplayMedia` | Yes (Electron handler returns loopback audio) | FLOWING |
| `App.jsx` | `{status, denialCount}` | `client.getScreenPermissionStatus()` | Yes (IPC to main process, reads from system + JSON file) | FLOWING |
| `main.js` | `denialCount` | `loadScreenDenialCount()` | Yes (reads from `screen-denial.json` in userData) | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED (requires running Electron app with system audio -- cannot test media capture without a running desktop environment)

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SYSAUD-01 | 07-01, 07-02 | Not defined in REQUIREMENTS.md | NEEDS HUMAN | Requirement ID referenced in ROADMAP.md and plans but never formally defined in REQUIREMENTS.md. Implementation exists (loopback flag + display media handler). |
| SYSAUD-02 | 07-01, 07-02 | Not defined in REQUIREMENTS.md | NEEDS HUMAN | Same -- referenced but not formally defined. Implementation exists (screen permission IPC + denial persistence). |
| SYSAUD-03 | 07-01, 07-02 | Not defined in REQUIREMENTS.md | NEEDS HUMAN | Same -- referenced but not formally defined. Implementation exists (mixed audio recording flow). |
| SYSAUD-04 | 07-02 | Not defined in REQUIREMENTS.md | NEEDS HUMAN | Same -- referenced but not formally defined. Implementation exists (permission gating with denial tracking). |

**Note:** All four SYSAUD requirement IDs are referenced in ROADMAP.md Phase 7 and in plan frontmatter, but none are defined in REQUIREMENTS.md. The traceability table in REQUIREMENTS.md has no entries for Phase 7 or any SYSAUD IDs. This is a documentation gap -- the implementations exist and match the phase goal, but the formal requirement definitions and traceability mapping are missing.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | - | - | - | No anti-patterns found in any modified file |

### Human Verification Required

### 1. Mixed Audio Recording (Audio Mode)

**Test:** Start the app in dev mode, play system audio (YouTube/music), select Audio mode, click Record, speak into microphone for 10-15 seconds, stop, review playback.
**Expected:** Recording playback contains both system audio and microphone voice mixed together.
**Why human:** Cannot verify actual audio content programmatically -- requires listening to recording output.

### 2. Mixed Audio Recording (Video + Audio Mode)

**Test:** Select Video + Audio mode, record with system audio playing and speaking into mic.
**Expected:** Recording plays back with camera video, system audio, and microphone audio all present.
**Why human:** Requires running Electron app with camera and audio hardware.

### 3. Permission Denial Flow

**Test:** Deny screen recording permission twice in sequence, then attempt to record again.
**Expected:** After two denials, the error message shows the "blocked" copy directing user to System Settings. No further macOS prompts appear.
**Why human:** Requires interacting with macOS permission dialog which cannot be automated.

### 4. Video-Only Mode (No Screen Permission)

**Test:** Select Video mode (no audio), click Record.
**Expected:** Recording starts immediately using only camera -- no screen recording permission prompt appears.
**Why human:** Requires running app to confirm permission flow difference.

### Gaps Summary

No code gaps found. All must-have truths from both plans (07-01 and 07-02) are verified in the codebase. The three key files (main.js, preload.js, App.jsx) contain all expected functionality: Chromium loopback flag, display media handler, screen permission IPC with denial persistence, mixed audio recording via Web Audio API, permission gating with three-state error messages, and proper stream/AudioContext cleanup.

The only documentation gap is that SYSAUD-01 through SYSAUD-04 requirement IDs are referenced in ROADMAP.md and plan frontmatter but are not formally defined in REQUIREMENTS.md, and the traceability table has no Phase 7 entries.

All three commits (2ac29b4, 8cc3d78, 8527c5e) exist in git history and match their summary descriptions.

---

_Verified: 2026-04-01T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
