---
phase: 01-monorepo-and-local-backend-foundation
plan: 02
subsystem: api
tags: [fastify, sqlite, electron, lifecycle, storage]
requires:
  - phase: 01-01
    provides: workspace split, migrated desktop shell, backend-owned contract surface
provides:
  - Fastify local backend service with health and note/attachment routes
  - app-owned data-root resolution with managed attachment cleanup
  - desktop child-process launcher and backend HTTP proxy
affects: [packaging, testing, capture, transcription]
tech-stack:
  added: [fastify]
  patterns: [backend child-process launch, contract-aware http proxy, sqlite trigger cleanup]
key-files:
  created:
    - apps/backend/src/server.js
    - apps/backend/src/routes/nodes.js
    - apps/backend/src/routes/attachments.js
    - apps/backend/src/storage/runtime-paths.js
    - apps/desktop/src/main/backend-process.js
  modified:
    - apps/backend/package.json
    - apps/backend/src/index.js
    - apps/backend/src/storage/database.js
    - apps/desktop/src/main/main.js
    - package-lock.json
key-decisions:
  - "Run the local backend as a child process and wait for /health before creating the desktop window."
  - "Resolve persistent storage from PRIVANOTE_DATA_DIR and keep managed attachments under ${dataRoot}/attachments."
  - "Use a SQLite delete trigger backed by a custom function so cascades clean up managed files even on raw deletes."
patterns-established:
  - "Backend runtime pattern: Fastify routes call service modules, which depend on a shared SQLite connection."
  - "Desktop transport pattern: preload stays on createBackendClient while main proxies contract operations over HTTP."
requirements-completed: [PLAT-02, PLAT-04, PLAT-05]
duration: 4min
completed: 2026-03-29
---

# Phase 01: Monorepo and Local Backend Foundation Summary

**Fastify local backend with app-owned SQLite storage and desktop lifecycle wiring to a spawned child process**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-29T21:29:33-05:00
- **Completed:** 2026-03-29T21:33:06-05:00
- **Tasks:** 3
- **Files modified:** 13

## Accomplishments

- Added a real backend package runtime with `/health` and note/attachment routes around the v1 contract.
- Moved persistence to an app-owned storage root resolved from `PRIVANOTE_DATA_DIR` and enabled managed-file cleanup through SQLite-triggered deletes.
- Rewired the desktop main process to spawn the backend, wait on health, and proxy renderer calls through the backend transport boundary.

## Task Commits

Each task was committed atomically:

1. **Task 1: Build the local backend service around the v1 contract** - `757e646` (`feat`)
2. **Task 2: Move persistence into an app-owned storage root with deletion-safe cleanup** - `c154313` (`feat`)
3. **Task 3: Wire the desktop lifecycle to launch, wait for, and stop the local backend** - `da04776` (`feat`)

**Plan metadata:** pending final completion commit

## Files Created/Modified

- `apps/backend/src/server.js` - Fastify server with `/health` plus contract-backed route registration
- `apps/backend/src/services/nodes-service.js` - note CRUD lifted out of the legacy Electron-side database module
- `apps/backend/src/services/attachments-service.js` - attachment CRUD and validation for the backend runtime
- `apps/backend/src/storage/runtime-paths.js` - `PRIVANOTE_DATA_DIR` data-root and managed attachments resolution
- `apps/backend/src/storage/database.js` - SQLite initialization with `foreign_keys = ON` and delete cleanup trigger
- `apps/desktop/src/main/backend-process.js` - child-process launcher and health polling for the local backend
- `apps/desktop/src/main/main.js` - desktop lifecycle orchestration and backend HTTP proxy

## Decisions Made

- Kept the renderer API stable by leaving preload on `createBackendClient` while shifting the actual transport hop into the Electron main process.
- Used `process.execPath` plus `ELECTRON_RUN_AS_NODE=1` to launch the backend, which keeps the development and future packaged launch paths aligned.
- Put managed-file cleanup in the persistence layer via a SQLite trigger so note cascades and direct attachment deletes both remove app-owned files safely.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Localhost port binding is blocked inside the sandbox, so `/health` verification had to be rerun with escalation. The backend code itself did not need changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `01-03` can package the desktop and spawned backend together without changing the transport boundary again.
- Backend startup, storage-root handling, and delete cleanup are now concrete enough to support regression tests and packaged smoke checks.

---
*Phase: 01-monorepo-and-local-backend-foundation*
*Completed: 2026-03-29*
