# Phase 10: Detect Active Media and Show Floating Recording Button - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Detect when another app is actively using the microphone or camera on macOS (via the system orange/green dot indicator), and surface a conditional third button on the existing floating overlay that lets the user one-tap record the call. The recording uses the existing system audio + microphone mixed capture flow from Phase 7. Notes are auto-titled with the detected source app name.

This phase does NOT include:
- Auto-starting recording without user action
- Transcription of call recordings (existing Phase 3 pipeline handles that separately)
- Per-app configuration or whitelisting of call apps
- Browser-based call detection (Google Meet tab detection)

</domain>

<decisions>
## Implementation Decisions

### Detection Method
- **D-01:** Detect active mic/camera usage via the macOS system indicator (orange dot = mic, green dot = camera) using accessibility or ScreenCaptureKit APIs
- **D-02:** Cover both microphone and camera — trigger when either is active
- **D-03:** Poll every 2-3 seconds, piggyback on the existing app-detector polling interval
- **D-04:** Ignore Privanote's own mic/camera usage — only trigger when another app is using media

### Trigger Behavior
- **D-05:** Auto-show a recording button on the overlay when a call is detected. No notification or confirmation step.
- **D-06:** One tap starts recording immediately. Consistent with existing capture button.
- **D-07:** When the external call ends while Privanote is recording, keep recording but notify the user that the call ended. User stops manually.

### Overlay Integration
- **D-08:** Third button on the existing overlay, shown conditionally only when a call is detected. Overlay goes from 2 to 3 buttons during calls, back to 2 when call ends.
- **D-09:** Headphone/call icon to distinguish from the existing screen-capture button.

### Call App Awareness
- **D-10:** Detect which app is using the mic/camera and show the app name on the button (tooltip or label). E.g., "Record Zoom call".
- **D-11:** Same behavior for all detected call apps — no per-app customization.
- **D-12:** Auto-title notes with source app: "Zoom call — Apr 1, 2:30 PM". Tag with source app name in metadata.

### Claude's Discretion
- Exact API approach for reading macOS mic/camera indicator state (accessibility API, CoreAudio tap, or ScreenCaptureKit)
- Animation/transition when the third button appears/disappears on the overlay
- How to identify the specific app using the mic (process list inspection, window ownership)
- Notification style when call ends during recording (inline toast, overlay change, etc.)

### Folded Todos
- **Detect active media and show recording button** — original todo that spawned this phase. Fully covered by the decisions above.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Overlay System
- `apps/desktop/src/main/main.js` — Overlay BrowserWindow creation, always-on-top, show/hide logic
- `apps/desktop/src/renderer/capture-overlay/capture-overlay.html` — Self-contained overlay UI
- `apps/desktop/src/main/app-detector.js` — `shouldShowOverlay()`, active window detection, browser tab URL extraction

### Audio Capture Infrastructure
- `apps/desktop/src/main/main.js` — `setDisplayMediaRequestHandler` with `audio: 'loopback'`, Chromium flag, screen permission IPC
- `apps/desktop/src/main/preload.js` — `getScreenPermissionStatus`, `recordScreenDenial` IPC bridges
- `apps/desktop/src/renderer/App.jsx` — Mixed audio recording flow with `getDisplayMedia` + Web Audio API

### Prior Phase Contexts
- `.planning/phases/06-always-on-top-floating-capture-button-for-external-app-screen-capture/06-CONTEXT.md` — Floating window behavior decisions
- `.planning/phases/07-fix-screen-capture-to-record-system-audio-instead-of-microphone/07-CONTEXT.md` — System audio capture decisions
- `.planning/phases/08-limit-floating-capture-button-to-specific-apps/08-CONTEXT.md` — App detection whitelist decisions
- `.planning/phases/09-toggle-button-for-clipboard-text-capture/09-CONTEXT.md` — Two-button overlay layout decisions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app-detector.js` — Already polls active window info; can be extended to check mic/camera process ownership
- `shouldShowOverlay()` — Existing overlay visibility logic; new media detection can integrate alongside
- Mixed audio recording flow in `App.jsx` — `getDisplayMedia` + `getUserMedia` + Web Audio API mixing already built
- `ensureCaptureNode()` — Existing note creation flow for recordings
- Capture overlay HTML — Self-contained, can be extended with a third button

### Established Patterns
- Polling-based detection (app-detector runs on interval)
- IPC bridge pattern: main process detects, preload exposes, renderer consumes
- Overlay show/hide controlled by main process based on detection results
- Denial count persistence pattern (screen-denial.json) — can reuse for any state persistence

### Integration Points
- Main process polling loop (where `shouldShowOverlay` runs) — add media detection check
- Overlay HTML — add conditional third button
- IPC channel for media detection state → renderer
- `handleStartRecording()` in App.jsx — recording flow already handles mixed audio

</code_context>

<specifics>
## Specific Ideas

- User wants the call source app name visible on the button and in the note title
- "Zoom call — Apr 1, 2:30 PM" as the auto-title format
- Recording continues after call ends (user stays in control) with a notification that the call ended

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 10-detect-active-media-microphone-camera-usage-via-system-apis-and-show-a-floating-recording-button-that-integrates-with-the-existing-note-capture-flow*
*Context gathered: 2026-04-01*
