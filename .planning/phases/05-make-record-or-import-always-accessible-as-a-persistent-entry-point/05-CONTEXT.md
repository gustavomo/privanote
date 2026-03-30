# Phase 5: Make record or import always accessible as a persistent entry point - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Restructure the workspace UX so that recording and importing are the primary entry points to the app. Notes are created as a result of a capture, not as a prerequisite. The "Create Note" form is removed. The capture panel moves to a persistent, always-visible position at the top of the workspace sidebar so users can start recording or import from anywhere without first navigating to a specific note.

This phase covers:
- Removing the "Create Note" form from the sidebar
- Repositioning the capture panel as the top-of-sidebar persistent action
- Post-capture note auto-creation and immediate navigation to the created note
- Removing the in-note capture panel (capture is now only via the global entry point)
- Keeping the note detail editing surface (title, description, tags) intact for post-capture annotation

Out of scope: adding media to an already-existing note, note creation without a media capture.

</domain>

<decisions>
## Implementation Decisions

### Primary Flow Direction
- **D-01:** The creation flow is capture-first. A note is a result of a recording or import, not a prerequisite. Users do not create a note before capturing — they capture, and the note is created automatically.

### Create Note Form
- **D-02:** Remove the "Create Note" form (title + description + tags input fields + "Create Note" button) from the sidebar entirely. Notes are only created as a by-product of a recording or import.

### Capture Panel Placement
- **D-03:** The capture panel becomes the top section of the workspace sidebar, above the notes list. It is always visible in workspace view without requiring a selected note.
- **D-04:** The layout remains the same two-column grid (sidebar + note detail panel). The sidebar changes its content: capture panel at top, notes list below. The right panel still shows note detail when a note is selected.

### Post-Capture Behavior
- **D-05:** After a recording is saved or a file is imported, Privanote auto-creates a note with a generated title (e.g. "Audio note — 3:45 PM"), saves the media, and immediately navigates to the created note's detail view.
- **D-06:** No title prompt before saving. The auto-title is applied immediately; the user can rename from the note detail view after the note is created.

### In-Note Capture Panel
- **D-07:** Remove the inline capture panel that currently appears inside the note detail view. Capture now only happens from the persistent top-of-sidebar entry point. Once a note exists with its media attached, no secondary capture surface is needed inside the note.

### Note Detail Editing
- **D-08:** The note detail view retains the full editable title, description, and tags fields. After capture creates a note automatically, the user can rename it and add description/tags from the detail view.

### Claude's Discretion
- Exact height, padding, and styling of the capture panel in the sidebar position.
- Whether the mode selector (Audio / Video / Video + Audio) appears inline in the sidebar panel or in an expanded area.
- Whether to show the notes list label/count before or after the capture panel.
- Exact auto-title format (pattern, timestamp style) — the current `createPlaceholderTitle` function can be reused or adjusted.
- Tags field retention in note detail (can keep or remove at Claude's discretion based on what fits the capture-first UX).

### Folded Todos
- **Todo: "Make record or import always accessible"** — This todo is the direct description of Phase 5 scope. The problem (entry point not persistently available) and solution (persistent capture action reachable from anywhere) are fully captured in D-01 through D-07 above.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Scope and Product Constraints
- `.planning/ROADMAP.md` — Phase 5 goal and context
- `.planning/PROJECT.md` — Product-level constraints: local-first, single-user, no auth in v1, core value of quick local capture
- `.planning/REQUIREMENTS.md` — Phase 5 has no formal REQ-IDs yet (TBD in roadmap), but the capture-first UX aligns with CAP-01 through CAP-05

### Prior Locked Decisions That Still Apply
- `.planning/phases/01-monorepo-and-local-backend-foundation/01-CONTEXT.md` — Architectural rules: separate desktop/backend packages, backend-owned contracts, backend-agnostic desktop
- `.planning/phases/02-capture-and-save-flows/02-CONTEXT.md` — Locked capture/import and media-presentation decisions, note-owned media model, `saveRecording` and `importMedia` API contracts
- `.planning/phases/04-optional-cloud-sync/04-CONTEXT.md` — Sync badge behavior and media card patterns that must coexist with the repositioned capture panel

### Existing Code to Read Before Modifying
- `apps/desktop/src/renderer/App.jsx` — Contains the full workspace layout, `renderCapturePanel()`, the "Create Note" form, sidebar notes list, and the two-view shell. This is the primary file for Phase 5 changes.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `renderCapturePanel()` in `App.jsx` — Self-contained capture panel function that handles all modes (audio/video/video+audio), recording states (idle/recording/stopping/review), and the import flow. Will move to the top of the sidebar rather than being conditionally rendered inside note detail.
- `ensureCaptureNode()` in `App.jsx` — Already handles auto-creating a note when no note is selected. Behavior should be preserved: when the user saves a recording/import, a note is auto-created.
- `createPlaceholderTitle()` in `App.jsx` — Generates timestamped note titles from capture mode. Can be reused for the auto-title post-capture.
- `MediaCard.jsx` — Existing saved-media card used in note detail. Not changed by Phase 5.
- `TranscriptSection.jsx` — Existing transcript section in note detail. Not changed by Phase 5.

### Established Patterns
- The workspace uses a `lg:grid-cols-[minmax(320px,380px)_minmax(0,1fr)]` two-column grid. Phase 5 keeps this layout; only the sidebar content changes.
- `activeView` state switches between `'workspace'` and `'settings'`. Phase 5 does not add a new view — the persistent capture lives within workspace.
- Note detail panel currently renders: note header → edit form → capture panel → transcript section → saved media. Phase 5 removes the capture panel from this sequence.

### Integration Points
- The sidebar `<aside>` currently renders: heading + note count → "Create Note" form → notes list. Phase 5 changes this to: capture panel → notes list (no form).
- The right-panel `<section>` currently conditionally renders the capture panel when `!selectedNode`. Phase 5 removes this conditional render — the capture panel is no longer in the right panel at all.
- `handleStartRecording`, `handleStopRecording`, `handleSaveRecording`, `handleDiscardRecording`, `handleImportFiles` are all existing handlers that remain in scope. Their logic does not change.

</code_context>

<specifics>
## Specific Ideas

- "the note is after the recording or import" — The capture creates the note, not the other way around.
- "the form to create a note doesn't make sense" — The Create Note form is to be removed, not just de-emphasized.
- "once the note is created, don't need to add more because it's already inside the note just created" — The in-note capture panel is not needed post-Phase 5.

</specifics>

<deferred>
## Deferred Ideas

- Adding multiple media items to an existing note (user indicated this is not the use case they're optimizing for in this phase).
- "Fix UI issues" todo (area: ui, score 0.3) — Too generic for this phase; requires a separate audit pass.

</deferred>

---

*Phase: 05-make-record-or-import-always-accessible-as-a-persistent-entry-point*
*Context gathered: 2026-03-30*
