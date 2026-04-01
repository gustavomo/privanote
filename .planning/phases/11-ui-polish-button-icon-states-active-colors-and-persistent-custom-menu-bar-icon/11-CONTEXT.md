# Phase 11: UI Polish — Button Icon States, Active Colors, and Persistent Custom Menu Bar Icon - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Visual refinement of the floating overlay buttons and the macOS menu bar presence. Reduce button size, add meaningful idle/active icon states (eye open/closed, clipboard open/closed, headphones off/on), unify active colors to a single teal accent, remove pulse animations, and replace the emoji tray icon with a proper monochrome template icon. The app should minimize to the menu bar tray when the window is closed, keeping overlay and capture features running.

This phase does NOT include:
- New button functionality or new features
- Changes to capture logic, session handling, or note creation
- App icon / dock icon redesign
- Drag/positioning changes for the overlay

</domain>

<decisions>
## Implementation Decisions

### Button Size
- **D-01:** Reduce all overlay buttons from 56px to 40px circles. Mode picker buttons scale proportionally (from 48px to ~34px).
- **D-02:** Reduce gap between buttons from 8px to 4-6px for a tighter vertical stack.
- **D-03:** SVG icon size scales proportionally with the button (from 24px to ~18px).

### Icon States — Screen Capture
- **D-04:** Idle: eye-closed icon (eye with a line through it). Active/capturing: eye-open icon (open eye). No stop-square — the icon + teal color indicates active state, clicking toggles off.

### Icon States — Clipboard
- **D-05:** Mirror the eye open/closed metaphor. Idle: clipboard-closed/flat icon. Active/monitoring: clipboard-open/writing icon. Same toggle behavior — no stop-square.

### Icon States — Call Recording
- **D-06:** Follow the same open/closed pattern. Idle: headphones-off/muted icon. Active/recording: headphones-on/active icon. No stop-square — teal color + icon change indicates state.
- **D-07:** Amber state (call ended while recording) keeps the active icon but uses amber color to differentiate.

### Active Color Scheme
- **D-08:** All buttons share a single unified teal/cyan accent when active (~oklch(0.65 0.15 195)). No more red/blue/green distinction.
- **D-09:** The icon design differentiates WHAT is active. The color signals THAT something is active.
- **D-10:** Idle button color remains dark charcoal (oklch(0.214 0.009 43.1)). Hover remains slightly lighter.

### Pulse Animation
- **D-11:** Remove all pulse ring animations (capture pulse, clipboard pulse, call pulse). Color change alone signals active state. Cleaner, less visual noise at smaller size.

### Menu Bar Icon
- **D-12:** Replace the current emoji tray text (👁 / 🔴 REC) with a proper monochrome macOS template icon.
- **D-13:** Glyph: a stylized "P" or "PN" lettermark. Set as template image so macOS adapts it to light/dark menu bar automatically.
- **D-14:** Recording state: add a small red dot badge or change the tray icon variant to indicate active recording.

### Window Close Behavior
- **D-15:** Closing the main window minimizes to tray — the app stays alive in the menu bar. Overlay and capture features keep working.
- **D-16:** Cmd+Q (or app.quit()) actually quits the app. The tray icon is removed on quit.
- **D-17:** Clicking the tray icon reopens/shows the main window.

### Overall Overlay Styling
- **D-18:** Keep individual floating circles layout (no shared container/pill background).
- **D-19:** Keep box-shadow on each button. Scale shadow proportionally with smaller size.

### Claude's Discretion
- Exact oklch values for the teal accent (within the ~195 hue range)
- Exact SVG paths for the new icon states (eye-closed, clipboard-open/closed, headphones-off/on)
- Lettermark "P" vs "PN" for the tray icon and exact glyph design
- Whether badge counter on clipboard button needs size adjustment at 40px
- Exact gap size within the 4-6px range
- Finalizing state icon (spinner) — keep or replace with a subtle indicator

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Overlay UI
- `apps/desktop/src/renderer/capture-overlay/capture-overlay.html` — Self-contained overlay with all button states, icons, CSS, and JS
- `apps/desktop/src/main/main.js` lines 329-374 — Tray setup, `createEmptyTrayImage()`, `updateTray()`, dock badge

### Main Process Window Management
- `apps/desktop/src/main/main.js` — BrowserWindow creation, overlay show/hide, app lifecycle
- `apps/desktop/src/main/app-detector.js` — Overlay visibility control, whitelist state

### Prior Phase Contexts
- `.planning/phases/06-always-on-top-floating-capture-button-for-external-app-screen-capture/06-CONTEXT.md` — Original overlay design decisions
- `.planning/phases/09-toggle-button-for-clipboard-text-capture/09-CONTEXT.md` — Clipboard button and blue accent decisions
- `.planning/phases/10-detect-active-media-microphone-camera-usage-via-system-apis-and-show-a-floating-recording-button-that-integrates-with-the-existing-note-capture-flow/10-CONTEXT.md` — Call recording button and green/amber color decisions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `capture-overlay.html` — All button rendering, state management, and IPC listeners in one self-contained file. All changes for button size, icons, colors, and animations happen here.
- `createEmptyTrayImage()` / `setupTray()` / `updateTray()` in main.js — Tray lifecycle. Currently uses a 1x1 transparent PNG with emoji text. Needs replacement with proper nativeImage.
- `recalcHeight()` — Dynamic overlay height calculation. Needs updating for new 40px button size.
- `updateMutualExclusion()` — Disabled state styling. Needs to work with new color scheme.

### Established Patterns
- oklch color space used throughout for all button states
- SVG icons defined as inline HTML string constants (ICONS, CLIP_ICONS, CALL_ICONS objects)
- State managed via CSS class toggling (`.recording`, `.monitoring`, `.call-recording`, etc.)
- `nativeImage.createFromBuffer()` with `setTemplateImage(true)` already used for tray — same pattern for the new icon

### Integration Points
- `setState()`, `setClipState()`, `setCallState()` — State transition functions that update CSS classes and icons. Need modification for new icon mappings.
- `recalcHeight()` and `window.captureApi.resizeOverlay()` — Height recalculation IPC. Dimensions change with smaller buttons.
- Main process `app.on('window-all-closed')` — Currently may quit the app. Needs change to keep app alive in tray.
- Main process `mainWindow.on('close')` — Needs to intercept close and hide instead of destroy.

</code_context>

<specifics>
## Specific Ideas

- Eye-closed/open metaphor is the primary visual language for this overlay
- Teal/cyan unifies the overlay as one cohesive tool instead of three separate colored features
- Monochrome template icon follows macOS HIG — adapts to light/dark menu bar automatically
- Minimize-to-tray is essential because the overlay and capture run independently of the main window

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 11-ui-polish-button-icon-states-active-colors-and-persistent-custom-menu-bar-icon*
*Context gathered: 2026-04-01*
