---
phase: 02-capture-and-save-flows
plan: 01
subsystem: ui
tags: [electron, fastify, multipart, mediarecorder, permissions]
requires:
  - phase: 01-monorepo-and-local-backend-foundation
    provides: backend-owned contracts, local backend runtime, and desktop preload transport
provides:
  - backend recording upload contract and multipart save endpoint
  - desktop binary upload bridge with macOS media permission plumbing
  - review-first recording workspace for audio, video, and video-with-audio
affects: [imports, media-cards, transcription]
tech-stack:
  added: [@fastify/multipart]
  patterns: [binary upload IPC bridge, review-first capture flow, packaged media permission metadata]
key-files:
  created:
    - apps/backend/src/contracts/v1/media.js
    - apps/backend/src/routes/media.js
    - apps/backend/src/services/media-service.js
    - apps/backend/test/media-recording.test.js
    - apps/desktop/test/capture-review.test.jsx
  modified:
    - apps/backend/src/server.js
    - apps/backend/src/contracts/index.js
    - apps/backend/package.json
    - apps/desktop/src/lib/backend-client.js
    - apps/desktop/src/main/main.js
    - apps/desktop/src/main/preload.js
    - apps/desktop/electron-builder.yml
    - apps/desktop/src/renderer/App.jsx
key-decisions:
  - "Use a dedicated backend-owned multipart recording route instead of forcing blobs through the JSON contract path."
  - "Proxy recorded bytes through Electron main with backend:upload so renderer capture stays local while persistence remains backend-owned."
  - "Create placeholder notes at capture start and clean them up on discard only when the note is still untouched and attachment-free."
patterns-established:
  - "Media upload pattern: renderer builds bytes, preload invokes backend:upload, and main proxies multipart to the local backend."
  - "Capture UX pattern: audio/video/video+audio record into review, then Save Recording or Discard Recording."
requirements-completed: [CAP-01, CAP-02, CAP-04]
duration: 16min
completed: 2026-03-30
---

# Phase 02 Plan 01: Capture and Save Flows Summary

**Recording uploads now cross the Electron boundary through a multipart backend seam, with review-first capture UI and packaged macOS media permission plumbing**

## Performance

- **Duration:** 16 min
- **Started:** 2026-03-30T04:29:08Z
- **Completed:** 2026-03-30T04:45:08Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments

- Added `v1.media.saveRecording` with a real multipart backend route that writes managed recording files and returns `{ node, attachment }`.
- Extended the desktop transport with `backend:upload`, `saveRecording`, and macOS camera/microphone permission plumbing plus packaged usage-description strings.
- Reworked the workspace into a review-first recorder for `Audio`, `Video`, and `Video + Audio`, with inline failure handling and regression coverage.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add a backend-owned multipart recording save endpoint and contract** - `d57a40f` (`feat`)
2. **Task 2: Add a desktop binary upload bridge and packaged camera/microphone permission plumbing** - `7fb91dc` (`feat`)
3. **Task 3: Add the capture panel, review state, and desktop recording regressions** - `a38a89d` (`feat`)

**Plan metadata:** pending final completion commit

## Files Created/Modified

- `apps/backend/src/contracts/v1/media.js` - backend-owned recording save contract
- `apps/backend/src/routes/media.js` - multipart recording route wired to backend services
- `apps/backend/src/services/media-service.js` - managed recording persistence with note orchestration
- `apps/backend/test/media-recording.test.js` - backend regression for unauthenticated recording saves
- `apps/desktop/src/lib/backend-client.js` - desktop saveRecording client binding
- `apps/desktop/src/main/main.js` - binary upload proxy plus permission IPC handlers
- `apps/desktop/src/main/preload.js` - upload and permission APIs exposed to the renderer
- `apps/desktop/electron-builder.yml` - packaged macOS camera/microphone usage descriptions
- `apps/desktop/src/renderer/App.jsx` - capture-first review workflow in the workspace
- `apps/desktop/test/capture-review.test.jsx` - audio/video review and permission-failure regression coverage

## Decisions Made

- Kept recording persistence backend-owned by posting multipart data from Electron main to the local backend instead of writing files directly from the renderer.
- Used renderer-side `MediaRecorder` with runtime MIME support checks so the approved capture modes stay lightweight and browser-native.
- Preserved the old manual attachment entry temporarily under the new recorder so Wave 2 can replace it cleanly with the managed import flow.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Pinned @fastify/multipart to the Fastify 4-compatible line**
- **Found during:** Task 1 (Add a backend-owned multipart recording save endpoint and contract)
- **Issue:** Installing the default `@fastify/multipart` release pulled in the Fastify 5 line and caused the backend server to reject plugin registration.
- **Fix:** Reinstalled the dependency on the Fastify 4-compatible `^8.3.1` line and regenerated the lockfile before rerunning the backend recording test.
- **Files modified:** `apps/backend/package.json`, `package-lock.json`
- **Verification:** `npm run test --workspace @privanote/backend -- media-recording.test.js`
- **Committed in:** `d57a40f`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The fix stayed inside the planned upload seam and was required to keep the existing Electron/Fastify 4 packaging line intact.

## Issues Encountered

- Rebuilding backend dependencies after the multipart install flipped `better-sqlite3` back to the Electron ABI, so `npm run rebuild:native` was required before the backend recording test could pass under the current Node runtime.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `02-02` can reuse the new media contract/service area to add import orchestration and shared managed media storage helpers.
- The recorder UI, placeholder-note behavior, and upload bridge are stable, so the next step is replacing raw-path attachment entry with backend-managed imports.

---
*Phase: 02-capture-and-save-flows*
*Completed: 2026-03-30*
