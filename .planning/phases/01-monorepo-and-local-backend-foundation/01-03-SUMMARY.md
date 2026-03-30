---
phase: 01-monorepo-and-local-backend-foundation
plan: 03
subsystem: testing
tags: [electron-builder, vitest, smoke-tests, packaging, no-auth]
requires:
  - phase: 01-01
    provides: workspace split, desktop migration, backend-owned contract client seam
  - phase: 01-02
    provides: local backend runtime, app-owned storage root, backend lifecycle wiring
provides:
  - Packaged desktop build path that ships the local backend as a bundled runtime
  - Independent backend and desktop Vitest regression suites
  - No-auth smoke verification for development and packaged desktop startup
affects: [phase-2-capture, packaging, regression, release]
tech-stack:
  added: [electron-builder, vitest, jsdom, testing-library]
  patterns: [packaged backend wrapper, layered workspace regression tests, no-window desktop smoke mode]
key-files:
  created:
    - apps/backend/scripts/build-runtime.mjs
    - apps/backend/test/storage.delete.test.js
    - apps/backend/test/server.health.test.js
    - apps/desktop/electron-builder.yml
    - apps/desktop/scripts/smoke/startup.mjs
    - apps/desktop/scripts/smoke/package-launch.mjs
    - apps/desktop/test/app.note-flow.test.jsx
    - apps/desktop/test/backend-client.test.js
  modified:
    - apps/backend/package.json
    - apps/desktop/package.json
    - apps/desktop/src/main/backend-process.js
    - apps/desktop/src/main/main.js
    - README.md
    - package-lock.json
key-decisions:
  - "Pin Electron to 28.3.3 and use Fastify 4 so the packaged backend stays compatible with Electron 28's embedded Node 18 runtime."
  - "Ship a tiny backend wrapper under extraResources and let it explicitly call startServer() from the packaged backend module."
  - "Restore the Node build of better-sqlite3 after npm run dist so desktop packaging does not leave backend tests broken locally."
patterns-established:
  - "Packaging pattern: desktop dist builds the backend runtime artifact first, bundles it under Resources/backend, and launches it with process.execPath plus ELECTRON_RUN_AS_NODE."
  - "Verification pattern: backend, desktop, dist, dev smoke, and packaged smoke are all first-class workspace commands."
requirements-completed: [PLAT-03, PLAT-06, PLAT-07]
duration: 35min
completed: 2026-03-29
---

# Phase 01: Monorepo and Local Backend Foundation Summary

**Packaged desktop/backend runtime, layered workspace regression coverage, and no-auth smoke checks for dev plus packaged startup**

## Performance

- **Duration:** 35 min
- **Started:** 2026-03-29T21:47:00-05:00
- **Completed:** 2026-03-29T22:21:28-05:00
- **Tasks:** 3
- **Files modified:** 18

## Accomplishments

- Added a concrete desktop packaging path that bundles the backend runtime, rebuilds `better-sqlite3`, and launches the local backend from packaged resources.
- Introduced independent backend and desktop Vitest suites covering storage cleanup, server startup, contract-client behavior, and the current note/attachment workspace flow.
- Added smoke scripts that verify both the dev shell and the packaged app start their local backend without accounts, credentials, or sign-in prompts.

## Task Commits

Implementation landed in one integrated code commit because the packaging, runtime-compatibility, and smoke fixes had to iterate together during verification:

1. **Task 1: Add the packaged desktop build path that includes the local backend** - `39a6230` (`feat`)
2. **Task 2: Add automated regression coverage for backend, storage, and desktop note flows** - `39a6230` (`feat`)
3. **Task 3: Add no-auth smoke checks and developer documentation for dev, test, and packaged flows** - `39a6230` (`feat`)

**Plan metadata:** pending final completion commit

## Files Created/Modified

- `apps/backend/scripts/build-runtime.mjs` - emits the packaged backend wrapper that resolves the bundled runtime and starts the Fastify server explicitly
- `apps/backend/test/storage.delete.test.js` - covers `foreign_keys`, stable storage-root selection, and managed-file cleanup
- `apps/backend/test/server.health.test.js` - verifies `/health` and note/attachment routes work without auth
- `apps/desktop/electron-builder.yml` - packages the desktop app and ships the backend runtime under `extraResources`
- `apps/desktop/src/main/backend-process.js` - resolves dev vs packaged backend entry points and mirrors smoke stderr for diagnosis
- `apps/desktop/src/main/main.js` - supports no-window smoke mode, configurable data roots, and cleaner startup/shutdown behavior
- `apps/desktop/test/app.note-flow.test.jsx` - regression coverage for empty state, note creation, and attachment actions through `createBackendClient`
- `apps/desktop/scripts/smoke/package-launch.mjs` - launches the top-level packaged binary and verifies bundled backend startup
- `README.md` - documents dev, test, dist, and no-auth smoke workflows

## Decisions Made

- Switched the backend runtime from Fastify 5 to Fastify 4 because Electron 28 embeds Node 18, and the Fastify 5 path failed inside the packaged backend child process.
- Kept the backend package inside `app.asar` and unpacked only `better-sqlite3`, which preserves normal Node module resolution for the packaged backend while still allowing the native addon to load.
- Added smoke-mode stderr reporting and final `npm rebuild better-sqlite3` recovery so packaging failures are diagnosable and local Node-side tests remain runnable after `dist`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Compatibility] Fastify 5 was incompatible with the packaged backend runtime**
- **Found during:** Task 1 (packaged desktop build and smoke verification)
- **Issue:** The backend child process crashed under Electron 28 because Fastify 5 expected a newer Node runtime API.
- **Fix:** Downgraded the backend package to Fastify 4 and refreshed the lockfile.
- **Files modified:** `apps/backend/package.json`, `package-lock.json`
- **Verification:** `npm test`, `node apps/desktop/scripts/smoke/startup.mjs`, and the packaged backend wrapper all ran on the Electron 28 runtime.
- **Committed in:** `39a6230`

**2. [Packaging] The packaged backend wrapper loaded the module without starting the server**
- **Found during:** Task 1 and Task 3 packaged smoke verification
- **Issue:** The wrapper only required the backend entry, so `require.main === module` stayed false and the backend never listened.
- **Fix:** Updated the emitted runtime wrapper to call `startServer()` explicitly.
- **Files modified:** `apps/backend/scripts/build-runtime.mjs`
- **Verification:** Direct wrapper launch served `http://127.0.0.1:4321/health` successfully.
- **Committed in:** `39a6230`

**3. [Smoke harness] Packaged smoke initially selected helper binaries and packaging mutated local native modules**
- **Found during:** Task 3 (packaged smoke and post-dist test verification)
- **Issue:** The smoke script could select a helper app instead of the top-level binary, and `electron-builder install-app-deps` rewrote `better-sqlite3` for Electron in the shared workspace install.
- **Fix:** Tightened packaged-binary selection to the main app executable and restored the Node build of `better-sqlite3` at the end of `dist`.
- **Files modified:** `apps/desktop/scripts/smoke/package-launch.mjs`, `apps/desktop/package.json`
- **Verification:** `npm run dist --workspace @privanote/desktop`, `node apps/desktop/scripts/smoke/package-launch.mjs`, and `npm test` all succeeded in sequence.
- **Committed in:** `39a6230`

---

**Total deviations:** 3 auto-fixed (compatibility, packaging, smoke harness)
**Impact on plan:** All fixes were necessary to make the packaged runtime and verification loop actually work on the Electron 28 target. No Phase 2 scope was added.

## Issues Encountered

- Electron packaging needed escalation because rebuilding `better-sqlite3` writes under `~/.electron-gyp`.
- The Codex shell environment exports `ELECTRON_RUN_AS_NODE=1`, so the smoke scripts had to clear it before launching the desktop shell itself.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 2 can build on a packaged, contract-backed desktop/backend foundation without reworking startup or storage again.
- The project now has layered checks for backend correctness, renderer note/attachment parity, dev startup, and packaged startup.

---
*Phase: 01-monorepo-and-local-backend-foundation*
*Completed: 2026-03-29*
