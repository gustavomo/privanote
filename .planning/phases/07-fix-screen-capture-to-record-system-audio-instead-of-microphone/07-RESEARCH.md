# Phase 7: Fix screen capture to record system audio instead of microphone - Research

**Researched:** 2026-04-01
**Domain:** Electron system audio capture (loopback) + stream mixing
**Confidence:** MEDIUM

## Summary

This phase replaces the sidebar capture panel's microphone-only recording with a mixed stream that includes both system audio (loopback) and microphone input. The approach uses Electron's `setDisplayMediaRequestHandler` with `audio: 'loopback'` to obtain system audio via `getDisplayMedia`, then mixes it with a `getUserMedia` microphone stream using the Web Audio API's `AudioContext`.

Electron 28 (Chromium 120) supports `setDisplayMediaRequestHandler` (added in Electron 22). On macOS 13+, the `MacSckSystemAudioLoopbackOverride` Chromium feature flag must be enabled via `app.commandLine.appendSwitch` before the app is ready for ScreenCaptureKit-based loopback to work. The main process needs the handler registered, and the renderer calls `getDisplayMedia({ audio: true, video: false })` (or with a minimal video constraint) to get the system audio track, then merges it with the microphone track from `getUserMedia`.

The existing `setPermissionRequestHandler` in main.js already allows `'screen'` permission. Screen recording permission on macOS is checked via `systemPreferences.getMediaAccessStatus('screen')`, which is already used in `screen-capture.js`. The `MediaRecorder` is already in use -- it just needs to receive the merged stream instead of the single-source `getUserMedia` stream.

**Primary recommendation:** Use `setDisplayMediaRequestHandler` with `audio: 'loopback'` in the main process, enable `MacSckSystemAudioLoopbackOverride` flag, obtain system audio via `getDisplayMedia` in renderer, mix with `getUserMedia` microphone via Web Audio API `AudioContext`, and feed the mixed `MediaStreamDestination.stream` to the existing `MediaRecorder`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: System audio and microphone are captured together as a mixed stream -- not one or the other
- D-02: This applies to the sidebar capture panel recording only (App.jsx), NOT the floating button external capture (Phase 6)
- D-03: All capture modes (Audio, Video, Video+Audio) get the mixed system audio + microphone when audio is enabled
- D-04: No additional UI indicator for system audio capture -- the interface stays unchanged
- D-05: Use Electron's desktopCapturer to obtain a screen source ID, then getDisplayMedia with audio: true to capture system audio
- D-06: macOS 13+ (Ventura) is required for system audio capture -- no support for older macOS versions needed
- D-07: The microphone stream (getUserMedia) is mixed with the system audio stream (getDisplayMedia) into a single recording
- D-08: System audio capture starts automatically when the user clicks Record -- no separate toggle or opt-in step
- D-09: Screen recording permission prompt appears on first recording attempt, not at app launch. macOS remembers the grant for future sessions
- D-10: Recording is BLOCKED if system audio permission is not granted -- the app does not fall back to microphone-only
- D-11: If permission is denied on first attempt, the app re-prompts once on the next recording attempt, then stops asking
- D-12: After two denials, the user must grant screen recording permission via macOS System Settings to use recording

### Claude's Discretion
- How to merge the two audio streams (Web Audio API AudioContext mixer vs MediaStream track combination)
- Exact error message wording when permission is blocked
- Whether to use desktopCapturer.getSources or direct getDisplayMedia constraints for the screen source

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Electron | 28.3.3 | Desktop shell, desktopCapturer, session API | Already in use; supports setDisplayMediaRequestHandler (added v22) |
| Web Audio API | Browser built-in | Mix microphone + system audio streams | Standard browser API, no dependency needed |
| MediaRecorder | Browser built-in | Record mixed stream to blob | Already used in App.jsx |

### No New Dependencies Needed

The entire implementation uses Electron/Chromium built-in APIs. No external packages are required.

**Alternatives Considered:**
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual flag + setDisplayMediaRequestHandler | electron-audio-loopback npm package | Adds native dependency, overkill for single-platform macOS use case |
| Web Audio API AudioContext mixer | Combining MediaStream tracks directly | Track combination doesn't actually mix audio -- it just carries both tracks separately; Web Audio API is the correct approach for actual mixing |

## Architecture Patterns

### Integration Points in Existing Code

The changes touch three files:

1. **`apps/desktop/src/main/main.js`** -- Register `setDisplayMediaRequestHandler`, enable Chromium flag, add screen permission IPC handler
2. **`apps/desktop/src/renderer/App.jsx`** -- Replace `getUserMedia`-only recording flow with `getDisplayMedia` + `getUserMedia` + Web Audio mixer
3. **`apps/desktop/src/main/preload.js`** -- Expose new IPC channel for screen permission status (if needed)

### Pattern 1: Main Process -- Display Media Request Handler

**What:** Register a handler that automatically grants loopback audio access when the renderer calls `getDisplayMedia`.
**When to use:** Before any recording attempt, at app startup.

```javascript
// In main.js, inside app.whenReady().then(...)
// BEFORE app.whenReady():
app.commandLine.appendSwitch('enable-features', 'MacSckSystemAudioLoopbackOverride');

// INSIDE app.whenReady():
session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
  desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
    // Pass the first screen source for video (even if we only want audio,
    // getDisplayMedia requires a video source in the callback)
    callback({ video: sources[0], audio: 'loopback' });
  });
});
```

Source: [Electron desktopCapturer docs](https://www.electronjs.org/docs/latest/api/desktop-capturer)

### Pattern 2: Renderer -- Stream Acquisition and Mixing

**What:** Get system audio via `getDisplayMedia`, microphone via `getUserMedia`, mix with Web Audio API.
**When to use:** Inside `handleStartRecording()` in App.jsx.

```javascript
// 1. Get system audio stream (triggers setDisplayMediaRequestHandler in main)
const displayStream = await navigator.mediaDevices.getDisplayMedia({
  audio: true,
  video: { width: 1, height: 1 } // minimal video -- we only want audio
});

// 2. Get microphone stream
const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

// 3. Mix both audio streams via Web Audio API
const audioContext = new AudioContext();
const systemSource = audioContext.createMediaStreamSource(displayStream);
const micSource = audioContext.createMediaStreamSource(micStream);
const destination = audioContext.createMediaStreamDestination();

systemSource.connect(destination);
micSource.connect(destination);

// 4. Build final stream for MediaRecorder
// destination.stream contains the mixed audio
const mixedStream = destination.stream;

// 5. If video mode, add video track from getUserMedia
// For audio-only mode, use mixedStream directly
const recorder = new MediaRecorder(mixedStream, { mimeType });
```

Source: [MDN AudioContext.createMediaStreamSource](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/createMediaStreamSource), [MDN AudioContext.createMediaStreamDestination](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/createMediaStreamDestination)

### Pattern 3: Permission Flow

**What:** Check screen recording permission before attempting capture; block recording if denied.
**When to use:** In `ensureCapturePermissions()` before starting recording.

```javascript
// Screen permission check uses same API already in screen-capture.js
const screenStatus = systemPreferences.getMediaAccessStatus('screen');
// Returns: 'not-determined' | 'granted' | 'denied' | 'restricted'
```

The existing `resolveMediaAccessStatus()` in main.js only handles 'camera' and 'microphone'. It needs to be extended to also handle 'screen', OR a separate IPC handler should be added.

### Pattern 4: Cleanup on Stop

**What:** Close the AudioContext and stop all stream tracks when recording stops.
**When to use:** In the recorder 'stop' event and in `stopMediaStream()`.

```javascript
// Stop all tracks from both streams
displayStream.getTracks().forEach(track => track.stop());
micStream.getTracks().forEach(track => track.stop());
// Close the AudioContext
audioContext.close();
```

### Anti-Patterns to Avoid
- **Combining tracks without mixing:** Adding both audio tracks to a single MediaStream does NOT mix them -- the MediaRecorder picks only one track. Must use Web Audio API for actual audio mixing.
- **Requesting getDisplayMedia with video: false:** On macOS with setDisplayMediaRequestHandler, `video: false` may cause the handler to not fire. Use a minimal video constraint `{ width: 1, height: 1 }` then discard the video track.
- **Calling getDisplayMedia before setDisplayMediaRequestHandler is registered:** The handler must be set up in main process before any renderer getDisplayMedia call.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Audio stream mixing | Manual PCM buffer manipulation | Web Audio API AudioContext | Handles sample rate conversion, buffering, timing automatically |
| Screen permission prompt | Custom dialog for permission | macOS system prompt via getDisplayMedia | System manages the permission lifecycle; trying to replicate causes issues |
| Loopback audio capture | Kernel extension or native module | Chromium's built-in ScreenCaptureKit integration | Signed kernel extensions are impractical; Chromium already wraps macOS APIs |

## Common Pitfalls

### Pitfall 1: Chromium Flag Must Be Set Before App Ready
**What goes wrong:** Loopback audio returns an ended/silent track.
**Why it happens:** `app.commandLine.appendSwitch('enable-features', 'MacSckSystemAudioLoopbackOverride')` must be called before `app.whenReady()`. If called after, the Chromium feature is not activated.
**How to avoid:** Place the `appendSwitch` call at module scope in main.js, before any `app.whenReady()` block.
**Warning signs:** Audio track has `readyState === 'ended'` immediately after acquisition.

### Pitfall 2: getDisplayMedia Requires Video Source in Handler Callback
**What goes wrong:** `setDisplayMediaRequestHandler` callback errors or returns no stream.
**Why it happens:** The callback expects both `video` and `audio` properties. Even for audio-only capture, a video source must be provided.
**How to avoid:** Always pass `{ video: sources[0], audio: 'loopback' }` in the callback. In the renderer, request with a minimal video constraint then discard the video track.
**Warning signs:** DOMException when calling getDisplayMedia.

### Pitfall 3: AudioContext Sample Rate Mismatch
**What goes wrong:** Mixed audio sounds distorted or one source is silent.
**Why it happens:** System audio and microphone may have different sample rates. The default AudioContext sample rate may not match either.
**How to avoid:** Let the AudioContext use the default sample rate -- it handles resampling internally. Do not manually specify `sampleRate` in the constructor unless there is a specific reason.
**Warning signs:** One stream audible, the other silent or garbled.

### Pitfall 4: Not Stopping Display Stream Tracks on Recording Stop
**What goes wrong:** macOS screen recording indicator stays active after recording ends; system audio continues to be captured.
**Why it happens:** `getDisplayMedia` tracks are not automatically stopped when `MediaRecorder.stop()` is called.
**How to avoid:** In the stop handler, explicitly call `.stop()` on every track of the display stream and close the AudioContext.
**Warning signs:** macOS menu bar still shows recording indicator after user stops.

### Pitfall 5: Permission Denial Counter Not Persisted
**What goes wrong:** App re-prompts on every launch despite user denying twice.
**Why it happens:** D-11/D-12 require tracking denial count, but if stored only in memory it resets each session.
**How to avoid:** Store the denial count in a simple file in `userData` (like the whitelist pattern already used) or in Electron's `electron-store`/`fs.writeFileSync` pattern.
**Warning signs:** User keeps getting prompted after explicitly denying.

### Pitfall 6: Video Capture Modes Need Both Camera and Mixed Audio
**What goes wrong:** Video mode records camera but loses system audio, or records system audio but loses camera.
**Why it happens:** When capture mode is 'video' or 'video-with-audio', the current code uses a single `getUserMedia` call. The new flow must combine camera video track + mixed audio stream.
**How to avoid:** For video modes: get camera via `getUserMedia({ video: true })`, get mic via `getUserMedia({ audio: true })`, get system audio via `getDisplayMedia`, mix audio streams, then combine the camera video track with the mixed audio into a single MediaStream for the recorder.
**Warning signs:** Video recording has no audio, or audio recording has unexpected video.

### Pitfall 7: setPermissionRequestHandler Must Allow 'screen'
**What goes wrong:** getDisplayMedia is blocked by Electron permission handler.
**Why it happens:** The existing handler allows 'media' and 'screen', which should cover it. But verify the permission string matches what getDisplayMedia triggers.
**How to avoid:** The existing handler `callback(permission === 'media' || permission === 'screen')` already covers this. Confirm during testing.
**Warning signs:** getDisplayMedia throws a permission error despite macOS granting screen recording.

## Code Examples

### Complete Recording Flow (Audio-Only Mode)

```javascript
// Source: Electron docs + MDN Web Audio API

async function startMixedRecording() {
  // 1. Get system audio via getDisplayMedia
  //    This triggers setDisplayMediaRequestHandler in main process
  const displayStream = await navigator.mediaDevices.getDisplayMedia({
    audio: true,
    video: { width: 1, height: 1 }
  });

  // 2. Get microphone
  const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

  // 3. Mix via Web Audio API
  const audioCtx = new AudioContext();
  const systemSource = audioCtx.createMediaStreamSource(displayStream);
  const micSource = audioCtx.createMediaStreamSource(micStream);
  const dest = audioCtx.createMediaStreamDestination();

  systemSource.connect(dest);
  micSource.connect(dest);

  // 4. For audio-only: record the mixed stream
  const recorder = new MediaRecorder(dest.stream, { mimeType: 'audio/webm;codecs=opus' });

  // 5. Cleanup function
  function cleanup() {
    displayStream.getTracks().forEach(t => t.stop());
    micStream.getTracks().forEach(t => t.stop());
    audioCtx.close();
  }

  return { recorder, cleanup, audioCtx };
}
```

### Complete Recording Flow (Video + Audio Mode)

```javascript
async function startVideoWithMixedAudio() {
  // 1. System audio
  const displayStream = await navigator.mediaDevices.getDisplayMedia({
    audio: true,
    video: { width: 1, height: 1 }
  });

  // 2. Camera + Microphone
  const camMicStream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: true
  });

  // 3. Mix audio
  const audioCtx = new AudioContext();
  const systemSource = audioCtx.createMediaStreamSource(displayStream);
  const micSource = audioCtx.createMediaStreamSource(
    new MediaStream([camMicStream.getAudioTracks()[0]])
  );
  const dest = audioCtx.createMediaStreamDestination();
  systemSource.connect(dest);
  micSource.connect(dest);

  // 4. Combine camera video track + mixed audio
  const finalStream = new MediaStream([
    camMicStream.getVideoTracks()[0],    // camera video
    ...dest.stream.getAudioTracks()       // mixed audio
  ]);

  const recorder = new MediaRecorder(finalStream, {
    mimeType: 'video/webm;codecs=vp9,opus'
  });

  function cleanup() {
    displayStream.getTracks().forEach(t => t.stop());
    camMicStream.getTracks().forEach(t => t.stop());
    audioCtx.close();
  }

  return { recorder, cleanup };
}
```

### Main Process Setup

```javascript
// At module scope in main.js (BEFORE app.whenReady)
app.commandLine.appendSwitch('enable-features', 'MacSckSystemAudioLoopbackOverride');

// Inside app.whenReady().then(...)
const { desktopCapturer, session } = require('electron');

session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
  desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
    if (sources.length === 0) {
      callback(null); // deny if no screen sources
      return;
    }
    callback({ video: sources[0], audio: 'loopback' });
  }).catch(() => {
    callback(null);
  });
});
```

### Screen Permission IPC Handler

```javascript
// In main.js registerIpcHandlers()
ipcMain.handle('media:get-screen-status', () => {
  return checkScreenPermission(); // already exists in screen-capture.js
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| getUserMedia for mic only | getDisplayMedia + getUserMedia + Web Audio mixing | macOS 13+ / Electron 22+ | System audio capture possible without kernel extensions |
| desktopCapturer.getSources for audio | setDisplayMediaRequestHandler with audio: 'loopback' | Electron 22 | Cleaner API, no manual source ID plumbing |
| No macOS system audio | ScreenCaptureKit integration in Chromium | macOS 13.0 (2022) | macOS finally allows app-level audio capture |

## Open Questions

1. **getDisplayMedia with video: false behavior in Electron 28**
   - What we know: Some Electron versions require a video source in the handler callback
   - What's unclear: Whether Electron 28 specifically requires `video: { width: 1, height: 1 }` or if `video: false` works
   - Recommendation: Test with minimal video constraint first; if it works with `video: false`, simplify

2. **Denial count persistence mechanism**
   - What we know: D-11/D-12 require tracking permission denial count across sessions
   - What's unclear: Best storage -- simple JSON file vs extending existing settings
   - Recommendation: Use simple JSON file in userData (matching the capture-apps.json pattern already established in Phase 8)

3. **MacSckSystemAudioLoopbackOverride flag availability in Chromium 120**
   - What we know: The flag exists in recent Chromium; Electron 28 uses Chromium 120
   - What's unclear: Whether Chromium 120 specifically includes this flag (it was present in Chromium ~118+)
   - Recommendation: Test at implementation time; if the flag is not recognized, try without it (macOS 13.2+ may enable loopback by default in newer Chromium)

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Electron | System audio capture | Yes | 28.3.3 | -- |
| macOS 13+ (Ventura) | ScreenCaptureKit loopback | Assumed (D-06) | -- | None -- required per D-06 |
| Web Audio API | Stream mixing | Yes (Chromium built-in) | -- | -- |
| Screen Recording permission | getDisplayMedia | OS-managed | -- | Recording blocked per D-10 |

**Missing dependencies with no fallback:**
- None -- all dependencies are met by the existing Electron 28 + macOS 13+ stack

## Sources

### Primary (HIGH confidence)
- [Electron desktopCapturer docs](https://www.electronjs.org/docs/latest/api/desktop-capturer) - setDisplayMediaRequestHandler, loopback audio callback
- [MDN AudioContext.createMediaStreamSource](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/createMediaStreamSource) - Web Audio stream mixing
- [MDN AudioContext.createMediaStreamDestination](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/createMediaStreamDestination) - Mixed stream output

### Secondary (MEDIUM confidence)
- [Electron PR #47493](https://github.com/electron/electron/pull/47493) - Loopback flag documentation, macOS version matrix
- [Electron issue #42605](https://github.com/electron/electron/issues/42605) - MacLoopbackAudioForScreenShare flag discussion, working examples
- [Alec Armbruster blog post](https://alec.is/posts/bringing-system-audio-loopback-to-electron/) - Flag names and macOS requirements
- [electron-audio-loopback repo](https://github.com/alectrocute/electron-audio-loopback) - Reference implementation

### Tertiary (LOW confidence)
- [Electron issue #49607](https://github.com/electron/electron/issues/49607) - Desktop audio capture broken in newer Electron versions (v40+); not relevant to Electron 28 but shows version sensitivity
- [Strongly Typed article](https://stronglytyped.uk/articles/recording-system-audio-electron-macos-approaches) - General approaches overview

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Uses only built-in Electron/Chromium/Web APIs already in the project
- Architecture: MEDIUM - The setDisplayMediaRequestHandler + Web Audio mixing pattern is well-documented but Electron 28 specifically needs runtime validation of the Chromium flag
- Pitfalls: HIGH - Common failure modes are well-documented across Electron issues and blog posts

**Research date:** 2026-04-01
**Valid until:** 2026-05-01 (stable -- Electron 28 is a fixed target)
