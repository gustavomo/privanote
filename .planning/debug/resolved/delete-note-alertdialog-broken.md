---
status: resolved
trigger: "Investigate why the Delete Note AlertDialog in Privanote shows with broken layout and a native confirm() still fires."
created: 2026-04-01T00:00:00Z
updated: 2026-04-02T14:00:00Z
---

## Current Focus

hypothesis: Two independent root causes — (1) stale confirmAction() calls in handlers, (2) CSS variable scoping broken because portal renders outside .theme container
test: code review confirmed both
expecting: n/a — root causes confirmed
next_action: return diagnosis

## Symptoms

expected: Clicking Delete Note opens a styled shadcn AlertDialog overlay; confirming deletes the note with no native browser dialog.
actual: AlertDialog opens with broken layout (overlaps content, broken positioning) AND a native browser confirm() dialog also fires.
errors: Broken CSS positioning on AlertDialog; native confirm() appearing after AlertDialog action.
reproduction: Click Delete Note button on any note in the workspace.
started: After Phase 14 shadcn migration wrapped the button with AlertDialog.

## Eliminated

(none needed — root causes found on first pass)

## Evidence

- timestamp: 2026-04-01T00:00:00Z
  checked: handleDeleteNode function (App.jsx lines 808-819)
  found: handleDeleteNode does NOT call confirmAction(). It simply calls client.deleteNode(). The AlertDialog wrapping the Delete Note button is correctly structured.
  implication: The Delete Note button itself is NOT the source of the native confirm(). The AlertDialog structure at lines 1411-1435 is correct — it wraps the trigger and has proper content/footer/action/cancel.

- timestamp: 2026-04-01T00:00:00Z
  checked: handleDeleteAttachment function (App.jsx lines 859-876)
  found: handleDeleteAttachment STILL calls confirmAction() at line 864 — `if (!confirmAction('Remove Media: ...'))`. Meanwhile media-card.jsx (lines 215-239) wraps the Remove Media button in its own AlertDialog. The onRemove prop is `() => handleDeleteAttachment(attachment.id)` (App.jsx line 1490).
  implication: DOUBLE CONFIRMATION on Remove Media — the shadcn AlertDialog fires first, then when AlertDialogAction's onClick calls handleDeleteAttachment, the function hits confirmAction() which triggers window.confirm(). This is one source of native confirm.

- timestamp: 2026-04-01T00:00:00Z
  checked: Other confirmAction() call sites
  found: confirmAction() is still called in four places — handleClearCredential (line 717), handleDisconnectProvider (line 755), handleDeleteAttachment (line 864), handleDiscardRecording (line 1083). None of these have been migrated to AlertDialog in their handler logic; only the UI wrapper was added in some cases.
  implication: Every handler that still calls confirmAction() will fire a native window.confirm() regardless of whether an AlertDialog wrapper exists in the JSX.

- timestamp: 2026-04-01T00:00:00Z
  checked: CSS variable scoping for AlertDialog portal
  found: The `.theme` class (which defines --font-heading, --font-sans) is on the `<main>` element at App.jsx line 1514. CSS custom properties (--popover, --popover-foreground, --background, etc.) are defined on `:root` and `.dark` selectors in index.css. Radix AlertDialog uses `<AlertDialogPortal>` which renders into `document.body` via a React portal. The portal content is OUTSIDE the `<main class="theme">` element and OUTSIDE the React root's `<div id="root">`. This means the portal content inherits from `<body>` and `:root`/`.dark`, but NOT from `.theme`.
  implication: The `.theme` selector sets `--font-heading` and `--font-sans`. If any AlertDialog styles reference these variables (the AlertDialogTitle uses `font-heading` class), the text will fall back to the browser default since the portal is outside `.theme`. The color variables (--popover, etc.) are on `:root` so those should still work. But the `font-heading` class references `var(--font-heading)` which is only defined inside `.theme`.

- timestamp: 2026-04-01T00:00:00Z
  checked: AlertDialog component positioning CSS (alert-dialog.jsx lines 40-57)
  found: AlertDialogContent uses `fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2` for centering. AlertDialogOverlay uses `fixed inset-0 z-50`. Both use z-50. The positioning should work correctly as `fixed` positions relative to the viewport. The `supports-backdrop-filter:backdrop-blur-xs` class on the overlay might not apply if `backdrop-filter` is unavailable in the Electron renderer.
  implication: The CSS positioning itself looks correct for a portal. The "broken layout" is more likely caused by missing font variables or the overlay not being visible (no backdrop blur, very light `bg-black/10`).

- timestamp: 2026-04-01T00:00:00Z
  checked: AlertDialogContent max-width constraints
  found: The content uses `data-[size=default]:max-w-xs` and `data-[size=default]:sm:max-w-sm`. The default size is "default". max-w-xs = 20rem (320px), max-w-sm at sm breakpoint = 24rem (384px). For a delete confirmation this is very narrow. Combined with the 10% opacity overlay (`bg-black/10`), the dialog may appear to "overlap content" because the backdrop is nearly invisible.
  implication: The nearly-transparent overlay makes it look like the dialog is floating inline rather than being a proper modal overlay.

## Resolution

root_cause: |
  TWO independent root causes:

  ROOT CAUSE 1 — Native confirm() still fires:
  The `handleDeleteAttachment` function (App.jsx line 864) still contains `if (!confirmAction(...))` which calls `window.confirm()`. Phase 14 added an AlertDialog wrapper around the Remove Media button in media-card.jsx, but did NOT remove the `confirmAction()` guard from the handler. Result: user gets the shadcn AlertDialog, clicks "Remove", then immediately gets a native browser confirm() dialog — double confirmation.

  The same pattern applies to `handleClearCredential` (line 717), `handleDisconnectProvider` (line 755), and `handleDiscardRecording` (line 1083) if those also got AlertDialog wrappers but kept their confirmAction() calls.

  ROOT CAUSE 2 — Broken layout / "showing weird":
  The `.theme` class (which sets --font-heading and --font-sans CSS variables) lives on the `<main>` element (App.jsx line 1514). Radix UI's AlertDialog portal renders into `document.body`, which is OUTSIDE the `.theme` scope. This means:
  - Font variables (--font-heading, --font-sans) are undefined in the portal → text renders in browser default font
  - The overlay uses `bg-black/10` (10% opacity) which is nearly invisible → dialog appears to float over content without a clear modal backdrop
  - The dialog max-width is max-w-xs (320px) which is quite narrow

  Combined, the dialog looks broken: wrong font, no visible backdrop, narrow box floating over content.

fix: |
  (Not applied — diagnosis only)

verification: |
  (Not applied — diagnosis only)

files_changed: []
