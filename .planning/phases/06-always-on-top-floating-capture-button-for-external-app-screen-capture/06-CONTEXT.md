# Phase 6: Always-on-top floating capture button for external app screen capture - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning
**Source:** Todo express path (.planning/todos/pending/2026-03-31-always-on-top-floating-capture-button-for-external-app-screen-capture.md)

<domain>
## Phase Boundary

An always-on-top floating button window that lives over all other apps (Slack, Gmail, Notion, Chrome, Zoom, etc.). When the user clicks it, it starts a capture session that records screenshots of the active external window and extracts text from it. When the user stops the session, Privanote creates a structured note automatically with the captured content grouped by source app. Optionally captures system audio + microphone if a call is in progress.

This phase does NOT include:
- Native integrations via Slack/Gmail/Notion APIs
- Continuous passive capture (screenpipe-style)
- AI question-answering over captured content (that's a future phase)
- Browser extension

</domain>

<decisions>
## Implementation Decisions

### Floating Window Behavior
- Always-on-top Electron `BrowserWindow` with `alwaysOnTop: true`, `frame: false`, `transparent: true`, `skipTaskbar: true`
- Small circular/pill button, positioned at a fixed corner of the screen (user-draggable preferred)
- Two states: idle (mic/camera icon) and recording (red pulsing indicator)
- Click to start session, click again to stop

### Screen Capture Approach
- Use Electron's `desktopCapturer` API to take periodic screenshots of the active window
- Capture frequency: event-driven preferred (on window focus change, scroll pause) rather than fixed interval
- Tag each capture with: timestamp, active app name, window title

### Text Extraction Strategy
- **Primary:** macOS Accessibility API — extracts structured text directly from the app's UI tree (clean, no OCR needed)
- **Fallback:** OCR via Tesseract.js or Apple Vision framework for apps that don't expose accessibility tree
- Target apps with good accessibility support: Slack desktop, Chrome/Safari (Notion, Gmail), GitHub desktop

### Audio Capture (optional, session-level)
- Detect if system audio is active when session starts (indicates a call/huddle)
- If yes, capture system audio + microphone and transcribe at session end
- Same transcription pipeline already built in Phase 3

### Note Creation on Session End
- Group captured content by source app
- Create one note per session with:
  - Auto-title: "{App name} session — {date} {time}"
  - Body: extracted text blocks ordered by timestamp
  - Metadata: apps visited, duration, whether audio was captured
- Use existing `ensureCaptureNode()` + backend save flow from Phase 2/3

### Claude's Discretion
- Exact drag/positioning UX for the floating button
- Whether to show a mini preview of captured content before finalizing the note
- Exact capture frequency / change-detection algorithm
- How to handle multi-monitor setups

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Electron Window APIs
- `apps/desktop/src/main/main.js` — existing BrowserWindow setup; new floating window follows same patterns
- `apps/desktop/src/preload/preload.js` — IPC bridge; floating window needs its own preload or shared bridge

### Capture and Save Pipeline (existing — reuse)
- `apps/desktop/src/renderer/App.jsx` — `ensureCaptureNode()`, `handleSaveRecording()`, `handleImportFiles()` — the note-creation flow to reuse
- `apps/desktop/src/main/main.js` — `backend:upload` IPC handler — upload endpoint for captured media

### Transcription Pipeline (existing — reuse for audio)
- Phase 3 plans and implementation — transcription adapters already built

### Prior Art References (external — for research)
- Screenpipe (open source) — accessibility tree capture approach
- Cluely — floating overlay UI pattern
- Electron `desktopCapturer` docs — screenshot API

</canonical_refs>

<specifics>
## Specific Ideas

- The todo mentioned Cluely as prior art for the floating overlay pattern — worth studying their UX
- Screenpipe uses macOS Accessibility API via native binding — same approach recommended here
- The floating button should NOT require the user to switch away from what they're doing
- Global keyboard shortcut (`Cmd+Shift+R` or similar) as an alternative to clicking the button
- The note created should be immediately queryable by AI tools (MCP server future phase)

</specifics>

<deferred>
## Deferred Ideas

- Slack/Gmail/Notion native API integrations — future phase
- AI Q&A over captured sessions — future phase
- MCP server to expose captured content to external AI tools — future phase
- Browser extension as alternative capture method — future phase
- Multi-language OCR support — future phase
- Automatic call detection across all platforms (Windows, Linux) — v1 is macOS-first

</deferred>

---

*Phase: 06-always-on-top-floating-capture-button-for-external-app-screen-capture*
*Context gathered: 2026-03-31 via Todo express path*
