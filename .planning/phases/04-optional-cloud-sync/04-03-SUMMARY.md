---
phase: 04-optional-cloud-sync
plan: 03
subsystem: ui
tags: [sync, settings, react, electron, media-cards]
requires:
  - phase: 04-optional-cloud-sync
    provides: provider connection contracts, attachment sync fields, and durable sync rules
provides:
  - desktop bridge methods for provider connect/disconnect/retry
  - settings cloud-sync section with provider cards and destination validation
  - compact media-card sync badges and retry flow
  - relaunch-safe sync persistence coverage across backend and desktop
affects: [phase-completion, sync-ux, settings-shell]
tech-stack:
  added: []
  patterns: [backend-owned sync polling, compact card sync states, local-first failure messaging]
key-files:
  created: []
  modified:
    - apps/desktop/src/lib/backend-client.js
    - apps/desktop/src/main/main.js
    - apps/desktop/src/main/preload.js
    - apps/desktop/src/renderer/App.jsx
    - apps/desktop/src/renderer/components/settings-view.jsx
    - apps/desktop/src/renderer/components/media-card.jsx
    - apps/backend/test/sync-persistence.test.js
    - apps/desktop/test/settings-view.test.jsx
    - apps/desktop/test/media-card.test.jsx
key-decisions:
  - "The renderer only launches the browser and polls provider status; provider connection remains a backend-owned workflow."
  - "Sync state stays compact on media cards so local preview/open/remove controls remain primary."
  - "Disconnected cloud destinations are blocked at save time instead of being accepted as unusable preferences."
patterns-established:
  - "Pattern 1: renderer polling is short-lived and only active while a provider connection is pending."
  - "Pattern 2: local-first messaging stays visible even when sync fails or transcript patching is still pending."
requirements-completed: [SYNC-03, SYNC-04, SYNC-05]
duration: 28min
completed: 2026-03-30
---

# Phase 04 Plan 03 Summary

**Desktop sync controls, compact media-card cloud states, and relaunch-safe sync persistence coverage**

## Performance

- **Duration:** 28 min
- **Started:** 2026-03-30T21:34:00Z
- **Completed:** 2026-03-30T22:02:00Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- Extended the desktop bridge with provider connect/disconnect/retry operations and external-browser launch support for provider authorization.
- Added a `Cloud sync` settings section with provider cards, default-destination messaging, connection polling, disconnect confirmation, and invalid-destination guarding.
- Added compact media-card sync badges, transcript-pending helper copy, retry actions, and relaunch coverage for persisted sync fields.

## Task Commits

1. **Task 1: Expose backend-owned sync operations and provider browser launch through the desktop bridge** - `ff170f9` (`feat`)
2. **Task 2: Extend Settings with provider connection cards and exact default-destination messaging** - `ff170f9` (`feat`)
3. **Task 3: Render compact sync states and retry actions on media cards with relaunch-safe regression coverage** - `c201f57`, `ff170f9` (`feat`)

## Files Created/Modified

- `apps/desktop/src/lib/backend-client.js` - adds provider connection and retry client helpers
- `apps/desktop/src/main/main.js` - adds `shell:open-external`
- `apps/desktop/src/main/preload.js` - exposes `openExternalUrl`
- `apps/desktop/src/renderer/App.jsx` - loads provider connections, polls pending connections, validates default destinations, and refreshes attachments after retries
- `apps/desktop/src/renderer/components/settings-view.jsx` - renders the cloud sync provider cards and destination guidance
- `apps/desktop/src/renderer/components/media-card.jsx` - renders compact sync badges, transcript-pending helper text, and retry UI
- `apps/backend/test/sync-persistence.test.js` - verifies sync fields survive backend relaunch
- `apps/desktop/test/settings-view.test.jsx` - verifies provider cards, connect/disconnect behavior, and blocked disconnected destinations
- `apps/desktop/test/media-card.test.jsx` - verifies synced, failed, and transcript-pending media-card states

## Decisions Made

- Opened provider authorization in the system browser instead of embedding the flow inside the renderer window.
- Kept the media-card sync state compact and textual to preserve the existing workspace rhythm.
- Refreshed attachments after retries and completed provider polling so the selected note remains stable while sync state changes underneath it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] The renderer needed graceful fallbacks while older preload surfaces are still possible during reloads**
- **Found during:** Task 1 and Task 2 (desktop bridge wiring)
- **Issue:** During test setup and renderer boot, the sync bridge can be temporarily absent or partially mocked, which would have made the new settings surface crash instead of degrading cleanly.
- **Fix:** Added safe fallbacks in `App.jsx` for sync operations and browser launching so the workspace keeps rendering while provider capabilities hydrate.
- **Files modified:** `apps/desktop/src/renderer/App.jsx`
- **Verification:** `npm run test --workspace @privanote/desktop -- settings-view.test.jsx media-card.test.jsx`
- **Committed in:** `ff170f9`

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** The desktop sync UX remains robust during reloads, tests, and partial bridge availability without changing the intended user flow.

## Issues Encountered

- The same `better-sqlite3` ABI drift still applies to root verification because the desktop test pass depends on the backend suite remaining on the Node 20 native build.

## User Setup Required

None for verification. Real provider connections require valid cloud app credentials and callback configuration.

## Next Phase Readiness

- Phase 4 now has the sync UX, retry messaging, and provider settings surface needed to mark the cloud-sync milestone complete.
- Future work can add richer cloud-management behaviors without changing the current local-first sync contract.

---
*Phase: 04-optional-cloud-sync*
*Completed: 2026-03-30*
