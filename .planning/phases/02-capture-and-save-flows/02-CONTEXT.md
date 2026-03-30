# Phase 2: Capture and Save Flows - Context

**Gathered:** 2026-03-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Let users capture new audio/video media or import existing media/files from the desktop app, persist the result through the local backend, and see the saved media again after relaunch as part of the note workflow. This phase covers capture, import, save, and relaunch visibility only; transcription, settings, sync, and advanced media editing remain out of scope.

</domain>

<decisions>
## Implementation Decisions

### Capture Entry and Note Ownership
- **D-01:** Recording and import must be available even when no existing note is selected.
- **D-02:** The default ownership model for new capture/import is to auto-create a new note rather than requiring the user to choose an existing note first.
- **D-03:** Import follows the same default ownership model as recording: if no note is selected, Privanote creates a new note automatically and attaches the imported media there.
- **D-04:** Capture modes are audio, video, or "both"; "both" means a single video recording with audio included, not two separate saved attachments.
- **D-05:** Auto-created notes should start with a generated placeholder title based on capture/import type and time, then remain editable in the normal note editor.

### Recording Review and Failure Handling
- **D-06:** When a recording stops, the result enters a temporary review state before persistence rather than saving immediately.
- **D-07:** The review state is intentionally lightweight in Phase 2: the user can `Save` or `Discard`, without trimming, retakes, or richer editing tools.
- **D-08:** If microphone/camera permission is denied, blocked, or no device is available, the app should show a clear inline error in the capture area and let the user retry or switch to import without breaking the rest of the note workflow.

### Storage Ownership and Media Presentation
- **D-09:** Imported media must be copied into app-managed storage rather than relying only on the original external file path.
- **D-10:** Saved audio and video should appear as rich media cards with basic preview/play behavior in the workspace and after relaunch.
- **D-11:** Generic file attachments should stay simpler than recorded media cards rather than receiving the same rich treatment as audio/video.
- **D-12:** Playback and preview controls in Phase 2 stay basic only: play/pause plus simple open/remove behavior where relevant.

### the agent's Discretion
- Exact generated placeholder title format, as long as it reflects capture/import type and time.
- Exact capture-area layout, button wording, and inline error presentation within the existing desktop workspace.
- Backend file naming, copy/write mechanics, and folder layout inside app-managed storage.
- Exact metadata shown on saved media cards beyond the locked requirement for basic preview/play.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Scope and Constraints
- `.planning/ROADMAP.md` — Phase 2 goal, success criteria, and planned slices for capture UX, import persistence, and relaunch visibility.
- `.planning/PROJECT.md` — Product constraints for local-first behavior, single-user/no-auth v1, local backend packaging, and the requirement to support both recording and importing media.
- `.planning/REQUIREMENTS.md` — Phase 2 capture requirements `CAP-01` through `CAP-05`.

### Prior Locked Decisions
- `.planning/phases/01-monorepo-and-local-backend-foundation/01-CONTEXT.md` — Locked architectural constraints: separate desktop/backend packages, backend-owned contracts, contracts-only sharing, backend-agnostic desktop, and preserved local-backend/no-auth behavior.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/desktop/src/renderer/App.jsx` — Already owns note selection, attachment listing, attachment creation/removal UI, and the current workspace layout that Phase 2 capture/import flows will extend.
- `apps/desktop/src/lib/backend-client.js` — Existing desktop-side contract client surface that new capture/import operations should continue to use.
- `apps/desktop/src/main/preload.js` — Existing desktop bridge pattern for renderer-safe native access, including the current file picker entry point.
- `apps/backend/src/services/attachments-service.js` — Current backend attachment persistence rules and validation, which Phase 2 will expand from path-based attachment creation to managed capture/import save flows.
- `apps/backend/src/storage/attachment-files.js` — Existing app-managed attachment storage helpers and delete behavior that can anchor copied imports and recorded media persistence.

### Established Patterns
- The desktop renderer already centers note work around a selected note plus an attachment section, so capture/import additions should fit the existing workspace rather than introducing a separate standalone application area.
- The backend already owns attachment persistence and deletion behavior behind versioned contracts, so Phase 2 should keep media save logic backend-owned rather than moving file writes into the renderer.
- Current attachment records support `audio`, `video`, and `file`, which aligns with the Phase 2 media categories.
- There is no existing recording implementation or `MediaRecorder` flow in the codebase yet, so device capture is a net-new UI/runtime surface.

### Integration Points
- New desktop capture UX should connect to the note workspace in `apps/desktop/src/renderer/App.jsx`, including auto-created notes, review state, inline failure handling, and richer saved media cards.
- New desktop/backend contract operations will need to extend the current backend-owned contract set under `apps/backend/src/contracts/`.
- Backend persistence changes will need to connect managed saved media into the existing attachment/storage pipeline so relaunch and delete behavior stay consistent with Phase 1 foundations.

</code_context>

<specifics>
## Specific Ideas

- "the user can start recording audio video or both and this by default will be a note"
- Import should follow the same default note-creation behavior when no note is selected.
- "both" should be treated as one video recording with audio included.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-capture-and-save-flows*
*Context gathered: 2026-03-29*
