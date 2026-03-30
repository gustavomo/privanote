# Phase 2: Capture and Save Flows - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md; this log preserves the alternatives considered.

**Date:** 2026-03-29
**Phase:** 02-capture-and-save-flows
**Areas discussed:** Capture entry and note association, Recording review lifecycle, Import storage ownership, Saved media presentation, Combined capture shape, Auto-created note defaults, Permission and device failure behavior, Review and playback controls

---

## Capture Entry and Note Association

### Q1. Capture/import entry point

| Option | Description | Selected |
|--------|-------------|----------|
| From inside a selected note only | Recording/import actions live in the current note's attachment area and save into that note flow directly. | |
| From a global capture action, then choose the note afterward | Better for quick capture, but introduces an unassigned-media state this phase doesn't have yet. | |
| Hybrid | Allow both note-first capture and a global capture entry. | |
| Freeform | The user can start recording audio, video, or both, and this by default will be a note. | ✓ |

**User's choice:** "the user can start recording audio video or both and this by default will be a note"
**Notes:** Interpreted as capture not requiring an existing selected note and defaulting to automatic creation of a new owning note.

### Q2. Import without a selected note

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-create a new note | Import with no selected note creates a new owning note automatically. | ✓ |
| Require selecting a note first | Import is blocked until the user selects an existing note. | |
| Prompt to choose or create a note | Import begins with an ownership chooser step. | |

**User's choice:** Yes, import should behave the same way.
**Notes:** Import inherits the same auto-create-note default as recording.

---

## Recording Review Lifecycle

### Q1. Behavior after recording stops

| Option | Description | Selected |
|--------|-------------|----------|
| Review before save | After stopping, show the captured media in a temporary review state with `Save` or `Discard`. | ✓ |
| Save immediately | Stopping the recording persists it right away with no review step. | |
| Save immediately, but allow delete afterward | Faster capture flow, with cleanup handled after the media is already attached to the new note. | |

**User's choice:** `Review before save`
**Notes:** Recording should not persist until the user confirms in review.

---

## Import Storage Ownership

### Q1. How imported media should be stored

| Option | Description | Selected |
|--------|-------------|----------|
| Copy imports into app-managed storage | Strongest relaunch reliability and keeps the local backend in control of persisted media. | ✓ |
| Keep the original external path only | Simpler import, but attachments break if the source file moves or disappears. | |
| Ask each time | More flexible, but adds storage-choice UI earlier than Phase 3 settings. | |

**User's choice:** `Copy imports into app-managed storage`
**Notes:** Media persistence should rely on app-owned storage, not external-path references.

---

## Saved Media Presentation

### Q1. How saved media appears in the workspace

| Option | Description | Selected |
|--------|-------------|----------|
| Rich media cards with basic preview/play for audio and video, simple file cards for other files | Best fit for a capture app, while still keeping generic files simple. | ✓ |
| Simple attachment rows only | Lowest scope, but weak for recorded media because users can't meaningfully review what they captured. | |
| Rich cards for everything | Stronger visual surface, but too much UI scope for generic files in this phase. | |

**User's choice:** `Rich media cards with basic preview/play for audio and video, simple file cards for other files`
**Notes:** Recorded/imported media should feel more like capture artifacts than plain path rows.

---

## Combined Capture Shape

### Q1. What "both" means

| Option | Description | Selected |
|--------|-------------|----------|
| One video attachment with audio included | Standard camera recording behavior and the simplest review/save model. | ✓ |
| Two separate attachments: one audio, one video | More flexible later, but introduces splitting and dual-save behavior now. | |
| Let the user choose at capture time | Flexible, but adds capture-mode complexity to Phase 2. | |

**User's choice:** `One video attachment with audio included`
**Notes:** "Both" should not introduce multiple saved artifacts in Phase 2.

---

## Auto-created Note Defaults

### Q1. Initial note content for auto-created notes

| Option | Description | Selected |
|--------|-------------|----------|
| Generated placeholder title based on type and time | Example: `Audio note - Mar 29, 10:42 PM` or `Imported media - Mar 29, 10:42 PM`. | ✓ |
| Blank title until the user renames it | Cleaner, but conflicts with the current note model that expects a valid title. | |
| Ask for a title before capture/import starts | More deliberate, but adds friction to quick capture. | |

**User's choice:** `Generated placeholder title based on type and time`
**Notes:** The auto-created note should be immediately valid, then editable later.

---

## Permission and Device Failure Behavior

### Q1. Behavior when capture access fails

| Option | Description | Selected |
|--------|-------------|----------|
| Show a clear inline error in the capture area and let the user retry or switch to import | Keeps the rest of the note flow working and avoids modal dead-ends. | ✓ |
| Show a blocking modal and stop the flow | More forceful, but heavier and more disruptive. | |
| Fall back silently to import only | Lower friction, but unclear and potentially confusing. | |

**User's choice:** `Show a clear inline error in the capture area and let the user retry or switch to import`
**Notes:** Capture failures should not break the broader note workflow.

---

## Review and Playback Controls

### Q1. Scope of review/playback controls in Phase 2

| Option | Description | Selected |
|--------|-------------|----------|
| Basic controls only | Review: play/pause plus `Save` / `Discard`. Saved cards: basic preview/play and remove/open behavior. | ✓ |
| Add trimming or retake tools in review | Stronger capture UX, but that's a separate editing capability. | |
| Add waveform/timeline scrubbing and richer controls | Useful, but too much UI and media-state scope for this phase. | |

**User's choice:** `Basic controls only`
**Notes:** Phase 2 should stop at capture/save/revisit, not media editing.

## the agent's Discretion

- Exact placeholder-title format string
- Exact layout and visual styling of the capture/review surface
- File naming and managed-storage layout details
- Exact metadata shown on saved media cards beyond basic preview/play

## Deferred Ideas

None.

---

*Phase: 02-capture-and-save-flows*
*Discussion log generated: 2026-03-29*
