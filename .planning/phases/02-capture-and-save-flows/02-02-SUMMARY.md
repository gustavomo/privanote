---
phase: 02-capture-and-save-flows
plan: 02
subsystem: backend-and-ui
tags: [imports, storage, sqlite, electron, fastify]
requires:
  - phase: 02-capture-and-save-flows
    provides: recording upload seam, review-first capture UI, and placeholder-note behavior
provides:
  - shared managed media copy/write helpers for recordings and imports
  - backend-owned import route with optional auto-created note orchestration
  - desktop import action that replaces raw-path attachment entry
affects: [media-cards, relaunch-tests, transcription]
tech-stack:
  added: []
  patterns: [managed media storage helper, backend-owned import flow, note-first-or-auto-create import UX]
key-files:
  created:
    - apps/backend/src/storage/media-files.js
    - apps/backend/test/media-storage.test.js
    - apps/backend/test/media-import.test.js
    - apps/desktop/test/media-import.test.jsx
  modified:
    - apps/backend/src/contracts/v1/media.js
    - apps/backend/src/contracts/index.js
    - apps/backend/src/routes/media.js
    - apps/backend/src/services/media-service.js
    - apps/backend/src/storage/attachment-files.js
    - apps/desktop/src/lib/backend-client.js
    - apps/desktop/src/main/main.js
    - apps/desktop/src/renderer/App.jsx
    - apps/desktop/test/app.note-flow.test.jsx
key-decisions:
  - "Imports copy into backend-managed attachment storage immediately instead of preserving external-path-only references."
  - "Recording saves and imports now share the same managed media helper path under the backend attachments root."
  - "The desktop workspace removes manual raw-path entry and routes imports through the native picker plus backend contract."
patterns-established:
  - "Managed import pattern: renderer picks a file, infers attachment kind, and posts sourcePath through the backend-owned import contract."
  - "Storage pattern: audio, video, and generic files all land under attachments/{audio,video,file} with deterministic sanitized names."
requirements-completed: [CAP-03, CAP-04]
duration: 12min
completed: 2026-03-30
---

# Phase 02 Plan 02: Capture and Save Flows Summary

**Imports now copy into managed backend storage, can auto-create a note when needed, and replace the old raw-path attachment workflow in the desktop workspace**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-30T04:50:13Z
- **Completed:** 2026-03-30T05:02:33Z
- **Tasks:** 3
- **Files modified:** 13

## Accomplishments

- Added shared managed media helpers so recording saves and imports both write under the backend attachment root using the same storage conventions.
- Extended the backend media contract and route set with `v1.media.importMedia`, including auto-create-note behavior when an import starts without a selected note.
- Removed the desktop raw-path attachment entry form and replaced it with an `Import Files` action that uses the native picker, infers media kind, and refreshes the active note attachments from the backend response.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create shared managed media storage helpers for recordings and imports** - `444857b` (`feat`)
2. **Task 2: Add the backend import endpoint and note-orchestration flow** - `dad0420` (`feat`)
3. **Task 3: Replace manual external-path attachment entry with the import flow in the desktop workspace** - `4865fd5` (`feat`)

**Plan metadata:** pending final completion commit

## Files Created/Modified

- `apps/backend/src/storage/media-files.js` - shared managed copy/write helpers for recordings and imports
- `apps/backend/src/services/media-service.js` - import validation, optional note creation, and shared media persistence usage
- `apps/backend/src/routes/media.js` - JSON import route alongside the multipart recording route
- `apps/backend/src/contracts/v1/media.js` - backend-owned `importMedia` contract
- `apps/backend/src/storage/attachment-files.js` - managed attachment-path cleanup compatibility for the new media subdirectories
- `apps/backend/test/media-storage.test.js` - shared storage helper regression coverage
- `apps/backend/test/media-import.test.js` - backend import regression coverage for existing-note and auto-created-note cases
- `apps/desktop/src/lib/backend-client.js` - desktop `importMedia` binding
- `apps/desktop/src/main/main.js` - native picker updated with media filters plus `All Files`
- `apps/desktop/src/renderer/App.jsx` - import action, placeholder-title generation, and removal of raw-path attachment entry
- `apps/desktop/test/media-import.test.jsx` - desktop import regressions with and without a selected note
- `apps/desktop/test/app.note-flow.test.jsx` - note-workspace regression updated to match the removed legacy attachment form

## Decisions Made

- Kept imports backend-owned end to end so copied media always land in managed storage before attachment rows are created.
- Continued using placeholder note titles on auto-created note paths so imports align with the capture-first workflow approved in Phase 2 context.
- Limited generic file support in the picker to an `All Files` fallback instead of expanding file-type-specific UI in this phase.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Rebuilt `better-sqlite3` for the current Node runtime before backend verification**
- **Found during:** final `02-02` verification
- **Issue:** backend import verification started returning misleading 400s because `better-sqlite3` had flipped back to Electron's ABI and Node-side tests could not open the database.
- **Fix:** Ran `npm run rebuild:native` and reran the backend media-storage and import regressions under the current shell's Node runtime.
- **Files modified:** none
- **Verification:** `npm run test --workspace @privanote/backend -- media-storage.test.js`, `npm run test --workspace @privanote/backend -- media-import.test.js`
- **Committed in:** not applicable

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** No product behavior changed, but the rebuild was required to make backend verification truthful again.

## Issues Encountered

- The desktop import regression initially clicked a transient pre-load `Import Files` button before the selected-note workspace settled; the test was tightened to anchor on the active-note state before triggering the import action.
- `better-sqlite3` remains sensitive to Node/Electron ABI flips after npm operations, so Node-side backend verification may still require `npm run rebuild:native` after dependency churn.

## User Setup Required

None - imports continue using the existing native file picker with no external service setup.

## Next Phase Readiness

- `02-03` can now focus entirely on saved-media presentation and relaunch persistence, because capture saves and imports both converge on the same managed attachment model.
- The remaining Phase 2 gap is rendering saved attachments as media cards and proving they survive backend/database reopen.

---
*Phase: 02-capture-and-save-flows*
*Completed: 2026-03-30*
