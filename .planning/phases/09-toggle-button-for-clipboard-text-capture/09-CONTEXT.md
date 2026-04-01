# Phase 9: Toggle Button for Clipboard Text Capture - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a toggle in the floating overlay that monitors the system clipboard for text changes, automatically collecting copied text with metadata (timestamp, source app) as note context. When the user stops monitoring, a note is created with entries grouped by source app.

</domain>

<decisions>
## Implementation Decisions

### Activation model
- **D-01:** Clipboard monitoring is a separate toggle, independent of screen capture sessions. Both can run simultaneously and produce separate notes.
- **D-02:** Toggle lives as a second button on the existing floating overlay, next to the capture button.
- **D-03:** Entries buffer in memory until the user manually stops monitoring, then a single note is created automatically (no review step).
- **D-04:** A global keyboard shortcut (e.g., Cmd+Shift+V) toggles clipboard monitoring on/off in addition to the overlay button.

### Capture scope and grouping
- **D-05:** Text only — no images or file references from clipboard.
- **D-06:** Entries are grouped by source app in the resulting note (headings like "From Slack", "From Chrome").
- **D-07:** Each entry stores timestamp and source app name as metadata. Source app is the active foreground window at the time of the clipboard change.

### Deduplication and filtering
- **D-08:** Deduplicate globally — if the same text is copied again (from any app), skip it.
- **D-09:** Minimum text length threshold (~5 characters) to filter noise from accidental copies, single characters, whitespace.
- **D-10:** Skip concealed clipboard entries (macOS password manager convention) automatically.

### UI surface
- **D-11:** Clipboard button appears as a second icon button beside the existing capture button in the floating overlay.
- **D-12:** A badge counter on the clipboard button shows the live count of captured entries during an active session.
- **D-13:** Auto-save on stop — note is created immediately when monitoring stops, no preview/review step. Consistent with screen capture behavior.

### Claude's Discretion
- Exact polling interval for clipboard changes
- Global shortcut key combination (avoid conflicts with common shortcuts)
- Badge counter styling and position
- Clipboard button icon choice
- Exact minimum text length threshold value

</decisions>

<specifics>
## Specific Ideas

- Clipboard button should feel like a natural extension of the existing overlay — same visual style, same always-on-top behavior
- Note grouping by source app mirrors how screen capture sessions organize captures
- The `getActiveWindowInfo()` AppleScript function from screen-capture.js can be reused to detect which app the user copied from
- Buffer entries in memory (like CaptureSession.captures array) — no need for persistent storage during a session

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements are fully captured in decisions above.

### Existing patterns to follow
- `apps/desktop/src/main/capture-session.js` — CaptureSession class pattern: state machine (idle/capturing/finalizing), onStateChange callback, finalize() groups by app
- `apps/desktop/src/main/screen-capture.js` — `getActiveWindowInfo()` AppleScript for detecting active app name/bundleId
- `apps/desktop/src/main/main.js` — Overlay window management, IPC handlers, global shortcut registration (`globalShortcut.register`)
- `apps/desktop/src/main/preload.js` — IPC bridge pattern for renderer communication
- `apps/desktop/src/renderer/components/capture-overlay.jsx` — Existing overlay UI component to extend with clipboard button

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `getActiveWindowInfo()` in screen-capture.js: Returns `{ appName, bundleId, windowTitle, pid }` — reuse for source app detection
- `CaptureSession` class pattern: State machine with `start()/stop()/finalize()` and grouped results — model ClipboardSession similarly
- Floating overlay window in main.js: Already always-on-top, already has IPC bridge — extend with clipboard button
- `broadcastCaptureState()` in main.js: Pattern for notifying overlay of state changes via IPC

### Established Patterns
- IPC bridge: preload.js exposes methods on `window.api`, main.js handles via `ipcMain.handle()`
- State broadcasting: main process sends state updates to overlay via `webContents.send()`
- Note creation: Backend `/notes` POST endpoint with title and content body
- Global shortcuts: `globalShortcut.register()` in main.js app ready handler

### Integration Points
- Overlay window (capture-overlay.jsx): Add clipboard button alongside capture button
- main.js: Add ClipboardSession lifecycle management, IPC handlers, global shortcut
- preload.js: Add clipboard monitoring IPC bridge methods
- Backend notes API: Create note on session stop (same endpoint as screen capture)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-toggle-button-for-clipboard-text-capture*
*Context gathered: 2026-04-01*
