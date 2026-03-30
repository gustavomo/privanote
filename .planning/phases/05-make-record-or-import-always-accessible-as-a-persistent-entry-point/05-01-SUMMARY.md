---
phase: 05-make-record-or-import-always-accessible-as-a-persistent-entry-point
plan: 01
subsystem: ui
tags: [react, jsx, capture-first, sidebar, workspace-layout]

# Dependency graph
requires:
  - phase: 04-optional-cloud-sync
    provides: full workspace App.jsx with capture panel, media sync badges, provider controls
provides:
  - Capture panel permanently docked at sidebar top with single render site
  - Right panel informational empty state when no note is selected
  - No Create Note form — capture auto-creates notes via recording or import
affects: [future ui phases, any plan modifying App.jsx layout or capture flow]

# Tech tracking
tech-stack:
  added: []
  patterns: [capture-first note creation, persistent sidebar entry point]

key-files:
  created: []
  modified:
    - apps/desktop/src/renderer/App.jsx
    - apps/desktop/test/app.note-flow.test.jsx
    - apps/desktop/test/capture-review.test.jsx

key-decisions:
  - "Capture panel is now a sidebar fixture — no longer conditionally rendered inside the note detail view"
  - "Create Note form and its three state variables (newNodeTitle, newNodeDescription, newNodeTags) removed entirely"
  - "Right panel empty state shows informational copy only — no capture panel duplication"

patterns-established:
  - "renderCapturePanel() has exactly one call site in the sidebar aside element"
  - "Notes are a result of capture, not a prerequisite — auto-created on recording save or import"

requirements-completed: [UX-01]

# Metrics
duration: 14min
completed: 2026-03-30
---

# Phase 05 Plan 01: Persistent Capture Entry Point Summary

**Capture panel moved to persistent sidebar top position — Create Note form removed, notes auto-created from recording or import, single renderCapturePanel() render site**

## Performance

- **Duration:** 14 min
- **Started:** 2026-03-30T22:56:27Z
- **Completed:** 2026-03-30T23:10:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Restructured App.jsx sidebar: capture panel always visible at top, notes list below in scrollable flex-1 container
- Removed Create Note form (3 state variables + handleCreateNode handler) — no manual note creation path remains
- Updated right panel empty state to show "Select a note to view it" with supporting copy (no capture panel)
- Updated app.note-flow.test.jsx: two tests replaced to cover capture-first flow and seed-based note deletion
- All 21 tests pass across 9 test files after the refactor

## Task Commits

Each task was committed atomically:

1. **Task 1: Refactor App.jsx — persistent sidebar capture panel, remove Create Note form** - `45cdeef` (feat)
2. **Task 2: Update app.note-flow.test.jsx — replace Create Note assertions with capture-first coverage** - `70a8b90` (feat)

## Files Created/Modified
- `apps/desktop/src/renderer/App.jsx` - Sidebar restructured with capture panel at top; Create Note form and state removed; right panel empty state replaced
- `apps/desktop/test/app.note-flow.test.jsx` - Two tests replaced with capture-first assertions
- `apps/desktop/test/capture-review.test.jsx` - Stale 'Capture Your First Note' assertion updated to 'Capture' (auto-fix)

## Decisions Made
- `renderCapturePanel()` is now called exactly once, in the `<aside>` element at the top of the sidebar before the notes section header
- The sidebar uses `flex flex-col` layout so the capture panel stays fixed while the notes list occupies remaining scrollable space
- The note detail view remains intact: editable title, description, tags, Save Changes form, TranscriptSection, and Saved Media panel are untouched

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed stale 'Capture Your First Note' assertion in capture-review.test.jsx**
- **Found during:** Task 2 (test run after updating app.note-flow.test.jsx)
- **Issue:** capture-review.test.jsx line 159 asserted `findAllByText('Capture Your First Note')` which no longer exists after the heading change in Task 1
- **Fix:** Updated assertion to `findByText('Capture')` matching the new panel heading
- **Files modified:** apps/desktop/test/capture-review.test.jsx
- **Verification:** All 21 tests pass — `npm test --workspace @privanote/desktop` exits 0
- **Committed in:** `70a8b90` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug directly caused by Task 1 heading change)
**Impact on plan:** Auto-fix was required to achieve the success criterion of all tests passing. No scope creep.

## Issues Encountered
- `findByText('Architecture note')` in the new Test 2 failed because the note title appears in both the sidebar list and the note detail header — fixed by using `findAllByText` with a length assertion.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Capture-first workspace layout is complete and all tests pass
- Phase 5 is now fully executed — no further plans in this phase
- The persistent capture panel pattern is established; future phases modifying App.jsx should maintain the single render site rule

---
*Phase: 05-make-record-or-import-always-accessible-as-a-persistent-entry-point*
*Completed: 2026-03-30*
