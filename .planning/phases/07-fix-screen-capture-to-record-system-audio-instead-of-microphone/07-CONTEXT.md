# Phase 7: Fix screen capture to record system audio instead of microphone - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Change the sidebar capture panel's audio recording to capture system audio (app sounds, call audio) mixed with microphone input, instead of microphone-only. This uses Electron's `desktopCapturer` + `getDisplayMedia` API path instead of the current `getUserMedia` approach. The floating overlay capture button (Phase 6) is NOT affected by this change.

</domain>

<decisions>
## Implementation Decisions

### Audio Source Scope
- **D-01:** System audio and microphone are captured together as a mixed stream — not one or the other
- **D-02:** This applies to the sidebar capture panel recording only (App.jsx), NOT the floating button external capture (Phase 6)
- **D-03:** All capture modes (Audio, Video, Video+Audio) get the mixed system audio + microphone when audio is enabled
- **D-04:** No additional UI indicator for system audio capture — the interface stays unchanged

### System Audio Method
- **D-05:** Use Electron's `desktopCapturer` to obtain a screen source ID, then `getDisplayMedia` with `audio: true` to capture system audio
- **D-06:** macOS 13+ (Ventura) is required for system audio capture — no support for older macOS versions needed
- **D-07:** The microphone stream (`getUserMedia`) is mixed with the system audio stream (`getDisplayMedia`) into a single recording

### Recording Trigger
- **D-08:** System audio capture starts automatically when the user clicks Record — no separate toggle or opt-in step
- **D-09:** Screen recording permission prompt appears on first recording attempt, not at app launch. macOS remembers the grant for future sessions

### Fallback Behavior
- **D-10:** Recording is BLOCKED if system audio permission is not granted — the app does not fall back to microphone-only
- **D-11:** If permission is denied on first attempt, the app re-prompts once on the next recording attempt, then stops asking
- **D-12:** After two denials, the user must grant screen recording permission via macOS System Settings to use recording

### Claude's Discretion
- How to merge the two audio streams (Web Audio API AudioContext mixer vs MediaStream track combination)
- Exact error message wording when permission is blocked
- Whether to use `desktopCapturer.getSources` or direct `getDisplayMedia` constraints for the screen source

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Recording Implementation
- `apps/desktop/src/renderer/App.jsx` — `resolveCaptureConstraints()`, `resolveRequiredPermissions()`, `resolveSupportedMimeType()`, recording state management, `getUserMedia` call at line ~728
- `apps/desktop/src/main/main.js` — IPC handlers, permission checking for camera/microphone, `desktopCapturer` usage for screen capture

### Screen Capture (Phase 6)
- `apps/desktop/src/main/screen-capture.js` — existing `desktopCapturer` usage for screenshots; reference for how screen sources are obtained
- `.planning/phases/06-always-on-top-floating-capture-button-for-external-app-screen-capture/06-CONTEXT.md` — Phase 6 decisions (this phase does NOT modify the floating button)

### Electron APIs
- Electron `desktopCapturer` API — source enumeration for system audio
- Chrome `getDisplayMedia` with audio constraints — system audio stream capture

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `desktopCapturer` already imported and used in `screen-capture.js` — same API needed for audio source enumeration
- `MediaRecorder` already used in App.jsx for recording — same recorder can accept the mixed stream
- Permission checking pattern exists in `main.js` for camera/microphone — extend for screen recording permission

### Established Patterns
- Recording flow: `getUserMedia` → `MediaRecorder` → blob → upload via `backend:upload` IPC
- Permission check: main process checks via `systemPreferences.getMediaAccessStatus()`, renderer requests via `getUserMedia`
- Capture modes: `resolveCaptureConstraints()` maps mode string to constraints object

### Integration Points
- `resolveCaptureConstraints()` in App.jsx needs to change from `getUserMedia` constraints to `getDisplayMedia` + `getUserMedia` merged stream
- `resolveRequiredPermissions()` needs to add screen recording permission check
- Main process may need a new IPC handler to enumerate `desktopCapturer` sources for the renderer
- The `MediaRecorder` input stream changes from single-source to mixed multi-source

</code_context>

<specifics>
## Specific Ideas

- The user wants to capture "what's happening on screen" audio-wise (call audio, app sounds) alongside their own voice
- This is specifically for the sidebar panel recording workflow, keeping the external floating capture button unchanged
- No UI changes — the recording experience should feel identical, just with system audio included

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-fix-screen-capture-to-record-system-audio-instead-of-microphone*
*Context gathered: 2026-04-01*
