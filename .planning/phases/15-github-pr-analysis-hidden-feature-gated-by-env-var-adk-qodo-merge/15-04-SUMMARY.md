---
phase: 15-github-pr-analysis-hidden-feature-gated-by-env-var-adk-qodo-merge
plan: 04
subsystem: api, desktop
tags: [fastify, electron, python, process-lifecycle, proxy, uvicorn]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: Fastify server, route registration pattern, contracts pattern, nodes-service
provides:
  - Python process lifecycle manager (spawn, health poll, stop)
  - Fastify proxy routes for /api/v1/analyze/pr
  - Internal callback endpoint for note creation from Python service
  - Analyze contracts (startAnalysis, getAnalysisStatus)
affects: [15-05, 15-06]

# Tech tracking
tech-stack:
  added: []
  patterns: [env-var-gated route registration, cross-process proxy pattern, SIGTERM-then-SIGKILL process cleanup]

key-files:
  created:
    - apps/desktop/src/main/pr-service-process.js
    - apps/backend/src/contracts/v1/analyze.js
    - apps/backend/src/services/analyze-service.js
    - apps/backend/src/routes/analyze.js
    - apps/backend/src/routes/internal.js
  modified:
    - apps/desktop/src/main/main.js
    - apps/backend/src/server.js
    - apps/backend/src/contracts/index.js

key-decisions:
  - "Followed backend-process.js pattern for pr-service-process.js -- consistent process lifecycle management"
  - "Internal callback route at /internal/pr-callback sits outside /api/v1/ namespace to distinguish machine-to-machine from client-facing routes"

patterns-established:
  - "Python process lifecycle: venv auto-setup then uvicorn spawn with separate timeout phases (per Pitfall 5)"
  - "Conditional route registration: env-var guard in server.js createServer() for feature-gated routes"

requirements-completed: [PR-01, PR-05, PR-04, PR-07]

# Metrics
duration: 3min
completed: 2026-04-02
---

# Phase 15 Plan 04: Node.js Integration Layer Summary

**Python process lifecycle manager with Fastify proxy routes and internal callback endpoint, all gated behind PRIVANOTE_PR_ANALYSIS=true**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-02T21:26:06Z
- **Completed:** 2026-04-02T21:29:31Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Python process lifecycle manager that detects Python 3.12+, auto-creates venv, spawns uvicorn, polls health, and kills with SIGTERM/SIGKILL fallback
- Electron main process integration: conditional startup on app ready, cleanup on both before-quit and window-all-closed
- Fastify proxy routes forwarding analyze requests to Python service with 502 error handling
- Internal callback endpoint creating notes via nodes-service when Python service completes analysis
- Feature completely invisible when PRIVANOTE_PR_ANALYSIS env var is not set

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Python process lifecycle manager and Electron integration** - `8267505` (feat)
2. **Task 2: Create Fastify proxy routes, analyze service, internal callback, and contracts** - `21015a6` (feat)

## Files Created/Modified
- `apps/desktop/src/main/pr-service-process.js` - Python process spawn/health/stop with venv auto-setup
- `apps/desktop/src/main/main.js` - Added PR service lifecycle calls behind env var guard
- `apps/backend/src/contracts/v1/analyze.js` - Analyze contract definitions (startAnalysis, getAnalysisStatus)
- `apps/backend/src/contracts/index.js` - Aggregated analyze contracts into v1 namespace
- `apps/backend/src/services/analyze-service.js` - Proxy service forwarding to Python on port 8100
- `apps/backend/src/routes/analyze.js` - POST and GET routes for /api/v1/analyze/pr
- `apps/backend/src/routes/internal.js` - Internal callback endpoint creating notes via nodes-service
- `apps/backend/src/server.js` - Conditional route registration behind PRIVANOTE_PR_ANALYSIS guard

## Decisions Made
- Followed the existing backend-process.js pattern for consistent process lifecycle management
- Internal callback route placed at /internal/pr-callback outside /api/v1/ namespace to distinguish machine-to-machine from client-facing routes

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Python process lifecycle and Fastify proxy layer are ready for the Python service (plan 15-03) to connect to
- Desktop UI (plan 15-05, 15-06) can invoke analyze operations through the contracts layer

## Self-Check: PASSED

All 8 files verified present. Both task commits (8267505, 21015a6) verified in git log.

---
*Phase: 15-github-pr-analysis-hidden-feature-gated-by-env-var-adk-qodo-merge*
*Completed: 2026-04-02*
