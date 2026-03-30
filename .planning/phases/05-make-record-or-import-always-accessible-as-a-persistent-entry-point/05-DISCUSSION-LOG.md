# Phase 5: Make record or import always accessible - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-30
**Phase:** 05-make-record-or-import-always-accessible-as-a-persistent-entry-point
**Areas discussed:** Primary flow direction, Create Note form, Entry point placement, Post-capture behavior, In-note capture panel, Note detail editing

---

## Primary flow direction

| Option | Description | Selected |
|--------|-------------|----------|
| Capture-first | Note is a result of recording/import, not a prerequisite | ✓ |

**User's choice:** Capture first. The user stated: "what I want is the option to start is not create a note, the note is after the record/import. So the form to create a note doesn't make sense, instead make it to start or import a record."

---

## Create Note form

| Option | Description | Selected |
|--------|-------------|----------|
| Remove it entirely | Notes only exist as a result of capture. No free-form note creation form. | ✓ |
| Keep it but demote it | Form stays for text-only notes, moved to a secondary location. | |
| Keep it as-is, add capture shortcut separately | Add persistent Record/Import button, leave form where it is. | |

**User's choice:** Remove entirely.

---

## Post-capture behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-title from capture, go straight to note | Auto-create note with generated title, navigate to note detail immediately. | ✓ |
| Ask for a title before saving | Title input appears before saving. | |
| Just save silently, no navigation | Note created in background, user stays on current screen. | |

**User's choice:** Auto-title from capture, navigate to created note.

---

## Entry point placement

| Option | Description | Selected |
|--------|-------------|----------|
| Full-width capture panel at top of workspace | Capture panel at top of sidebar, always visible, notes list below. | ✓ |
| Floating action button (FAB) | Persistent circular button floating over content. | |
| Prominent button in app header | Button in header row next to Workspace/Settings toggle. | |

**User's choice:** Full-width capture panel at top of workspace sidebar.

---

## In-note capture panel

| Option | Description | Selected |
|--------|-------------|----------|
| Keep in-note capture panel too | Persistent entry point for new notes, in-note panel for adding to existing notes. | |
| Remove in-note capture panel | All capture via global entry point only. | ✓ |

**User's choice:** Remove. User stated: "the user can import or start a record, when the note is created, don't need to add more because it's already inside the note just created."

---

## Note detail editing

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — editable title/description after capture | Note detail shows editable fields post-capture for renaming/annotating. | ✓ |
| Title only editable | Simplified to just title editing. | |
| You decide | Claude handles note detail editing. | |

**User's choice:** Full editable note detail (title + description) remains intact.

---

## Claude's Discretion

- Exact capture panel styling and height in sidebar position
- Mode selector (Audio/Video/Video+Audio) layout in sidebar
- Auto-title format and timestamp style
- Tags field retention in note detail

## Deferred Ideas

- Adding multiple media items to an existing note — not the use case for this phase
- "Fix UI issues" todo — requires a separate audit pass, too generic for Phase 5
