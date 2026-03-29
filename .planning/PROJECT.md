# Privanote

## What This Is

Privanote is a local-first Electron desktop app for managing content nodes with attached files, audio, and video. It stores note and attachment metadata in SQLite on the user's machine and uses a React renderer with a preload-backed IPC boundary for native desktop actions. The current brownfield scope extends the existing local attachment workflow toward in-app media handling and optional cloud-backed attachment providers.

## Core Value

A user can capture and revisit media-backed notes locally, quickly, and without losing control of where their data lives.

## Requirements

### Validated

- ✓ User can create, select, edit, and delete note nodes in the desktop UI — existing
- ✓ User can add and remove local audio, video, and generic file attachments through a native file picker — existing
- ✓ User data persists locally through SQLite and an Electron main-process IPC boundary — existing

### Active

- [ ] Stabilize startup, storage, and deletion behavior so the current desktop workflow is reliable
- [ ] Add in-app preview and playback for local attachments
- [ ] Add Google Drive and OneDrive support for cloud-backed attachments
- [ ] Add settings for storage directories and provider credentials
- [ ] Add automated regression coverage for startup, database, and attachment flows

### Out of Scope

- Real-time collaboration or shared multi-user workspaces — the current product is a single-user local desktop app
- Web and mobile clients — the current codebase and roadmap are centered on Electron desktop delivery
- Full cloud sync of the notes database — current scope is cloud-backed attachments, not full multi-device note synchronization
- Advanced media editing or transcoding — preview and playback matter before authoring workflows

## Context

Privanote is being initialized as a brownfield project. The existing codebase already establishes an Electron `main` / `preload` / React `renderer` split, persists node and attachment data with `better-sqlite3`, and exposes CRUD operations over IPC. The codebase map in `.planning/codebase/` documents that baseline and surfaced current risks, including a startup syntax bug in `src/main/main.js`, missing SQLite foreign-key enforcement in `src/main/database.js`, and absent automated tests.

The repository's current direction is explicit in `README.md`: next milestones are Google Drive / OneDrive connector adapters, attachment preview and media playback, and configurable storage directories plus provider credentials in Settings. Those milestones are treated as the active product scope for this initialization.

## Constraints

- **Tech stack**: Electron 28, React 18, Vite, and `better-sqlite3` — the current application architecture is already built around these choices
- **Brownfield architecture**: Preserve the Electron main/preload/renderer split — the existing IPC boundary is the core structural pattern in the repo
- **Local-first behavior**: User data must remain understandable and controllable on disk — this is central to the product's value proposition
- **Reliability**: Current startup and data-integrity issues must be corrected early — existing code has blocking defects that would undermine new features
- **Desktop focus**: New work should optimize the Electron desktop experience first — there is no server or alternate client platform in the repo today

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Initialize as a brownfield desktop app rather than a greenfield idea | Existing code and a fresh codebase map provide a concrete starting point | — Pending |
| Treat README milestones as the active project scope | They are the only explicit next-product statements checked into the repo | — Pending |
| Keep the product local-first and single-user in v1 | The current architecture and core value are centered on local control and desktop workflows | — Pending |
| Prioritize foundation fixes before broader feature expansion | Startup and data-integrity bugs would invalidate work built on top of them | — Pending |
| Scope cloud work around attachment providers, not full database sync | The current roadmap intent mentions provider-backed attachments rather than multi-device sync | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `$gsd-transition`):
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via `$gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check -> still the right priority?
3. Audit Out of Scope -> reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-28 after initialization*
