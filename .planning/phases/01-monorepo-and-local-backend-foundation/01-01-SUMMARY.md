---
phase: 01-monorepo-and-local-backend-foundation
plan: 01
subsystem: infra
tags: [electron, monorepo, npm-workspaces, shadcn, contracts]
requires: []
provides:
  - npm workspace split for desktop and backend packages
  - migrated desktop shell under apps/desktop
  - backend-owned v1 contract and desktop client seam
affects: [capture, transcription, sync, packaging]
tech-stack:
  added: [npm workspaces, local shadcn desktop config]
  patterns: [backend-owned contracts, desktop transport seam, workspace-local renderer config]
key-files:
  created:
    - apps/desktop/package.json
    - apps/backend/package.json
    - apps/desktop/src/main/main.js
    - apps/backend/src/contracts/index.js
    - apps/desktop/src/lib/backend-client.js
  modified:
    - package.json
    - package-lock.json
    - README.md
key-decisions:
  - "Use npm workspaces at the root and keep desktop/backend runnable through their own manifests."
  - "Keep the migrated desktop usable with an in-memory transport while the real backend runtime lands in the next plan."
  - "Define the backend contract in @privanote/backend and make preload consume it through createBackendClient."
patterns-established:
  - "Workspace split: root scripts orchestrate but apps/desktop and apps/backend remain independently runnable."
  - "Desktop API pattern: preload exposes a client built from transport.request(operation, payload)."
requirements-completed: [PLAT-01, PLAT-02]
duration: 3min
completed: 2026-03-29
---

# Phase 01: Monorepo and Local Backend Foundation Summary

**Workspace split with a migrated desktop shell, local design-system files, and a backend-owned v1 contract seam**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-29T21:17:46-05:00
- **Completed:** 2026-03-29T21:20:39-05:00
- **Tasks:** 3
- **Files modified:** 22

## Accomplishments

- Converted the repo root into npm workspaces for `apps/desktop` and `apps/backend`.
- Rebuilt the Electron shell and React notes workspace inside `apps/desktop` with the approved `Create Note` baseline.
- Added backend-owned v1 contract definitions plus a reusable `createBackendClient` seam for desktop callers.

## Task Commits

Each task was committed atomically:

1. **Task 1: Convert the repo root into npm workspaces with independent desktop/backend packages** - `caec0c3` (`chore`)
2. **Task 2: Migrate the existing Electron shell and renderer baseline into apps/desktop** - `f114dba` (`feat`)
3. **Task 3: Define the backend-owned v1 contract surface and a mockable desktop client seam** - `ae7d315` (`feat`)

**Plan metadata:** pending final completion commit

## Files Created/Modified

- `package.json` - root workspace orchestration for desktop and backend
- `apps/desktop/package.json` - desktop package entrypoints and scripts
- `apps/backend/package.json` - backend package manifest and exports
- `apps/desktop/src/main/main.js` - migrated Electron shell with contract-driven mock transport
- `apps/desktop/src/renderer/App.jsx` - two-column notes workspace using the approved copy contract
- `apps/backend/src/contracts/index.js` - exported v1 contract surface
- `apps/desktop/src/lib/backend-client.js` - transport-based client seam for preload and tests

## Decisions Made

- Used a local `file:../backend` dependency from desktop to backend because the repo's npm version rejected `workspace:*`.
- Kept the migrated desktop interactive with an in-memory transport in `apps/desktop/src/main/main.js` until the real local backend runtime is implemented in `01-02`.
- Localized shadcn/Tailwind config to `apps/desktop` so the renderer build no longer depends on root-level UI tooling.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Switched workspace dependency syntax for older npm**
- **Found during:** Task 1 (Convert the repo root into npm workspaces with independent desktop/backend packages)
- **Issue:** `npm install` failed because the current npm runtime does not support the `workspace:*` protocol.
- **Fix:** Replaced the desktop dependency on `@privanote/backend` with `file:../backend` and regenerated `package-lock.json`.
- **Files modified:** `apps/desktop/package.json`, `package-lock.json`
- **Verification:** `npm install` completed successfully
- **Committed in:** `caec0c3`

**2. [Rule 3 - Blocking] Replaced unsupported Tailwind base utility applies**
- **Found during:** Task 2 (Migrate the existing Electron shell and renderer baseline into apps/desktop)
- **Issue:** `npm run build --workspace @privanote/desktop` failed because Tailwind could not resolve the copied `border-border` utility in `@apply`.
- **Fix:** Replaced the problematic base-layer `@apply` rules with plain CSS using the same theme variables.
- **Files modified:** `apps/desktop/src/renderer/index.css`
- **Verification:** `npm run build --workspace @privanote/desktop` exits 0
- **Committed in:** `f114dba`

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes were necessary to keep the workspace install and desktop build functional. No scope creep beyond the planned migration.

## Issues Encountered

- None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `01-02` can now replace the in-memory desktop transport with the real local backend runtime.
- The contract IDs and preload/client seam are established, so storage, health checks, and lifecycle wiring can build on stable package boundaries.

---
*Phase: 01-monorepo-and-local-backend-foundation*
*Completed: 2026-03-29*
