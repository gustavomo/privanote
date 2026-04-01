# Phase 8: Limit floating capture button to specific apps - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Show/hide the floating capture overlay button based on which app is currently in the foreground. The overlay is hidden by default and only appears when the active app matches a user-configured whitelist of preset apps. A settings UI lets users toggle which apps trigger the overlay.

This phase does NOT include:
- Custom app addition beyond the 5 presets (future phase)
- Continuous background monitoring when no capture session is active (only checks during overlay visibility polling)
- Browser extension or deep integration with whitelisted apps
- AI-powered capture processing or deduplication

</domain>

<decisions>
## Implementation Decisions

### Whitelist Scope
- **D-01:** Whitelist is empty by default — overlay starts hidden until user enables apps
- **D-02:** 5 preset apps only: Slack, Gmail (browser), Notion, Jira (browser), GitHub (browser)
- **D-03:** No custom app addition in this phase — only the preset list is available

### Browser App Detection
- **D-04:** Primary: AX tree URL extraction — walk the browser's accessibility tree to find the URL bar value, match against known URL patterns (mail.google.com, notion.so, github.com, atlassian.net)
- **D-05:** Fallback: Window title parsing — match against known patterns in the browser window title (e.g., "Gmail", "Jira", "GitHub")
- **D-06:** Supports Chrome and Safari as browser hosts

### Show/Hide Behavior
- **D-07:** Instant hide/show — overlay disappears and reappears immediately on app switch, no fade or delay
- **D-08:** Polling checks active app on an interval (reuse active-win from Phase 6) and shows/hides overlay accordingly

### Settings Surface
- **D-09:** Settings view only — add a "Capture Apps" section in the existing Settings view (Phase 3 infrastructure)
- **D-10:** Toggle switches for each of the 5 preset apps
- **D-11:** No right-click menu or tray menu for whitelist management

### Claude's Discretion
- Polling interval for active app check (balance responsiveness vs CPU)
- How to handle the overlay during an active capture session (likely keep showing regardless of active app)
- URL patterns for browser app matching (exact domains to match)
- Whether to check app on both overlay visibility and capture session start

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 6 (capture overlay foundation)
- `.planning/phases/06-always-on-top-floating-capture-button-for-external-app-screen-capture/06-CONTEXT.md` — Overlay window decisions, capture approach, AX tree strategy
- `.planning/phases/06-always-on-top-floating-capture-button-for-external-app-screen-capture/06-03-SUMMARY.md` — Main.js wiring, overlay creation, tray icon, panel type decisions

### Settings infrastructure
- `.planning/phases/03-transcription-and-settings/03-CONTEXT.md` — Settings view architecture, backend-owned settings contracts

### Existing implementation
- `apps/desktop/src/main/main.js` — createCaptureOverlay(), broadcastCaptureState(), setupTray()
- `apps/desktop/src/main/screen-capture.js` — getActiveWindowInfo() returns appName, bundleId, windowTitle, pid
- `apps/desktop/src/main/ax-tree-extractor.js` — extractTextFromAccessibilityTree(pid) walks AX tree
- `apps/desktop/src/main/capture-session.js` — CaptureSession uses active-win for app detection

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `active-win` module: already imported, returns `owner.name`, `owner.bundleId`, `title` for active window
- `getActiveWindowInfo()` in screen-capture.js: returns `{ appName, windowTitle, bundleId, pid }`
- `ax-tree-extractor.js` + `ax_walker` binary: can walk AX tree of any PID for URL extraction
- Settings backend from Phase 3: `getSettings()` / `updateSettings()` IPC handlers + UI
- `createCaptureOverlay()` in main.js: controls overlay window creation and visibility

### Established Patterns
- Overlay window uses `type: 'panel'` on macOS, `focusable: false`
- `captureOverlay.show()` / `captureOverlay.hide()` for visibility control
- Settings persisted via backend API, accessed through `window.api.getSettings()`

### Integration Points
- `main.js` app.whenReady: add polling loop for active app detection
- `main.js` createCaptureOverlay: conditionally show based on whitelist
- Settings view in App.jsx: add "Capture Apps" section with toggles
- Backend settings contract: extend with `captureApps` whitelist field

</code_context>

<specifics>
## Specific Ideas

- Preset apps map to known identifiers:
  - Slack → bundleId `com.tinyspeck.slackmacgap` or appName `Slack`
  - Gmail → browser URL `mail.google.com`
  - Notion → bundleId `notion.id` or browser URL `notion.so`
  - Jira → browser URL containing `atlassian.net`
  - GitHub → browser URL `github.com`

</specifics>

<deferred>
## Deferred Ideas

- Custom app addition beyond the 5 presets — user adds arbitrary apps by name or bundleId
- AI-powered capture processing and deduplication (separate todo exists)
- Toggle button for clipboard text capture (separate todo exists)

</deferred>

---

*Phase: 08-limit-floating-capture-button-to-specific-apps*
*Context gathered: 2026-04-01*
