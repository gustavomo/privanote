# Phase 11: UI Polish — Button Icon States, Active Colors, and Persistent Custom Menu Bar Icon - Research

**Researched:** 2026-04-01
**Domain:** Electron Tray API, macOS template images, overlay CSS/SVG, BrowserWindow lifecycle
**Confidence:** HIGH

## Summary

This phase is a visual refinement pass on the existing floating overlay (`capture-overlay.html`) and the macOS menu bar tray icon, plus a behavioral change to minimize-to-tray on window close. All overlay changes are confined to a single self-contained HTML file with inline CSS and JS -- no bundler, no Tailwind, no external dependencies. The tray icon changes are in `main.js` using Electron's built-in `nativeImage` and `Tray` APIs. The minimize-to-tray change is a standard Electron pattern using `event.preventDefault()` in the `close` event handler with an `isQuitting` flag (already declared in the codebase).

The codebase is Electron 28.3.3 (CommonJS main process, Node 18). All existing patterns are well-established: oklch colors, inline SVG icon objects, CSS class toggling for state, `nativeImage.createFromBuffer()` with `setTemplateImage(true)` for tray. No new dependencies are needed.

**Primary recommendation:** Execute in two plans -- (1) overlay visual changes (button size, icons, colors, pulse removal) all in `capture-overlay.html` plus the `createCaptureOverlay()` width in `main.js`, and (2) tray icon replacement plus minimize-to-tray lifecycle changes in `main.js`.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Reduce all overlay buttons from 56px to 40px circles. Mode picker buttons scale proportionally (from 48px to ~34px).
- **D-02:** Reduce gap between buttons from 8px to 4-6px for a tighter vertical stack.
- **D-03:** SVG icon size scales proportionally with the button (from 24px to ~18px).
- **D-04:** Screen capture: idle = eye-closed icon, active = eye-open icon. No stop-square.
- **D-05:** Clipboard: idle = clipboard-closed/flat icon, active = clipboard-open/writing icon. No stop-square.
- **D-06:** Call recording: idle = headphones-off/muted icon, active = headphones-on icon. No stop-square.
- **D-07:** Amber state keeps active icon but uses amber color.
- **D-08:** All buttons share unified teal/cyan accent when active (~oklch(0.65 0.15 195)).
- **D-09:** Icon design differentiates WHAT is active; color signals THAT something is active.
- **D-10:** Idle button color remains dark charcoal (oklch(0.214 0.009 43.1)). Hover remains slightly lighter.
- **D-11:** Remove all pulse ring animations.
- **D-12:** Replace emoji tray text with proper monochrome macOS template icon.
- **D-13:** Glyph: stylized "P" or "PN" lettermark. Template image for light/dark adaptation.
- **D-14:** Recording state: red dot badge or icon variant.
- **D-15:** Closing main window minimizes to tray. App stays alive.
- **D-16:** Cmd+Q / app.quit() actually quits. Tray removed on quit.
- **D-17:** Clicking tray icon reopens/shows main window.
- **D-18:** Keep individual floating circles layout (no shared container).
- **D-19:** Keep box-shadow on each button, scale proportionally.

### Claude's Discretion
- Exact oklch values for teal accent (within ~195 hue range)
- Exact SVG paths for new icon states (eye-closed, clipboard-open/closed, headphones-off/on)
- Lettermark "P" vs "PN" for tray icon and exact glyph design
- Whether badge counter on clipboard button needs size adjustment at 40px
- Exact gap size within 4-6px range
- Finalizing state icon (spinner) -- keep or replace

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.

</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Electron | 28.3.3 | Desktop runtime, BrowserWindow, Tray, nativeImage | Already in use, provides all needed APIs |

### Supporting
No additional libraries needed. All changes use:
- Inline CSS in `capture-overlay.html` (oklch colors, sizing)
- Inline SVG paths in `capture-overlay.html` (icon states)
- Electron `nativeImage.createFromBuffer()` with `setTemplateImage(true)` (tray icon)
- Electron `Tray` API (menu bar presence)
- Electron `BrowserWindow.on('close')` with `event.preventDefault()` (minimize to tray)

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline SVG strings | lucide icon library | Overlay is self-contained HTML with no bundler; inline SVGs are the established pattern; adding a library would break the architecture |
| PNG tray icon from buffer | PNG file on disk via `createFromPath` | Buffer approach is already used; creating from buffer with base64 avoids file-path issues in packaged builds |

**Installation:**
```bash
# No installation needed -- all APIs are built into Electron 28.3.3
```

## Architecture Patterns

### Files Modified
```
apps/desktop/
  src/
    main/
      main.js                    # Tray icon, window close handler, overlay dimensions
    renderer/
      capture-overlay/
        capture-overlay.html     # ALL overlay visual changes (CSS + SVG + JS)
  resources/                     # NEW: tray icon PNG assets
    trayTemplate.png             # 16x16 @1x "P" lettermark
    trayTemplate@2x.png          # 32x32 @2x "P" lettermark
    trayRecTemplate.png          # 16x16 @1x "P" with red dot
    trayRecTemplate@2x.png       # 32x32 @2x "P" with red dot
```

### Pattern 1: Overlay State via CSS Class Toggling (Existing)
**What:** Button states are managed by adding/removing CSS classes (`.recording`, `.monitoring`, `.call-recording`, etc.). The `setState()`, `setClipState()`, and `setCallState()` functions update className and innerHTML of the SVG container.
**When to use:** Every button state transition in the overlay.
**Example:**
```javascript
// Existing pattern -- icon objects map state names to SVG innerHTML
const ICONS = {
  idle: `<path d="...eye-closed..."/>`,
  recording: `<path d="...eye-open..."/><circle cx="12" cy="12" r="3"/>`,
  finalizing: `<path class="spinner" d="..."/>`,
};

function setState(raw) {
  const state = raw === 'capturing' ? 'recording' : raw;
  const vis = btn.classList.contains('visible') ? ' visible' : '';
  btn.className = 'btn' + (state !== 'idle' ? ' ' + state : '') + vis;
  icon.innerHTML = ICONS[state] || ICONS.idle;
  // ...
}
```

### Pattern 2: macOS Template Image for Tray (Established)
**What:** Create a `nativeImage` from a PNG buffer, call `setTemplateImage(true)` so macOS automatically renders it in the correct color for light/dark menu bars.
**When to use:** Tray icon setup and state changes.
**Example:**
```javascript
// Load from file for clarity and @2x support
const trayIcon = nativeImage.createFromPath(
  path.join(__dirname, '..', '..', 'resources', 'trayTemplate.png')
);
// Naming convention 'trayTemplate.png' auto-marks as template
tray = new Tray(trayIcon);
```

### Pattern 3: Minimize-to-Tray Close Intercept (Standard Electron)
**What:** Intercept the `close` event on the main BrowserWindow, call `event.preventDefault()` and `mainWindow.hide()` unless the app is actually quitting.
**When to use:** Window close button clicked by user.
**Example:**
```javascript
// In createWindow(), after BrowserWindow creation:
win.on('close', (event) => {
  if (!isQuitting) {
    event.preventDefault();
    win.hide();
  }
});

// isQuitting is already set to true in app.on('before-quit')
// Cmd+Q triggers before-quit -> isQuitting=true -> close proceeds normally
```

### Anti-Patterns to Avoid
- **Modifying `window-all-closed` to prevent quit:** The main window is now hidden, not closed. `window-all-closed` should remain as a safety fallback but will not fire during normal minimize-to-tray use. Do NOT add quit prevention logic there -- use the `close` event on the BrowserWindow instead.
- **Creating tray icons programmatically with Canvas:** Drawing icons via Canvas or Offscreen rendering adds complexity. Use pre-rendered PNG assets that follow the Electron template naming convention.
- **Mixing old and new color values:** The unified teal replaces three different active colors (red, blue, green). All three CSS rules, their box-shadow values, and their pulse animation rules must be updated atomically to avoid a state where one button is teal and another is still the old color.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Template image adaptation | Custom dark/light mode detection + color inversion | `setTemplateImage(true)` on nativeImage | macOS handles the color adaptation natively; hand-rolling misses edge cases like high contrast mode |
| Tray icon with recording badge | Canvas drawing or dynamic image composition at runtime | Two separate pre-rendered PNG pairs (idle + recording) | Swapping pre-rendered images is simpler, more reliable, and avoids runtime image manipulation |
| Window close interception | Custom event system or window hooks | `BrowserWindow.on('close', event => event.preventDefault())` with `isQuitting` flag | This is the documented Electron pattern; the `isQuitting` flag already exists in the codebase |

**Key insight:** This phase requires zero new dependencies. Every capability needed is already available in Electron 28.3.3's built-in APIs and the existing codebase patterns.

## Common Pitfalls

### Pitfall 1: Forgetting to Update Overlay Window Dimensions
**What goes wrong:** The overlay BrowserWindow in main.js is created with `width: 64, height: 72`. When buttons shrink to 40px, the container shrinks to 48px. If the BrowserWindow width is not reduced, the clickable/draggable region extends beyond the visible buttons, causing unexpected click interception on the desktop.
**Why it happens:** The overlay is transparent, so the oversized window is invisible but still captures mouse events.
**How to avoid:** Update `createCaptureOverlay()` to `width: 48` and the initial height calculation. Also update the `body` CSS width from `64px` to `48px` and `.container` width from `64px` to `48px`.
**Warning signs:** Clicking near but not on the overlay buttons triggers no response, or clicking desktop icons near the overlay fails.

### Pitfall 2: Close Handler Preventing Actual Quit
**What goes wrong:** The `close` event handler always calls `event.preventDefault()`, making the app impossible to quit even via Cmd+Q.
**Why it happens:** The `isQuitting` flag check is missing or the flag is not set before the close handler fires.
**How to avoid:** The codebase already sets `isQuitting = true` in `app.on('before-quit')`, which fires before Cmd+Q triggers the close event. The close handler MUST check `if (!isQuitting)` before preventing close. Also ensure the `mainWindow.on('closed')` cleanup (setting `mainWindow = null`) still runs when the window actually closes during quit.
**Warning signs:** Cmd+Q does nothing; user cannot exit the app.

### Pitfall 3: Tray Icon Not Appearing on macOS Dark Mode
**What goes wrong:** The tray icon appears fine in light mode but is invisible or incorrectly colored in dark mode.
**Why it happens:** The image is not marked as a template image, or the PNG uses colors other than black + alpha channel.
**How to avoid:** PNG must use ONLY black pixels with varying alpha (opacity) for the glyph shape. Call `setTemplateImage(true)` or use the `Template` filename suffix convention. macOS inverts template images automatically for dark menu bars.
**Warning signs:** Icon disappears when switching to dark mode, or appears as a solid colored rectangle.

### Pitfall 4: Stop-Square Icons Left in Active States
**What goes wrong:** One button still shows the old stop-square (`<rect>`) icon when active because the ICONS/CALL_ICONS object was not fully updated.
**Why it happens:** The `recording` key in `ICONS` and `CALL_ICONS` currently maps to a stop-square SVG. All three icon objects need updating.
**How to avoid:** Replace ALL active-state icon entries: `ICONS.recording` (eye-open), `CLIP_ICONS.monitoring` (clipboard-writing -- this one already has a checkmark variant), `CALL_ICONS.recording` (headphones-on). Remove the stop-square SVG entirely from the codebase.
**Warning signs:** A white square appears inside a teal button during recording.

### Pitfall 5: recalcHeight() Formula Mismatch
**What goes wrong:** The overlay height is wrong, causing buttons to be clipped or extra transparent space to appear.
**Why it happens:** The `recalcHeight()` function uses hardcoded values (`count * 64 + 8`) that need to change to `count * 44 + 4` per UI-SPEC. The mode picker height also changes from 108px to 78px.
**How to avoid:** Update both the per-button calculation and the mode-picker addition in `recalcHeight()`. Test with all visibility combinations: clipboard-only, clipboard+capture, clipboard+capture+call, and clipboard+capture+call+modepicker.
**Warning signs:** Buttons appear cut off at the bottom, or there is a large invisible gap below the last button.

### Pitfall 6: Badge Not Visible at Smaller Size
**What goes wrong:** The clipboard badge counter becomes unreadable or clips outside the button at 40px.
**Why it happens:** The badge was designed for 56px buttons with 20px diameter and -4px offset. At 40px, it needs scaling.
**How to avoid:** Per UI-SPEC: badge diameter 16px, font-size 9px, offset top: -2px, right: -2px. Verify "99+" still fits within the 16px circle.
**Warning signs:** Badge text overflows, or badge appears detached from the button.

### Pitfall 7: Tray Not Removed on Quit
**What goes wrong:** After the app quits, a ghost tray icon remains in the macOS menu bar until the user hovers over it.
**Why it happens:** The tray is not explicitly destroyed during the quit sequence.
**How to avoid:** In `app.on('before-quit')` or `app.on('will-quit')`, call `tray.destroy()` to clean up.
**Warning signs:** Orphaned tray icon persists after app closes.

### Pitfall 8: window-all-closed Still Shuts Down Backend
**What goes wrong:** Hiding the main window (not closing it) means `window-all-closed` should not fire during normal operation. However, the overlay window IS a BrowserWindow. If the overlay is closed/destroyed for any reason while the main window is hidden, `window-all-closed` fires and shuts down the backend.
**Why it happens:** Both mainWindow and captureOverlay are BrowserWindows. If both are gone (main hidden counts as still existing, but if main was destroyed rather than hidden, and overlay closes...), the handler fires.
**How to avoid:** The close intercept on mainWindow prevents destruction, so `window-all-closed` will not fire unless all windows are truly closed. Keep the existing `window-all-closed` handler as a safety net for edge cases (e.g., smoke test mode). Do NOT remove it.
**Warning signs:** Backend shuts down while the tray icon is still running.

## Code Examples

### New SVG Icon Paths for Eye-Closed (Screen Capture Idle)

```html
<!-- Eye-closed: eye with diagonal strike-through line -->
<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
<path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
<path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/>
<line x1="1" y1="1" x2="23" y2="23"/>
```
This is the standard Lucide `eye-off` path at 24x24 viewBox, rendered at 18x18 via the SVG element's width/height.

### New SVG Icon Paths for Headphones-Off (Call Idle)

```html
<!-- Headphones with diagonal strike-through -->
<path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
<path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
<line x1="1" y1="1" x2="23" y2="23"/>
```

### Tray Icon Loading from Pre-Rendered PNG

```javascript
// Source: Electron docs - https://www.electronjs.org/docs/latest/api/tray
function createTrayIcon(recording) {
  const iconName = recording ? 'trayRecTemplate' : 'trayTemplate';
  const iconPath = path.join(__dirname, '..', '..', 'resources', `${iconName}.png`);
  return nativeImage.createFromPath(iconPath);
}

function setupTray() {
  tray = new Tray(createTrayIcon(false));
  tray.setToolTip('Privanote Capture');
  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
  updateTray('idle');
}
```

### Minimize-to-Tray Close Intercept

```javascript
// Source: Electron docs - https://www.electronjs.org/docs/latest/api/browser-window
// In createWindow(), after mainWindow = win:
win.on('close', (event) => {
  if (!isQuitting) {
    event.preventDefault();
    win.hide();
    // On macOS, hide from dock when window is hidden (optional)
    // if (process.platform === 'darwin' && app.dock) app.dock.hide();
  }
});

// The existing win.on('closed') handler remains for cleanup after actual quit:
win.on('closed', () => { mainWindow = null; });
```

### Updated recalcHeight()

```javascript
function recalcHeight() {
  let count = 1; // clipboard always visible
  if (captureVisible) count++;
  if (callVisible) count++;
  let height = count * 44 + 4; // 40px button + 4px gap per button, plus 4px padding
  if (modePickerVisible) height += 78; // 2 * 34px + 6px gap + 4px spacing
  document.body.style.height = height + 'px';
  container.style.height = height + 'px';
  if (window.captureApi && window.captureApi.resizeOverlay) {
    window.captureApi.resizeOverlay(48, height);
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Emoji tray text (`tray.setTitle('...')`) | Template image PNG with `setTemplateImage(true)` | Electron 1.x (long established) | Proper dark/light mode support, professional appearance |
| Per-feature accent colors (red/blue/green) | Unified teal accent for all active states | This phase (D-08) | Cleaner visual language, icon shape differentiates features |
| Pulse ring animations for active state | Color change only | This phase (D-11) | Less visual noise at smaller 40px size |
| Stop-square icon for active state | Feature-specific active icon (eye-open, clipboard-writing, headphones-on) | This phase (D-04/05/06) | More informative, icon communicates what is active |

## Open Questions

1. **Tray icon PNG generation method**
   - What we know: Need 16x16 @1x and 32x32 @2x PNGs of a "P" lettermark, black on transparent, plus a recording variant with red dot
   - What's unclear: How to generate these PNGs without a designer. Options: (a) create programmatically using a Node script with Canvas/sharp, (b) use a minimal hand-crafted PNG via base64 embedding in code (like the current 1x1 transparent PNG), (c) create SVG and convert to PNG
   - Recommendation: Generate via a simple Node script using the `canvas` npm package (devDependency only) or embed as base64 constants directly in main.js (avoids file system dependency). The simplest approach is base64 embedding following the existing `createEmptyTrayImage()` pattern, but generating proper 16x16 and 32x32 PNGs with a legible "P" glyph programmatically is straightforward. Alternatively, create the PNGs as actual files in `apps/desktop/resources/` for clarity and @2x auto-detection by Electron's `createFromPath`.

2. **Dock icon visibility when minimized to tray**
   - What we know: Currently `app.dock.show()` is called on ready. When the window is hidden, the dock icon could optionally be hidden too.
   - What's unclear: Whether the user wants the dock icon to remain visible (allowing click to reopen) or disappear (tray-only presence).
   - Recommendation: Keep the dock icon visible. Hiding it would prevent standard macOS Alt-Tab switching to the app. The tray click handler (D-17) provides the alternative access point. This matches common macOS app behavior (e.g., Slack, Discord keep dock icons visible even when minimized to tray).

## Sources

### Primary (HIGH confidence)
- [Electron Tray API](https://www.electronjs.org/docs/latest/api/tray) - Template image requirements, click handler, icon sizes (16x16 @1x, 32x32 @2x)
- [Electron nativeImage API](https://www.electronjs.org/docs/latest/api/native-image) - createFromPath/createFromBuffer, setTemplateImage, template naming convention, @2x support
- [Electron BrowserWindow API](https://www.electronjs.org/docs/latest/api/browser-window) - close event, event.preventDefault(), hide/show methods
- Codebase: `apps/desktop/src/renderer/capture-overlay/capture-overlay.html` - Current overlay implementation (554 lines, all inline)
- Codebase: `apps/desktop/src/main/main.js` lines 329-374 - Current tray setup, `createEmptyTrayImage()`, `updateTray()`
- Codebase: `apps/desktop/src/main/main.js` lines 937-967 - Current `createWindow()` and close handler
- Codebase: `apps/desktop/src/main/main.js` lines 1042-1076 - Current `before-quit` and `window-all-closed` handlers
- Phase 11 UI-SPEC: `.planning/phases/11-.../11-UI-SPEC.md` - Exact dimensions, colors, formulas

### Secondary (MEDIUM confidence)
- [Electron minimize to tray pattern](https://copyprogramming.com/howto/how-to-make-electron-window-hide-on-close-and-quit-from-tray-menu-instead) - Community pattern verification for close intercept

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies; all APIs verified in Electron official docs and already used in codebase
- Architecture: HIGH - Single HTML file for overlay changes, single JS file for tray/lifecycle; patterns established in prior phases
- Pitfalls: HIGH - All pitfalls derived from direct codebase analysis of existing code that must change

**Research date:** 2026-04-01
**Valid until:** 2026-05-01 (stable -- Electron 28.3.3 is pinned, no API changes expected)
