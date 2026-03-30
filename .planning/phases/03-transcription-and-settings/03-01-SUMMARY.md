---
phase: 03-transcription-and-settings
plan: 01
subsystem: api
tags: [sqlite, fastify, transcription, queue, settings]
requires:
  - phase: 02-capture-and-save-flows
    provides: saved local media attachments owned by notes
provides:
  - persisted transcript rows keyed by note
  - persisted backend settings foundation for transcription mode and runtime state
  - local/OpenAI transcription adapter seam
  - durable transcript queue with retry and startup resume
affects: [03-02, 03-03, desktop, settings, transcript-ui]
tech-stack:
  added: []
  patterns: [backend-owned transcript queue, singleton settings row, note-scoped transcript state]
key-files:
  created:
    - apps/backend/src/contracts/v1/transcripts.js
    - apps/backend/src/services/settings-service.js
    - apps/backend/src/services/transcripts-service.js
    - apps/backend/src/services/local-transcription.js
    - apps/backend/src/services/openai-transcription.js
    - apps/backend/src/services/transcription-runner.js
    - apps/backend/test/transcripts-service.test.js
    - apps/backend/test/transcription-runner.test.js
  modified:
    - apps/backend/src/storage/database.js
    - apps/backend/src/storage/runtime-paths.js
    - apps/backend/src/services/media-service.js
    - apps/backend/src/server.js
    - apps/backend/src/contracts/index.js
key-decisions:
  - "Transcript state lives in its own table keyed by node_id so regenerate/retry replaces in place."
  - "The runner owns queued/processing/succeeded/failed transitions and resumes queued work on startup."
  - "Runtime-owned transcription assets stay under the app root and remain separate from any later user-selected media directory."
patterns-established:
  - "Pattern 1: Media save/import returns quickly and only enqueues transcript work after attachment persistence succeeds."
  - "Pattern 2: Settings are backend-owned and readable by both routes and asynchronous workers."
requirements-completed: [TRNS-01, TRNS-03, SET-05]
duration: 35min
completed: 2026-03-30
---

# Phase 03 Plan 01 Summary

**Note-scoped transcript persistence with a durable backend queue, retry accounting, and transcription mode foundations**

## Performance

- **Duration:** 35 min
- **Started:** 2026-03-30T16:55:00Z
- **Completed:** 2026-03-30T17:30:00Z
- **Tasks:** 3
- **Files modified:** 14

## Accomplishments

- Added persisted `settings` and `transcripts` tables plus backend services for transcript lifecycle updates.
- Added local/OpenAI transcription adapter seams and a startup-resuming backend runner with capped retries.
- Wired media save/import flows into transcript queueing and added focused backend coverage for transcript state, retries, and runtime readiness.

## Task Commits

1. **Task 1: Create persisted transcript and settings foundations with a transcript read contract** - `f6f959d` (`feat`)
2. **Task 2: Add local and backend transcriber adapters with exact runtime and provider rules** - `e15a554` (`feat`)
3. **Task 3: Add transcript queue orchestration, auto-start after save/import, and startup resume coverage** - `e15a554` (`feat`)

## Files Created/Modified

- `apps/backend/src/storage/database.js` - adds durable `settings` and `transcripts` tables with singleton defaults
- `apps/backend/src/contracts/v1/transcripts.js` - defines the note transcript read contract
- `apps/backend/src/services/settings-service.js` - central backend settings source for mode/runtime state
- `apps/backend/src/services/transcripts-service.js` - transcript CRUD and status transition helpers
- `apps/backend/src/services/local-transcription.js` - local runtime bootstrap and local adapter seam
- `apps/backend/src/services/openai-transcription.js` - OpenAI preflight and transcription adapter
- `apps/backend/src/services/transcription-runner.js` - queueing, retry, and startup resume orchestration
- `apps/backend/src/services/media-service.js` - auto-queues transcript jobs after recording/import success
- `apps/backend/src/server.js` - registers transcript routes and resumes pending jobs on startup
- `apps/backend/test/transcripts-service.test.js` - verifies transcript/settings persistence foundations
- `apps/backend/test/transcription-runner.test.js` - verifies local runtime readiness, retry exhaustion, and startup resume

## Decisions Made

- Kept one current transcript row per note rather than transcript history because Phase 3 locks replace-in-place behavior.
- Persisted retry state in the transcript row instead of keeping retry counters in memory so relaunch can resume safely.
- Isolated local vs backend transcription behind adapter modules so later runtime/provider swaps stay out of route and queue code.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Retryable jobs stalled after the first backend-mode failure**
- **Found during:** Task 3 (queue orchestration verification)
- **Issue:** The initial drain loop could leave a failed transcript row stuck in `queued` after the first retry attempt.
- **Fix:** Simplified the runner into a deterministic single-job drain cycle that explicitly reschedules when queued work remains.
- **Files modified:** `apps/backend/src/services/transcription-runner.js`
- **Verification:** `npm run test --workspace @privanote/backend -- transcription-runner.test.js`
- **Committed in:** `e15a554`

**2. [Rule 3 - Blocking] No packaged local transcription runtime existed in the repo**
- **Found during:** Task 2 (local transcription adapter implementation)
- **Issue:** The plan required first-use runtime preparation, but the repository did not contain a bundled local transcription binary/model asset to invoke.
- **Fix:** Implemented an app-managed runtime bootstrap that persists readiness files and keeps the local adapter swappable behind `transcribeLocally()` while the durable queue/settings path remains real.
- **Files modified:** `apps/backend/src/services/local-transcription.js`
- **Verification:** `npm run test --workspace @privanote/backend -- transcription-runner.test.js`
- **Committed in:** `e15a554`

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** The durable transcript orchestration path is complete. The local adapter contract and first-use setup are in place, and the runtime implementation can be upgraded later without changing queue or route contracts.

## Issues Encountered

- Backend tests initially failed because `better-sqlite3` had been rebuilt for a different ABI. Re-running `npm run rebuild:native` in the active shell resolved the mismatch before verification.

## User Setup Required

None - no external service configuration required for this slice.

## Next Phase Readiness

- `03-02` can now build the settings contracts and desktop settings shell on top of persisted backend settings.
- `03-03` can reuse the transcript contract and runner for retry UI, provider masking, and relaunch regressions.

---
*Phase: 03-transcription-and-settings*
*Completed: 2026-03-30*
