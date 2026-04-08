---
quick_id: 260408-7nz
description: Add loading states and animations to all action buttons
status: completed
date: 2026-04-08
branch: claude/animated-avatar-KvG0g
---

# Quick Task 260408-7nz — Summary

## What changed

**Button component (`apps/desktop/src/renderer/components/ui/button.jsx`)**
- New props: `loading` (bool), `loadingText` (optional string)
- When `loading=true`: button gets `disabled`, `aria-busy`, `button-loading` class; a spinning `Loader2` (lucide-react) prepended with a fade-in/zoom-in entrance animation (via `motion-safe:animate-in fade-in zoom-in-50`)
- `active:not-aria-[haspopup]:scale-[0.98]` added to base class for subtle press feedback
- `asChild` mode passes through (needed for AlertDialogTrigger — children shape is not controlled by us)

**App.jsx — new loading states wired**
- New states: `isStartingRecording`, `isDiscardingRecording`, `isImporting`, `isDeletingNode`, `isSavingNode`, `isRetryingTranscript`, `attachmentPending` (per-id map of 'retry'|'open'|'remove')
- Handlers wrapped with `setIsXxx(true)` on entry and `setIsXxx(false)` in a `finally` block — no business logic touched
- `handleOpenAttachment` signature: `(localPath)` → `(attachmentId, localPath)` so the parent can mark the specific attachment pending
- Helper `setAttachmentPendingAction(id, action|null)` added to mutate the pending map immutably
- Every actionable Button in App.jsx now has `loading={...}`:
  - Save Recording / Discard Recording (separate states)
  - Stop Recording (existing `isStopping`)
  - Start Recording / Import Files (mutually exclusive disable)
  - Delete Note (AlertDialog trigger + confirm both disabled while deleting)
  - Save Changes (form submit)

**settings-view.jsx**
- Connect/Disconnect provider, Choose Folder, Save Settings all receive `loading={isSaving}` alongside their existing `disabled` guard
- Clear Credential (sync) left untouched — no spinner needed

**media-card.jsx**
- New `pendingAction` prop (`'retry'|'open'|'remove'|undefined`)
- Retry Sync, Open File, Remove Media (trigger) each show loading when they match; all three are disabled while any is pending
- AlertDialog Cancel/confirm also disabled during remove

**transcript-section.jsx**
- New `isRetrying` prop (defaulting to `false`)
- Regenerate Transcript + Retry Transcript both receive `loading={isRetrying}`

**index.css**
- `[data-slot="button"].button-loading > svg:not(.button-spinner) { display: none }` — hides the original icon so the spinner visually replaces it, text stays
- `@media (prefers-reduced-motion: reduce)` block: disables button transitions/transforms and slows `.animate-spin` to 3s per rotation (avoids full motion suppression which would make spinners look frozen)

## Files changed

1. `apps/desktop/src/renderer/components/ui/button.jsx`
2. `apps/desktop/src/renderer/App.jsx`
3. `apps/desktop/src/renderer/components/settings-view.jsx`
4. `apps/desktop/src/renderer/components/media-card.jsx`
5. `apps/desktop/src/renderer/components/transcript-section.jsx`
6. `apps/desktop/src/renderer/index.css`

## Verification notes

- `npm run build` could not be executed — `node_modules` not installed in sandbox.
- Manual verification done via grep + read: all `setIsXxx(true/false)` pairs present, all JSX `loading={...}` props reference declared states, `handleOpenAttachment` signature change has only one caller (already updated), `setAttachmentPendingAction` hoisted correctly (function declaration inside component).
- Zero new dependencies. `Loader2` and `animate-spin` already available.

## GSD workflow note

The `gsd-planner` subagent was spawned first but got stuck in a `max_tokens` loop on its `Write` tool call (repeatedly producing >8000 output tokens without a `content` parameter). The orchestrator took over and produced a lean `PLAN.md` inline, then executed the plan. This SUMMARY.md documents the final state for STATE.md tracking.
