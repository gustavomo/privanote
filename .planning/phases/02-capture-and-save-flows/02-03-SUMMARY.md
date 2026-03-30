---
phase: 02-capture-and-save-flows
plan: 03
subsystem: backend-and-ui
tags: [attachments, media-cards, relaunch, regression, electron]
requires:
  - phase: 02-capture-and-save-flows
    provides: recording upload seam, managed import flow, and shared backend media storage
provides:
  - backend attachment-content delivery for saved media previews
  - desktop saved-media cards with audio/video playback and generic file open/remove actions
  - relaunch regression coverage for persisted recordings and imports
affects: [transcription, sync, settings]
tech-stack:
  added: []
  patterns: [attachment content URL helper, reusable media card component, reopen persistence regression]
key-files:
  created:
    - apps/desktop/src/renderer/components/media-card.jsx
    - apps/backend/test/media-persistence.test.js
    - apps/desktop/test/media-card.test.jsx
  modified:
    - apps/backend/src/contracts/v1/attachments.js
    - apps/backend/src/contracts/index.js
    - apps/backend/src/routes/attachments.js
    - apps/backend/src/services/attachments-service.js
    - apps/desktop/src/main/main.js
    - apps/desktop/src/main/preload.js
    - apps/desktop/src/renderer/App.jsx
    - apps/desktop/test/capture-review.test.jsx
    - apps/desktop/test/media-import.test.jsx
key-decisions:
  - "Saved attachment previews resolve through a backend content route instead of exposing raw file paths directly to media elements."
  - "Audio and video keep playback-focused cards, while generic files stay simpler with explicit open/remove actions."
  - "Phase 2 verification closes with full backend and desktop regression suites, with native rebuilds used only when the local SQLite binding drifts."
patterns-established:
  - "Attachment preview pattern: preload resolves a backend content URL by attachment id, and media cards consume that URL for audio/video playback."
  - "Persistence regression pattern: save media, reopen the backend against the same data root, and assert attachments still list and exist on disk."
requirements-completed: [CAP-04, CAP-05]
duration: 7min
completed: 2026-03-30
---

# Phase 02 Plan 03: Capture and Save Flows Summary

**Saved recordings and imports now render as playable/openable media cards, and Phase 2 has relaunch coverage proving those attachments survive backend reopen**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-30T05:07:44Z
- **Completed:** 2026-03-30T05:14:37Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments

- Added backend attachment content delivery plus desktop preload/main helpers so saved audio and video can resolve preview URLs by attachment id and generic files can open through `shell.openPath`.
- Replaced the plain attachment rows in the note workspace with reusable saved-media cards for audio, video, and generic files.
- Added relaunch and media-card regressions, including a backend reopen test that proves recordings and imports remain listed from the same data root after the server/database are recreated.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add attachment content delivery and desktop preview/open helpers** - `4f9dfbf` (`feat`)
2. **Task 2: Replace plain attachment rows with Phase 2 media cards** - `357bae3` (`feat`)
3. **Task 3: Add relaunch and media-card regression coverage** - `eb79f75` (`test`)

**Plan metadata:** pending final completion commit

## Files Created/Modified

- `apps/backend/src/contracts/v1/attachments.js` - backend contract for attachment content delivery
- `apps/backend/src/routes/attachments.js` - attachment content route with streamed file responses
- `apps/backend/src/services/attachments-service.js` - attachment lookup and file existence/content streaming helpers
- `apps/desktop/src/main/main.js` - preview URL resolution and explicit file opening through Electron main
- `apps/desktop/src/main/preload.js` - `getAttachmentContentUrl()` and `openPath()` exposed to the renderer
- `apps/desktop/src/renderer/components/media-card.jsx` - reusable saved-media card rendering for audio, video, and generic files
- `apps/desktop/src/renderer/App.jsx` - saved-media section upgraded from plain rows to media cards
- `apps/backend/test/media-persistence.test.js` - reopen regression covering recorded and imported media
- `apps/desktop/test/media-card.test.jsx` - workspace regression for playable/openable saved-media cards
- `apps/desktop/test/capture-review.test.jsx` - capture-save regression updated to assert the saved media state
- `apps/desktop/test/media-import.test.jsx` - import regression updated to assert the saved media state

## Decisions Made

- Kept preview delivery backend-owned so the same attachment id contract can support future transcript and sync surfaces without renderer-side path assumptions.
- Preserved the approved Phase 2 scope boundary: audio/video cards stop at basic playback, while generic files remain lightweight and explicit.
- Verified backend and desktop suites sequentially after a native rebuild so the final phase check reflects the real code path instead of the known local SQLite ABI drift.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Rebuilt `better-sqlite3` again immediately before the full backend verification**
- **Found during:** final `02-03` verification
- **Issue:** the full backend suite started seeing the SQLite native module compiled for Electron again, which produced false 400/500 failures unrelated to the saved-media work.
- **Fix:** Ran `npm run rebuild:native`, then reran `npm run test --workspace @privanote/backend` and `npm run test --workspace @privanote/desktop` sequentially.
- **Files modified:** none
- **Verification:** `npm run rebuild:native`, `npm run test --workspace @privanote/backend`, `npm run test --workspace @privanote/desktop`
- **Committed in:** not applicable

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** No feature changes were needed, but the rebuild was required to make the final backend verification accurate.

## Issues Encountered

- The local `better-sqlite3` binding continues to drift between Node and Electron ABIs after some npm operations, so backend verification remains reliable only after rebuilding for the current Node runtime.
- Saved-media preview URLs had to be resolved asynchronously through preload, so the media-card regression layer now waits for preview helpers instead of asserting purely synchronous DOM updates.

## User Setup Required

None - saved media cards use the existing local backend and Electron shell with no extra services or credentials.

## Next Phase Readiness

- Phase 2 is complete: capture, import, save, playback/open, and relaunch visibility are all covered.
- The next logical step is Phase 3 planning for transcription orchestration and settings now that saved media have a stable attachment-content surface.

---
*Phase: 02-capture-and-save-flows*
*Completed: 2026-03-30*
