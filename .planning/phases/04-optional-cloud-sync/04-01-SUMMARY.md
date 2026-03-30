---
phase: 04-optional-cloud-sync
plan: 01
subsystem: api
tags: [sync, google-drive, oauth, queue, sqlite]
requires:
  - phase: 03-transcription-and-settings
    provides: backend-owned settings, transcript queue, and saved attachment metadata
provides:
  - durable provider connection persistence
  - attachment sync rows with retry-visible status
  - Google Drive OAuth and upload adapter
  - media-first sync runner with transcript patch follow-up
affects: [04-02, 04-03, attachment-listing, sync-settings]
tech-stack:
  added: []
  patterns: [backend-owned OAuth state, durable sync rows, media-first cloud patching]
key-files:
  created:
    - apps/backend/src/contracts/v1/sync.js
    - apps/backend/src/routes/sync.js
    - apps/backend/src/services/providers/google-drive-provider.js
    - apps/backend/src/services/sync-runner.js
    - apps/backend/src/services/sync-state-service.js
    - apps/backend/test/google-drive-sync.test.js
    - apps/backend/test/sync-runner.test.js
  modified:
    - apps/backend/src/storage/database.js
    - apps/backend/src/contracts/index.js
    - apps/backend/src/services/media-service.js
    - apps/backend/src/services/transcription-runner.js
    - apps/backend/src/services/attachments-service.js
    - apps/backend/src/server.js
key-decisions:
  - "OAuth browser launch and callback completion stay backend-owned so renderer state never carries provider tokens or PKCE secrets."
  - "Attachment sync status is persisted separately from attachments so retries, disconnects, and relaunch survive process restarts."
  - "Media uploads complete first and transcript/metadata patch later against the same remote note folder."
patterns-established:
  - "Pattern 1: local media persistence always succeeds or fails independently from optional cloud sync."
  - "Pattern 2: transcript completion can enqueue a follow-up cloud patch without reuploading the media asset."
requirements-completed: [SYNC-01, SYNC-03, SYNC-05]
duration: 36min
completed: 2026-03-30
---

# Phase 04 Plan 01 Summary

**Google Drive connection, durable sync state, and media-first queue orchestration for optional cloud sync**

## Performance

- **Duration:** 36 min
- **Started:** 2026-03-30T20:33:00Z
- **Completed:** 2026-03-30T21:09:00Z
- **Tasks:** 3
- **Files modified:** 14

## Accomplishments

- Added durable `sync_provider_connections` and `attachment_syncs` persistence plus backend-owned sync contracts and routes.
- Added Google Drive connection/callback handling, root-folder creation, resumable media upload, and transcript/metadata patch helpers.
- Added a background sync runner that queues after local save/import succeeds, preserves local-first failure behavior, and resumes persisted state cleanly.

## Task Commits

1. **Task 1: Create durable provider connection and attachment sync persistence with backend-owned contracts** - `c201f57` (`feat`)
2. **Task 2: Add Google Drive OAuth plus media-first upload rules through a shared sync runner** - `c201f57` (`feat`)
3. **Task 3: Add backend regressions for Google connection, auto-queueing, transcript patching, and local-first failure behavior** - `c201f57` (`feat`)

## Files Created/Modified

- `apps/backend/src/storage/database.js` - adds provider connection and attachment sync tables
- `apps/backend/src/contracts/v1/sync.js` - defines the backend-owned sync operations
- `apps/backend/src/routes/sync.js` - owns connect, callback, disconnect, and retry endpoints
- `apps/backend/src/services/sync-state-service.js` - persists connection records, sync rows, and retry state
- `apps/backend/src/services/providers/google-drive-provider.js` - implements Google Drive OAuth, folder resolution, uploads, and transcript patching
- `apps/backend/src/services/sync-runner.js` - runs queued sync work and transcript follow-up patches
- `apps/backend/src/services/media-service.js` - queues cloud sync only after local save/import succeeds
- `apps/backend/src/services/transcription-runner.js` - queues transcript patch work after transcript success
- `apps/backend/src/services/attachments-service.js` - surfaces sync fields in attachment reads
- `apps/backend/src/server.js` - registers sync routes and runner startup/shutdown
- `apps/backend/test/google-drive-sync.test.js` - verifies Google connection persistence and disconnect behavior
- `apps/backend/test/sync-runner.test.js` - verifies queueing, `cloud_url`, retry caps, and transcript patch clearing

## Decisions Made

- Kept the sync API fully backend-owned so the desktop can only initiate connection and poll status.
- Stored sync status per attachment instead of overloading `attachments.cloud_url` for workflow state.
- Reused the transcript runner as the trigger point for transcript/metadata patching so cloud sync stays aligned with actual transcript completion.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Attachment reads needed sync metadata fields before the desktop plan could render cloud state**
- **Found during:** Task 2 (runner and attachment integration)
- **Issue:** The initial sync persistence work existed in the backend, but attachment listing still lacked the sync fields Phase 4 UI depends on.
- **Fix:** Extended attachment queries with sync joins and mapped `sync_status`, `sync_provider`, remote IDs, and transcript patch state into the returned attachment shape.
- **Files modified:** `apps/backend/src/services/attachments-service.js`
- **Verification:** `npm run test --workspace @privanote/backend -- sync-runner.test.js google-drive-sync.test.js`
- **Committed in:** `c201f57`

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** The sync foundation stayed aligned with the plan and exposed the attachment state Phase 4 UI needed.

## Issues Encountered

- Backend verification required an explicit Node 20 native rebuild because `better-sqlite3` can drift back to the Electron ABI after repo operations.

## User Setup Required

None for verification. Real provider use still requires valid Google OAuth app credentials at runtime.

## Next Phase Readiness

- `04-02` can build OneDrive coexistence and destination reassignment rules on top of the same sync runner and persistence model.
- `04-03` can render backend-owned sync status directly from attachment reads and provider connection listing.

---
*Phase: 04-optional-cloud-sync*
*Completed: 2026-03-30*
