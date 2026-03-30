---
phase: 04-optional-cloud-sync
plan: 02
subsystem: api
tags: [sync, onedrive, providers, settings, queue]
requires:
  - phase: 04-optional-cloud-sync
    provides: shared sync persistence, contracts, and Google Drive runner foundation
provides:
  - OneDrive provider integration
  - one-provider-per-attachment targeting rules
  - unsynced-only default destination reassignment
  - disconnect-safe sync failure handling
affects: [04-03, settings-sync, provider-coexistence]
tech-stack:
  added: []
  patterns: [provider-specific adapters, stored sync target ownership, unsynced-only reassignment]
key-files:
  created:
    - apps/backend/src/services/providers/onedrive-provider.js
    - apps/backend/test/onedrive-sync.test.js
    - apps/backend/test/sync-destination.test.js
  modified:
    - apps/backend/src/services/settings-service.js
    - apps/backend/src/services/sync-state-service.js
    - apps/backend/src/services/sync-runner.js
    - apps/backend/src/services/attachments-service.js
    - apps/backend/src/services/transcription-runner.js
    - apps/backend/src/routes/sync.js
key-decisions:
  - "Attachments keep one stored provider target even if the user later changes the global default destination."
  - "Changing the default destination only queues unsynced and unassigned local attachments for the newly connected provider."
  - "Disconnecting a provider clears live auth state but does not delete local files or remote bookkeeping for already-synced attachments."
patterns-established:
  - "Pattern 1: provider adapters are resolved from stored sync-row ownership, not from the current settings default."
  - "Pattern 2: cloud destination changes are additive for unsynced local work and never migrate already-synced attachments implicitly."
requirements-completed: [SYNC-02, SYNC-03, SYNC-05]
duration: 25min
completed: 2026-03-30
---

# Phase 04 Plan 02 Summary

**OneDrive support, durable provider targeting rules, and safe default-destination reassignment for optional cloud sync**

## Performance

- **Duration:** 25 min
- **Started:** 2026-03-30T21:09:00Z
- **Completed:** 2026-03-30T21:34:00Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- Added a OneDrive adapter with app-root resolution, resumable upload-session support, and transcript/metadata patch behavior.
- Extended sync persistence so Google Drive and OneDrive can coexist while each attachment keeps one durable provider target.
- Added reassignment and disconnect rules that queue only older unsynced local attachments when the default changes and preserve local-first behavior on every failure path.

## Task Commits

1. **Task 1: Add a OneDrive provider adapter with stable root-folder and resumable upload behavior** - `c201f57` (`feat`)
2. **Task 2: Persist multi-provider sync bookkeeping and enforce exact default-switch assignment rules** - `c201f57` (`feat`)
3. **Task 3: Add backend regressions for OneDrive coexistence, default switching, disconnect, and transcript patch updates** - `c201f57` (`feat`)

## Files Created/Modified

- `apps/backend/src/services/providers/onedrive-provider.js` - implements OneDrive auth, app-root discovery, chunked uploads, and transcript patching
- `apps/backend/src/routes/sync.js` - adds the OneDrive callback completion path
- `apps/backend/src/services/sync-state-service.js` - persists provider-facing connection fields and unsynced-only reassignment logic
- `apps/backend/src/services/settings-service.js` - queues unsynced local attachments only when the newly selected destination is already connected
- `apps/backend/src/services/sync-runner.js` - resolves the provider adapter from the stored sync row and routes transcript patches for both providers
- `apps/backend/src/services/attachments-service.js` - returns expanded sync metadata to callers
- `apps/backend/src/services/transcription-runner.js` - patches transcript/metadata for both providers after transcript success
- `apps/backend/test/onedrive-sync.test.js` - verifies coexistence, root-folder handling, and upload-session behavior
- `apps/backend/test/sync-destination.test.js` - verifies default-switch targeting rules
- `apps/backend/test/sync-runner.test.js` - verifies disconnect failure state and transcript patch follow-up paths

## Decisions Made

- Treated provider connection state and attachment provider ownership as separate concerns so default changes do not rewrite sync history.
- Marked queued rows as failed with `Provider disconnected.` instead of deleting them so the UI can explain what happened and offer recovery.
- Reused the same note-folder naming and sidecar filenames across both providers to keep future sync consumers consistent.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Transcript-only resume jobs were trying to re-enter the normal media-upload path after relaunch**
- **Found during:** Task 3 (relaunch persistence regression)
- **Issue:** A resumed sync row with `transcript_patch_pending=1` could be treated like a full sync attempt before the transcript had actually succeeded, which broke the relaunch-safe patch path.
- **Fix:** Short-circuited the runner so transcript-patch rows wait for transcript success and then patch the existing remote folder without re-entering media upload or requiring a fresh provider assignment.
- **Files modified:** `apps/backend/src/services/sync-runner.js`
- **Verification:** `npm run test --workspace @privanote/backend -- onedrive-sync.test.js sync-destination.test.js sync-runner.test.js sync-persistence.test.js`
- **Committed in:** `c201f57`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** The relaunch and transcript-follow-up path now behaves consistently across both providers without changing the Phase 4 sync model.

## Issues Encountered

- Like Plan 01, backend verification still depended on an explicit Node 20 rebuild for `better-sqlite3` before the suite was rerun.

## User Setup Required

None for verification. Real OneDrive use still requires valid Microsoft app registration values at runtime.

## Next Phase Readiness

- `04-03` can render provider coexistence and default-destination state directly from the backend without guessing sync ownership in the renderer.
- The settings UI can now show the exact “already-synced items stay where they are” behavior backed by durable backend rules.

---
*Phase: 04-optional-cloud-sync*
*Completed: 2026-03-30*
