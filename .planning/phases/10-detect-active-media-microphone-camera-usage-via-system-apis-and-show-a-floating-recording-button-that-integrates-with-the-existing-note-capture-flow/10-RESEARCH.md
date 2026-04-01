# Phase 10: Detect Active Media and Show Floating Recording Button - Research

**Researched:** 2026-04-01
**Domain:** macOS system APIs for mic/camera detection, Electron overlay integration, CoreAudio/CMIO frameworks
**Confidence:** MEDIUM-HIGH

## Summary

Phase 10 adds a conditional third button to the floating overlay that appears when an external app is actively using the microphone or camera. The button triggers the existing mixed audio recording flow (system audio + mic via `getDisplayMedia` loopback) and auto-creates a note titled with the detected source app name.

The core technical challenge is detecting mic/camera usage by other apps on macOS. There is no single high-level public API for this. The proven approach uses two low-level frameworks: **CoreAudio** (`kAudioDevicePropertyDeviceIsRunningSomewhere`) for microphone input devices and **CoreMediaIO** (`kCMIODevicePropertyDeviceIsRunningSomewhere`) for camera devices. Both are C-level APIs best accessed from an Objective-C native helper binary, following the established `ax_walker` pattern in this project. Identifying which specific app is using the mic/camera requires process list inspection via `NSWorkspace` cross-referenced with known call app bundle IDs.

**Primary recommendation:** Build a single Objective-C native binary (`media_detector`) that checks both mic and camera device activity using CoreAudio/CMIO, identifies the responsible app via process enumeration, and outputs JSON. Call it from the existing polling loop via `execFile`, following the `ax_walker.m` pattern exactly.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Detect active mic/camera usage via the macOS system indicator (orange dot = mic, green dot = camera) using accessibility or ScreenCaptureKit APIs
- **D-02:** Cover both microphone and camera -- trigger when either is active
- **D-03:** Poll every 2-3 seconds, piggyback on the existing app-detector polling interval
- **D-04:** Ignore Privanote's own mic/camera usage -- only trigger when another app is using media
- **D-05:** Auto-show a recording button on the overlay when a call is detected. No notification or confirmation step.
- **D-06:** One tap starts recording immediately. Consistent with existing capture button.
- **D-07:** When the external call ends while Privanote is recording, keep recording but notify the user that the call ended. User stops manually.
- **D-08:** Third button on the existing overlay, shown conditionally only when a call is detected. Overlay goes from 2 to 3 buttons during calls, back to 2 when call ends.
- **D-09:** Headphone/call icon to distinguish from the existing screen-capture button.
- **D-10:** Detect which app is using the mic/camera and show the app name on the button (tooltip or label). E.g., "Record Zoom call".
- **D-11:** Same behavior for all detected call apps -- no per-app customization.
- **D-12:** Auto-title notes with source app: "Zoom call -- Apr 1, 2:30 PM". Tag with source app name in metadata.

### Claude's Discretion
- Exact API approach for reading macOS mic/camera indicator state (accessibility API, CoreAudio tap, or ScreenCaptureKit)
- Animation/transition when the third button appears/disappears on the overlay
- How to identify the specific app using the mic (process list inspection, window ownership)
- Notification style when call ends during recording (inline toast, overlay change, etc.)

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

## Standard Stack

### Core
| Library/Framework | Version | Purpose | Why Standard |
|-------------------|---------|---------|--------------|
| CoreAudio (C framework) | macOS system | Detect microphone input device activity | `kAudioDevicePropertyDeviceIsRunningSomewhere` is the only reliable system-wide mic activity check |
| CoreMediaIO (C framework) | macOS system | Detect camera device activity | `kCMIODevicePropertyDeviceIsRunningSomewhere` is the proven camera activity check |
| Foundation/AppKit | macOS system | Process enumeration for app identification | `NSWorkspace.runningApplications` to map PIDs to app names/bundleIds |
| Electron 28.3.3 | 28.3.3 | Desktop shell, IPC, overlay BrowserWindow | Already installed, overlay infrastructure exists |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| child_process (Node built-in) | N/A | Execute native `media_detector` binary | Same pattern as `ax_walker` -- `execFile` from polling loop |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native Obj-C binary | `log stream` TCC parsing | 1-2s delay, unreliable, requires sudo for some log sources |
| Native Obj-C binary | `lsof` grep for coreaudio | Unreliable, macOS version dependent, no camera coverage |
| CoreAudio/CMIO | ScreenCaptureKit | SCK is for capturing, not detecting usage by other apps |

**No npm install needed** -- this phase uses only macOS system frameworks and existing project dependencies.

## Architecture Patterns

### Recommended Project Structure
```
apps/desktop/src/main/
  native/
    ax_walker.m          # existing -- AX text extraction
    media_detector.m     # NEW -- mic/camera activity + app identification
  media-detector.js      # NEW -- Node wrapper, execFile, JSON parsing
  app-detector.js        # MODIFY -- integrate media detection into polling
  main.js               # MODIFY -- IPC handlers, overlay resize, recording flow
  preload-capture.js    # MODIFY -- expose media detection + call recording IPC
apps/desktop/src/renderer/
  capture-overlay/
    capture-overlay.html # MODIFY -- add conditional third button
```

### Pattern 1: Native Binary with JSON Output (established)
**What:** Compile an Objective-C binary that queries system APIs and outputs JSON to stdout. Node.js calls it via `execFile` and parses the result.
**When to use:** When accessing macOS-only C/Objective-C frameworks from Electron's main process.
**Example:**
```objective-c
// media_detector.m -- follows ax_walker.m pattern
#import <Foundation/Foundation.h>
#import <CoreAudio/CoreAudio.h>
#import <CoreMediaIO/CMIOHardware.h>
#import <AppKit/AppKit.h>

// Output format:
// { "micActive": true, "cameraActive": false, "appName": "Zoom", "bundleId": "us.zoom.xos", "pid": 12345 }
```

### Pattern 2: Polling Integration (established)
**What:** The existing `startAppDetection()` in main.js polls at 500ms. Media detection should piggyback on a separate or adjusted interval.
**When to use:** Decisions D-03 says poll every 2-3 seconds. Since app detection polls at 500ms, media detection should run at a lower frequency (every 4th-6th cycle, or on its own 2.5s interval).
**Example:**
```javascript
// media-detector.js
const { execFile } = require('child_process');
const path = require('path');

const MEDIA_DETECTOR_PATH = path.join(__dirname, 'native', 'media_detector');
const TIMEOUT_MS = 3000;
const SELF_BUNDLE_ID = 'com.privanote.desktop';

function detectActiveMedia() {
  return new Promise((resolve) => {
    execFile(MEDIA_DETECTOR_PATH, [], { timeout: TIMEOUT_MS }, (error, stdout) => {
      if (error) {
        resolve({ active: false });
        return;
      }
      try {
        const result = JSON.parse(stdout.trim());
        // D-04: Filter out Privanote's own usage
        if (result.bundleId === SELF_BUNDLE_ID || result.appName === 'Electron') {
          resolve({ active: false });
          return;
        }
        resolve(result);
      } catch {
        resolve({ active: false });
      }
    });
  });
}
```

### Pattern 3: Conditional Overlay Button (from UI-SPEC)
**What:** Third button added/removed from overlay HTML based on IPC messages from main process. Overlay BrowserWindow resizes dynamically.
**When to use:** When media detection state changes.
**Example:**
```javascript
// In main.js -- overlay resize when media state changes
function updateOverlayForMedia(mediaActive) {
  if (!captureOverlay || captureOverlay.isDestroyed()) return;
  const height = mediaActive ? 208 : 136; // 3 buttons vs 2
  captureOverlay.setSize(64, height);
  captureOverlay.webContents.send(
    mediaActive ? 'media:detected' : 'media:ended',
    mediaActive ? { appName: mediaState.appName } : {}
  );
}
```

### Pattern 4: Recording Flow Reuse
**What:** Call recording uses the exact same mixed audio flow as the sidebar capture (`getDisplayMedia` loopback + `getUserMedia` mic via Web Audio API). The main process triggers this via IPC to the main window renderer.
**When to use:** When user taps the call recording button.
**Critical detail:** The overlay is a separate BrowserWindow from the main window. The overlay sends IPC to main process, which then forwards to the main window's renderer to start the actual recording using the existing `handleStartRecording` flow.

### Anti-Patterns to Avoid
- **Polling too fast with native binary:** execFile spawns a process each time. 500ms would be excessive. 2-3 seconds (D-03) is appropriate.
- **Trying to use ScreenCaptureKit for detection:** SCK is for capturing content, not for detecting if other apps are capturing. The orange/green dot APIs are internal to macOS Control Center, not exposed publicly.
- **Modifying the overlay preload to access system APIs directly:** The overlay runs in a sandboxed renderer. All native detection must happen in the main process.
- **Using `kAudioDevicePropertyDeviceIsRunning` instead of `kAudioDevicePropertyDeviceIsRunningSomewhere`:** The "Somewhere" variant checks system-wide, not just the calling process.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Mic activity detection | Custom TCC log parser | CoreAudio `kAudioDevicePropertyDeviceIsRunningSomewhere` | TCC logs are unreliable, version-dependent, may require elevated privileges |
| Camera activity detection | lsof/fuser grep | CMIO `kCMIODevicePropertyDeviceIsRunningSomewhere` | Proven API, used by Sindresorhus `is-camera-on` and OverSight |
| Process identification | ps/lsof parsing | `NSWorkspace.sharedWorkspace.runningApplications` | Gives bundleId, localizedName, PID directly |
| Mixed audio recording | New recording pipeline | Existing `handleStartRecording` in App.jsx | Phase 7 already built the complete loopback + mic mixing flow |
| Note creation from recording | New note creation flow | Existing `proxyBackendRequest` + `createNode` | Same pattern as `createNoteFromSession` and `createNoteFromClipboard` |

**Key insight:** The recording infrastructure is already fully built. This phase is primarily about detection (new native binary) and UI integration (overlay third button + IPC wiring). The recording flow is reused wholesale.

## Common Pitfalls

### Pitfall 1: Detecting Privanote's Own Mic Usage
**What goes wrong:** When the user starts recording, Privanote itself uses the microphone. The detector would see this and keep showing the call button.
**Why it happens:** `kAudioDevicePropertyDeviceIsRunningSomewhere` returns true for ANY process using the device.
**How to avoid:** The native binary must enumerate processes using the audio device and exclude Privanote's own PID/bundleId. Pass the current PID as an argument to the binary, or hardcode the bundle ID filter.
**Warning signs:** Call button appears when user starts any recording, even without an external call.

### Pitfall 2: Multiple Apps Using Mic Simultaneously
**What goes wrong:** User has Zoom AND Slack both accessing mic. Which app name to show?
**Why it happens:** Multiple processes can have an audio session open.
**How to avoid:** Pick the most recently started one, or the one with the longest-running audio session. For v1, showing the first non-Privanote app found is acceptable.
**Warning signs:** App name flickers between different apps.

### Pitfall 3: Overlay Resize Without Position Shift
**What goes wrong:** When overlay grows from 136px to 208px, the BrowserWindow may shift its position if the OS repositions based on the new size.
**How to avoid:** Use `captureOverlay.setBounds({ x, y, width: 64, height: newHeight })` with explicit position preservation. Read current bounds first, keep x/y, only change height.
**Warning signs:** Overlay jumps when call is detected.

### Pitfall 4: Race Between Call End and Recording Stop
**What goes wrong:** External call ends (media detection returns false), recording is still active. If we remove the button, user cannot stop recording.
**Why it happens:** D-07 says "keep recording but notify user that call ended."
**How to avoid:** Track recording state separately from media detection state. Button remains visible (amber state per UI-SPEC) until recording is finalized. Only remove button when both conditions are false: no active media AND no active call recording.
**Warning signs:** Button disappears while recording is still active, user has no way to stop it.

### Pitfall 5: Overlay Recording vs Sidebar Recording Conflict
**What goes wrong:** User starts a call recording from overlay, then also tries to start a sidebar recording (or vice versa).
**Why it happens:** Both use the same underlying `getDisplayMedia` + Web Audio flow, but only one display media session can be active.
**How to avoid:** Track call recording as a separate state flag. When call recording is active, disable or prevent sidebar recording start (and vice versa). Show appropriate feedback.
**Warning signs:** One recording silently fails or overwrites the other.

### Pitfall 6: Native Binary Compilation
**What goes wrong:** `media_detector.m` needs to be compiled with proper framework linkages.
**Why it happens:** Objective-C files need specific compiler flags for CoreAudio, CoreMediaIO, and AppKit frameworks.
**How to avoid:** Follow the exact compilation pattern used for `ax_walker`:
```bash
clang -framework Foundation -framework CoreAudio -framework CoreMediaIO -framework AppKit \
  -o media_detector media_detector.m
```
Compile and commit the binary. The project already ships `ax_walker` as a precompiled binary.
**Warning signs:** Binary fails to link or crashes at runtime.

### Pitfall 7: Camera Detection Requires Entitlement on macOS 12+
**What goes wrong:** CMIO camera enumeration may return empty results without proper entitlements.
**Why it happens:** macOS tightened camera access. However, checking `kCMIODevicePropertyDeviceIsRunningSomewhere` is a read-only property query, not a capture operation. It should work without camera access entitlement.
**How to avoid:** Test thoroughly. If CMIO fails, fall back to checking if known camera-using processes are running (less precise but functional).
**Warning signs:** Camera detection always returns false.

## Code Examples

### Native Binary: media_detector.m (Core Implementation Pattern)
```objective-c
// Source: CoreAudio AudioHardware.h, CoreMediaIO CMIOHardware.h
#import <Foundation/Foundation.h>
#import <CoreAudio/CoreAudio.h>
#import <CoreMediaIO/CMIOHardware.h>
#import <AppKit/AppKit.h>

// Check if any audio input device is running system-wide
BOOL isMicrophoneActive(void) {
    AudioObjectPropertyAddress prop = {
        kAudioHardwarePropertyDevices,
        kAudioObjectPropertyScopeGlobal,
        kAudioObjectPropertyElementMain
    };
    UInt32 dataSize = 0;
    OSStatus status = AudioObjectGetPropertyDataSize(
        kAudioObjectSystemObject, &prop, 0, NULL, &dataSize
    );
    if (status != noErr) return NO;

    int deviceCount = dataSize / sizeof(AudioDeviceID);
    AudioDeviceID *devices = malloc(dataSize);
    status = AudioObjectGetPropertyData(
        kAudioObjectSystemObject, &prop, 0, NULL, &dataSize, devices
    );
    if (status != noErr) { free(devices); return NO; }

    BOOL active = NO;
    for (int i = 0; i < deviceCount; i++) {
        // Check if this device has input streams
        AudioObjectPropertyAddress streamProp = {
            kAudioDevicePropertyStreams,
            kAudioObjectPropertyScopeInput,
            kAudioObjectPropertyElementMain
        };
        UInt32 streamSize = 0;
        if (AudioObjectGetPropertyDataSize(devices[i], &streamProp, 0, NULL, &streamSize) != noErr)
            continue;
        if (streamSize == 0) continue; // Not an input device

        // Check if this input device is running somewhere
        AudioObjectPropertyAddress runningProp = {
            kAudioDevicePropertyDeviceIsRunningSomewhere,
            kAudioObjectPropertyScopeInput,
            kAudioObjectPropertyElementMain
        };
        UInt32 isRunning = 0;
        UInt32 runningSize = sizeof(isRunning);
        if (AudioObjectGetPropertyData(devices[i], &runningProp, 0, NULL, &runningSize, &isRunning) == noErr) {
            if (isRunning) { active = YES; break; }
        }
    }
    free(devices);
    return active;
}

// Check if any camera is running system-wide
BOOL isCameraActive(void) {
    CMIOObjectPropertyAddress prop = {
        kCMIOHardwarePropertyDevices,
        kCMIOObjectPropertyScopeGlobal,
        kCMIOObjectPropertyElementMain
    };
    UInt32 dataSize = 0;
    OSStatus status = CMIOObjectGetPropertyDataSize(
        kCMIOObjectSystemObject, &prop, 0, NULL, &dataSize
    );
    if (status != noErr) return NO;

    int deviceCount = dataSize / sizeof(CMIOObjectID);
    CMIOObjectID *devices = malloc(dataSize);
    UInt32 dataUsed = 0;
    status = CMIOObjectGetPropertyData(
        kCMIOObjectSystemObject, &prop, 0, NULL, dataSize, &dataUsed, devices
    );
    if (status != noErr) { free(devices); return NO; }

    BOOL active = NO;
    for (int i = 0; i < deviceCount; i++) {
        CMIOObjectPropertyAddress runningProp = {
            kCMIODevicePropertyDeviceIsRunningSomewhere,
            kCMIOObjectPropertyScopeWildcard,
            kCMIOObjectPropertyElementWildcard
        };
        UInt32 isRunning = 0;
        UInt32 runningSize = sizeof(isRunning);
        if (CMIOObjectGetPropertyData(devices[i], &runningProp, 0, NULL, runningSize, &runningSize, &isRunning) == noErr) {
            if (isRunning) { active = YES; break; }
        }
    }
    free(devices);
    return active;
}
```

### Process Identification Pattern
```objective-c
// Find which non-Privanote app is likely using mic/camera
// Uses NSWorkspace running applications cross-referenced with known call apps
NSDictionary *findMediaApp(pid_t selfPID) {
    NSArray *apps = [[NSWorkspace sharedWorkspace] runningApplications];
    // Known call/meeting app bundle IDs
    NSSet *callApps = [NSSet setWithObjects:
        @"us.zoom.xos", @"com.microsoft.teams", @"com.microsoft.teams2",
        @"com.tinyspeck.slackmacgap", @"com.skype.skype",
        @"com.apple.FaceTime", @"com.google.Chrome", @"com.brave.Browser",
        @"com.discord", @"com.cisco.webexmeetingsapp",
        nil];

    for (NSRunningApplication *app in apps) {
        if (app.processIdentifier == selfPID) continue;
        if (app.bundleIdentifier && [callApps containsObject:app.bundleIdentifier]) {
            return @{
                @"appName": app.localizedName ?: @"Unknown",
                @"bundleId": app.bundleIdentifier ?: @"",
                @"pid": @(app.processIdentifier)
            };
        }
    }
    // Fallback: return first non-Privanote app that is active
    return nil;
}
```

### Node.js Wrapper Pattern (media-detector.js)
```javascript
// Source: follows ax-tree-extractor.js pattern exactly
const { execFile } = require('child_process');
const path = require('path');

const MEDIA_DETECTOR_PATH = path.join(__dirname, 'native', 'media_detector');
const TIMEOUT_MS = 3000;

function detectActiveMedia(selfPid) {
  return new Promise((resolve) => {
    execFile(MEDIA_DETECTOR_PATH, [String(selfPid || process.pid)], { timeout: TIMEOUT_MS }, (error, stdout) => {
      if (error) {
        resolve({ micActive: false, cameraActive: false, active: false });
        return;
      }
      try {
        const result = JSON.parse(stdout.trim());
        resolve({
          ...result,
          active: result.micActive || result.cameraActive,
        });
      } catch {
        resolve({ micActive: false, cameraActive: false, active: false });
      }
    });
  });
}

module.exports = { detectActiveMedia };
```

### IPC and Overlay Integration Pattern
```javascript
// preload-capture.js additions
startCallRecording: () => ipcRenderer.invoke('call-recording:start'),
stopCallRecording: () => ipcRenderer.invoke('call-recording:stop'),
getMediaState: () => ipcRenderer.invoke('media:get-detection-state'),
onMediaDetected: (cb) => {
  const handler = (_event, data) => cb(data);
  ipcRenderer.on('media:detected', handler);
  return () => ipcRenderer.removeListener('media:detected', handler);
},
onMediaEnded: (cb) => {
  const handler = (_event) => cb();
  ipcRenderer.on('media:ended', handler);
  return () => ipcRenderer.removeListener('media:ended', handler);
},
onCallRecordingState: (cb) => {
  const handler = (_event, state) => cb(state);
  ipcRenderer.on('call-recording:state-changed', handler);
  return () => ipcRenderer.removeListener('call-recording:state-changed', handler);
},
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| TCC log parsing for mic/camera detection | CoreAudio/CMIO device property queries | Always available | TCC logs unreliable; property queries are sub-100ms |
| ScreenCaptureKit for detection | CoreAudio `IsRunningSomewhere` | N/A | SCK is for capturing, not detecting other apps' usage |
| `kAudioProcessPropertyPID` (macOS 14+) | `kAudioDevicePropertyDeviceIsRunningSomewhere` (all macOS) | macOS 14 added process-level APIs | Process list APIs are newer but less broadly compatible. Device-level "running somewhere" plus NSWorkspace is more reliable across versions |

## Open Questions

1. **Process-level audio API availability**
   - What we know: macOS 14+ added `kAudioHardwarePropertyProcessObjectList` and `kAudioProcessPropertyPID` which could directly tell us which process is using audio
   - What's unclear: Whether these work for input devices specifically, and whether they require special entitlements
   - Recommendation: Use the simpler approach (device running + NSWorkspace enumeration of known call apps) which works on all supported macOS versions. If the simple approach proves insufficient for app identification, revisit the process-level API as enhancement.

2. **Browser-based calls (Google Meet, etc.)**
   - What we know: When Chrome hosts a Google Meet call, the mic-using process is Chrome itself. The CONTEXT.md explicitly excludes browser-based call detection.
   - What's unclear: Whether showing "Record Google Chrome" is useful when the actual call is Google Meet
   - Recommendation: For v1, show the process name as-is (Chrome, Safari, etc.). This is explicitly out of scope per CONTEXT deferred ideas.

3. **Simultaneous call recording and screen capture**
   - What we know: Both use `getDisplayMedia` which can only have one active session
   - What's unclear: Whether Electron allows two simultaneous display media sessions
   - Recommendation: Treat them as mutually exclusive. If screen capture is active, disable call recording button (and vice versa). Document this as a known limitation.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| clang (Xcode CLI tools) | Compiling media_detector.m | Likely | System | Required -- no fallback |
| CoreAudio.framework | Mic detection | Yes | macOS system | None needed |
| CoreMediaIO.framework | Camera detection | Yes | macOS system | None needed |
| AppKit.framework | Process enumeration | Yes | macOS system | None needed |
| Electron 28.3.3 | IPC, overlay | Yes | 28.3.3 | None needed |

**Missing dependencies with no fallback:** None expected. Xcode CLI tools should be present (already used to compile ax_walker).

## Sources

### Primary (HIGH confidence)
- CoreAudio `kAudioDevicePropertyDeviceIsRunningSomewhere` -- Apple framework header (AudioHardware.h), documented property for system-wide device activity check
- CoreMediaIO `kCMIODevicePropertyDeviceIsRunningSomewhere` -- verified via [Sindresorhus is-camera-on](https://github.com/sindresorhus/is-camera-on) and [working Swift gist](https://gist.github.com/gsingh1/beb4fac90ec819cc7a2fbd40f0eeb06b)
- Project source: `ax_walker.m`, `ax-tree-extractor.js`, `app-detector.js`, `main.js`, `preload-capture.js`, `capture-overlay.html` -- direct code reading

### Secondary (MEDIUM confidence)
- [tutorialpedia.org guide on macOS mic/camera detection](https://www.tutorialpedia.org/blog/is-there-an-api-to-check-if-mac-s-microphone-or-video-camera-is-in-use/) -- confirmed no public high-level API exists
- [Apple Developer Documentation: kAudioDevicePropertyDeviceIsRunning](https://developer.apple.com/documentation/coreaudio/kaudiodevicepropertydeviceisrunning)
- [Apple Developer Documentation: kAudioHardwarePropertyProcessObjectList](https://developer.apple.com/documentation/coreaudio/kaudiohardwarepropertyprocessobjectlist) -- macOS 14+ process enumeration

### Tertiary (LOW confidence)
- Process identification via `NSWorkspace.runningApplications` cross-referenced with call app bundle IDs -- pragmatic approach, but may miss uncommon call apps. LOW confidence on completeness of the call app list.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - CoreAudio/CMIO properties are well-established macOS APIs, verified by multiple open-source projects
- Architecture: HIGH - Follows established project patterns (native binary + execFile + JSON)
- Detection accuracy: MEDIUM - Device-level "is running" works reliably; app identification via process list is heuristic-based
- Pitfalls: HIGH - Identified from direct code analysis and API behavior understanding

**Research date:** 2026-04-01
**Valid until:** 2026-05-01 (stable macOS APIs, unlikely to change)
