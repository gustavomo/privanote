# Privanote

## What This Is

Privanote is a local-first monorepo that will contain a desktop frontend app and a backend service. The desktop app should let a single user record or import audio, video, and files, generate transcripts, and save everything locally first with optional sync to Google Drive or OneDrive. In v1 the backend ships locally with the desktop app; cloud deployment strategy is deferred to v2.

## Core Value

A user can capture and revisit media-backed notes locally, quickly, and without losing control of where their data lives.

## Requirements

### Validated

- ✓ User can create, select, edit, and delete note nodes in the desktop UI — existing
- ✓ User can add and remove local audio, video, and generic file attachments through a native file picker — existing
- ✓ User data persists locally through SQLite and an Electron main-process IPC boundary — existing

### Active

- [ ] Restructure the project into a monorepo that contains the desktop frontend and backend service
- [ ] Stabilize startup, storage, and deletion behavior so the local-first workflow is reliable
- [ ] Add audio and video recording plus import flows and save the resulting media through the backend
- [ ] Add configurable transcription that can run locally or through the backend depending on settings
- [ ] Add local-first storage settings with optional Google Drive and OneDrive sync
- [ ] Add automated regression coverage across frontend, backend, recording, transcription, and storage flows

### Out of Scope

- User accounts, sign-in, or verification in v1 — the app is single-user for the first release
- Hosted or cloud-deployed backend in v1 — deployment strategy is intentionally deferred to v2
- Real-time collaboration or shared multi-user workspaces — the current product remains a personal/local workflow
- Web and mobile clients — current scope is the desktop app plus its local backend
- Advanced media editing or transcoding — capture, transcript, save, and sync matter before editing workflows

## Context

Privanote is being initialized as a brownfield project. The existing codebase already establishes an Electron `main` / `preload` / React `renderer` split, persists node and attachment data with `better-sqlite3`, and exposes CRUD operations over IPC. The codebase map in `.planning/codebase/` documents that baseline and surfaced current risks, including a startup syntax bug in `src/main/main.js`, missing SQLite foreign-key enforcement in `src/main/database.js`, and absent automated tests.

The clarified product direction extends that baseline substantially: the repo should become a monorepo with frontend and backend, the backend should run locally in v1, storage should remain local-first with optional Google Drive or OneDrive sync, and the app should support both recording and importing media. Transcription should be configurable so it can run locally or via the backend depending on user settings.

## Constraints

- **Monorepo structure**: The repo must evolve into a monorepo containing the desktop frontend and backend — this is now part of the product definition
- **Brownfield migration**: Existing Electron desktop code must be migrated into the new structure without losing current functionality — the repo already has working note and attachment flows to preserve
- **Backend deployment**: The backend runs locally in v1 and ships with the app — hosted/cloud deployment is a later decision
- **Local-first behavior**: User data must remain understandable and controllable on disk — this is central to the product's value proposition
- **No auth in v1**: The first release should work without accounts or verification — keep flows single-user and direct
- **Configurable transcription**: The system must support local or backend transcription modes through settings — exact implementation can be decided during Phase 1
- **Reliability**: Current startup and data-integrity issues must be corrected early — existing code has blocking defects that would undermine new features

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Re-scope the project as a monorepo with frontend and backend | The product now explicitly requires both desktop UI and backend responsibilities in one repo | — Pending |
| Run the backend locally in v1 | The first release should work fully on-device before deciding cloud deployment | — Pending |
| Keep the product local-first and single-user in v1 | The app should work without authentication or verification in the first release | — Pending |
| Support both recording and importing media | The capture workflow must handle new recordings and existing files | — Pending |
| Support both local and backend transcription modes | Transcription should be configurable through settings instead of locked to one execution path | — Pending |
| Scope cloud work around optional storage sync, not mandatory cloud storage | Local storage remains primary while Google Drive and OneDrive are optional destinations | — Pending |
| Defer hosted backend deployment decisions to v2 | Deployment strategy is intentionally postponed until the local product shape is validated | — Pending |

## Current State

Phase 11 complete (2026-04-01) — overlay buttons polished to 40px with teal active color, idle/active icon state pairs (eye, clipboard, headphones), pulse animations removed, emoji tray replaced with monochrome macOS template icon (P lettermark with recording red dot), and minimize-to-tray behavior added. All milestone phases complete.

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
*Last updated: 2026-04-01 after Phase 7 completion*
