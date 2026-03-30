# Phase 1: Monorepo and Local Backend Foundation - Research

**Researched:** 2026-03-28
**Scope:** Phase 1 planning input

## Planning Summary

- Phase 1 is a brownfield architecture rebuild, not a greenfield feature phase. The plan has to preserve the existing note and attachment workflow by the end of the phase while replacing the repo shape and runtime boundaries underneath it.
- The current application is a single root Electron package with `src/main`, `src/renderer`, and `src/main/database.js`; the new architecture needs to split those responsibilities into separate `apps/desktop` and `apps/backend` packages without sharing business logic across them.
- The existing "backend" behavior already lives in the Electron main process and database module, so the planning target is not inventing a new product capability. It is extracting persistence and note/attachment operations into an independently runnable backend package behind an explicit contract.
- The current app cannot reliably satisfy Phase 1 requirements until startup, storage, and deletion defects are fixed early. `src/main/main.js` currently has a syntax error, and `src/main/database.js` does not enable SQLite foreign keys even though the schema declares `ON DELETE CASCADE`.
- Packaging is almost entirely unimplemented. The repo has a packaged-mode code path in `src/main/main.js`, but there is no Electron packager config, no backend bundling strategy, and no test that a packaged build can launch.
- The current storage location is tied to `process.cwd()/data`, which is incompatible with stable app-owned storage across dev, packaged, and relaunch scenarios. Phase 1 planning needs an explicit storage-root strategy that the desktop can pass to the backend at startup.
- The repo has no test runner, no plan for mocking Electron or backend boundaries, and no regression harness. Because the Phase 1 context requires a backend-agnostic desktop, the test strategy should use that same contract boundary instead of testing through deep Electron internals only.
- The project stack is still plain JavaScript with npm and Electron 28. Phase 1 planning should avoid adding a simultaneous language migration unless it directly enables the contract/runtime split, because that would create avoidable scope risk.

## Recommended Plan Slices

- **01-01: Workspace and contract foundation** — Create the monorepo structure with root orchestration plus independent `apps/desktop` and `apps/backend` package scripts, define the backend-owned versioned contract surface, and establish the desktop client boundary that will replace direct preload-to-database calls. This slice should preserve current behavior by setting up the seams first, not by solving packaging or storage in the same step.
- **01-02: Local backend runtime, storage, and lifecycle** — Move note and attachment operations into the backend package, define how the desktop launches and talks to the local backend in dev and packaged contexts, move app-owned data out of `process.cwd()`, and fix deletion/data-integrity behavior. This slice depends on 01-01 because the runtime needs the workspace and contract boundary first.
- **01-03: Packaging, no-auth guarantees, and regression coverage** — Add the packaging/build path that ships the desktop app with the local backend, keep the full v1 flow single-user with no auth assumptions, and add regression coverage for startup, note/attachment parity, storage location, and delete cleanup. This slice depends on the first two because it verifies the final architecture rather than defining it.

## Technical Findings

### Monorepo structure

- The repo currently has one root `package.json` and no workspace manager configured. Because the existing repo already uses npm, npm workspaces are the lowest-friction monorepo baseline for Phase 1.
- `vite.config.js` is renderer-only and writes to `dist/`. There is no existing structure for building the Electron main process or a backend package separately, so planning needs separate build/start/test scripts per package rather than only root-level commands.
- The Phase 1 context explicitly rejects shared business logic across desktop and backend. That means any `packages/*` usage should be limited to contracts or neutral tooling, not domain modules that bypass the API.
- The current source files are the parity baseline:
  - `src/renderer/App.jsx` defines the current user-visible note and attachment flows.
  - `src/main/preload.js` defines the current narrow bridge style.
  - `src/main/database.js` defines the current persistence rules and schema behavior.
  - `src/main/main.js` defines the current app bootstrap and packaged/dev split.
- Planning should preserve JavaScript-first conventions for Phase 1 unless a specific tool forces a different choice. A parallel TypeScript migration would add cost without directly satisfying any locked Phase 1 decision.

### Local backend boundary

- Today the renderer calls `window.api.*`, preload forwards to `ipcRenderer.invoke(...)`, and Electron main calls `db.*` directly. That makes the Electron main process both shell and backend.
- The Phase 1 context requires a real desktop/backend separation and a desktop that can target mocks or alternate implementations. Planning therefore needs a contract client layer in the desktop package and a separate backend entrypoint that can run independently of the renderer.
- The current backend behaviors that need to move are note CRUD, attachment CRUD, persistence initialization, and any future storage orchestration. These currently live in `src/main/database.js` plus related handler registration in `src/main/main.js`.
- The contract should stay transport-agnostic at the plan level. What matters for Phase 1 is that:
  - the backend package owns the contract definitions,
  - the desktop does not import backend business logic directly,
  - the same contract can be exercised by tests and mock implementations.
- Because Phase 1 also requires packaged operation, planning should avoid a backend approach that only works in dev shells. The startup path needs a defined launch/health/lifecycle story for the local backend in both development and packaged app execution.

### Storage and persistence

- `src/main/database.js` currently writes SQLite data under `process.cwd()/data/privanote.db`, which breaks PLAT-04 because the effective storage root changes depending on how the app is launched.
- The current attachment model stores raw `local_path` values but does not manage copies of external media. That preserves basic attachment references, but it does not by itself provide fully app-owned media storage or reliable deletion semantics for imported files.
- The planner should treat storage as two distinct concerns:
  - **app-owned metadata/storage root** — database file, backend data directories, and any managed media directories must live under a stable app-owned root;
  - **current attachment parity** — existing note and attachment behavior must still work by the end of Phase 1, even if richer import/capture storage rules continue into Phase 2.
- `src/main/database.js` defines `ON DELETE CASCADE`, but without `PRAGMA foreign_keys = ON` SQLite will not enforce it. Deletion integrity needs both schema intent and runtime pragma enforcement.
- Because the new backend is separate from Electron, planning needs an explicit way for the desktop shell to resolve the app-owned storage root and pass it into backend startup rather than letting the backend derive it from `process.cwd()`.

### Packaging and startup

- `src/main/main.js` currently contains a startup syntax error:
  - `const url = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'\;`
  This blocks the existing app from even starting and should be fixed in the early phase work or the rest of Phase 1 becomes hard to verify.
- The code already has `app.isPackaged` branching and loads `dist/index.html` in packaged mode, but there is no actual Electron packaging configuration in the repo. Phase 1 planning must include choosing and wiring a packaging path, not just tweaking runtime code.
- `better-sqlite3` is a native dependency. Any packaging/build plan must include native-module compatibility checks for the chosen Electron packaging path.
- `src/main/main.js` does not explicitly set Electron security flags such as `contextIsolation`, `nodeIntegration`, or `sandbox` in `BrowserWindow`. Phase 1 is the right place to make the desktop shell explicit and predictable instead of relying on implicit defaults.
- Current build flow only covers the renderer. The final plan needs distinct packaging inputs for:
  - desktop main/preload code,
  - renderer assets,
  - backend runtime artifacts.

### Testing and regression

- `package.json` has no test runner; `npm test` only prints `No tests`.
- `.planning/codebase/TESTING.md` and `.planning/codebase/CONCERNS.md` both identify missing coverage as a critical gap, especially for startup, delete cleanup, renderer async behavior, and persistence.
- Because the Phase 1 context wants a backend-agnostic desktop, the test strategy should mirror that architecture:
  - backend tests should validate contract handlers, database setup, storage path selection, and delete cleanup against temp directories/databases;
  - desktop tests should validate note/attachment flows against a mock or test backend client, not only direct Electron state;
  - at least one startup smoke check should cover the actual desktop shell launch path.
- The existing `src/renderer/App.jsx` is a large stateful component. Planning should assume some refactor or adapter layer may be needed before frontend regression tests are practical.
- Regression scope for Phase 1 should at minimum cover:
  - dev startup succeeds,
  - packaged startup succeeds,
  - note create/edit/delete still works,
  - attachment add/remove still works,
  - delete cleanup does not orphan attachment metadata,
  - storage path resolves to app-owned directories,
  - no auth is required to use the architecture.

## Risks and Traps

- Fixing the repo shape without fixing startup first would slow every later verification step, because the current Electron entry is already broken.
- Treating the backend as a folder split instead of a runtime boundary would violate the locked context decisions and make later capture/transcription planning unstable.
- Leaving storage rooted at `process.cwd()` would make packaged launches and dev launches behave like separate apps from the user’s perspective.
- Enabling foreign-key cascade in schema text only is not enough; SQLite requires runtime `PRAGMA foreign_keys = ON`, so planners should encode that exact check.
- Trying to solve all future media-storage behavior in Phase 1 could create scope creep. Planning should focus on app-owned storage foundations and deletion integrity, while preserving current note/attachment parity for the rest.
- Adding packaging without accounting for `better-sqlite3` native compatibility is likely to produce builds that compile but do not launch.
- If the desktop package still imports backend business logic directly, mockability and contract versioning will be undermined immediately.
- A test strategy that depends entirely on full Electron end-to-end tests will be slow and brittle; Phase 1 needs layered verification that includes backend and contract-level tests.
- Introducing auth, provider credentials, or transcription engine choices into Phase 1 would dilute the foundation work and violate the roadmap split.

## Verification Guidance

- The planner should encode explicit verification for the known startup defect by requiring a successful development launch after the new shell wiring is in place.
- The planner should require grep- or command-verifiable conditions for each architecture slice, for example:
  - root workspace config declares `apps/desktop` and `apps/backend`,
  - each package has its own `start`, `build`, and `test` scripts,
  - backend contract exports are declared from the backend package,
  - desktop code references a backend client/contract layer instead of direct database imports,
  - database initialization enables `foreign_keys`,
  - storage path resolution no longer uses `process.cwd()`.
- For runtime verification, plans should include commands that separately prove:
  - the backend can start in development,
  - the desktop can start against the local backend in development,
  - the packaged app includes the backend and launches successfully.
- For persistence verification, plans should include temp-directory or fixture-based checks for:
  - stable app-owned storage root,
  - note persistence across relaunch,
  - delete cleanup for note/attachment data.
- For regression coverage, plans should prefer a layered mix of backend tests, contract/client tests, and one or more desktop smoke tests instead of relying on one huge test type.

## Requirement Coverage Notes

- **PLAT-01:** Plans must create a real workspace split with independent `apps/desktop` and `apps/backend` packages, not only refactor folders inside one package.
- **PLAT-02:** Development startup verification must cover both the desktop shell and the local backend being available together.
- **PLAT-03:** Planning must include a concrete packaging/bundling path for shipping the backend with the desktop app, plus native dependency validation for `better-sqlite3`.
- **PLAT-04:** The backend/storage architecture must stop using `process.cwd()` and move to an app-owned storage root that is stable across launch modes.
- **PLAT-05:** Plans must explicitly fix runtime foreign-key enforcement and define delete-cleanup behavior for persisted note/media data.
- **PLAT-06:** The new architecture must stay single-user and unauthenticated; backend startup, dev scripts, and packaged flow should not require accounts or credentials.
- **PLAT-07:** Regression coverage needs to be introduced as part of the phase itself, not deferred, and should target backend, storage, startup, and preserved note/attachment flows.
