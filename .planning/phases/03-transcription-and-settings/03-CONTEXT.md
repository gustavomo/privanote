# Phase 3: Transcription and Settings - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Add transcript generation for saved audio/video attachments and the settings surface needed to control storage destination preferences, transcription mode, and backend provider credentials. This phase covers transcript creation, transcript persistence and retry behavior, local-vs-backend mode selection, and local settings persistence. Cloud upload/sync execution, transcript editing/history, and richer transcript formats remain out of scope.

</domain>

<decisions>
## Implementation Decisions

### Transcript Trigger and Ownership
- **D-01:** Transcription should auto-start after a recording or import is saved instead of requiring a manual trigger.
- **D-02:** The common ownership model is one media attachment per note, and that attachment owns the transcript for the note.
- **D-03:** If a transcript is regenerated, or if a different primary media attachment later becomes the note's main media, the existing transcript should be replaced in place rather than versioned.

### Transcript Presentation and Behavior
- **D-04:** Transcripts should appear in a dedicated transcript section inside the active note, separate from the user-authored note description.
- **D-05:** Transcript output should be plain text only in Phase 3.
- **D-06:** The transcript remains read-only in Phase 3 rather than editable in place.
- **D-07:** Transcript loading, failure, retry, and regenerated-state feedback should stay inline in the transcript section.
- **D-08:** If auto-transcription fails, Privanote should retry automatically a small fixed number of times, then show a failed state.

### Transcription Modes and Provider Strategy
- **D-09:** Transcription mode is one app-wide setting rather than a per-note or per-job choice.
- **D-10:** `Local` transcription must work out of the box inside Privanote.
- **D-11:** `Local` transcription should use app-managed first-use download/setup rather than requiring a fully bundled model or manual user tooling setup.
- **D-12:** `Backend` transcription should support exactly one specific built-in provider in Phase 3, not multiple providers or a generic custom endpoint.
- **D-13:** The built-in backend provider for Phase 3 is OpenAI Whisper-style.

### Settings and Storage Behavior
- **D-14:** Settings should live in a dedicated Settings view/panel rather than being mixed into the note workspace.
- **D-15:** When the user changes the local folder path, the new path should apply only to future local saves rather than migrating existing data.
- **D-16:** Storage destination is a user preference surface that may offer `Local`, `Google Drive`, and `OneDrive` as choices, but actual cloud upload/sync behavior is still deferred to Phase 4.
- **D-17:** Backend provider credential fields should appear only when `Backend` transcription mode is selected.
- **D-18:** Backend credentials should be stored locally, masked in the UI, and validated when the user saves settings.

### the agent's Discretion
- Exact retry count and backoff policy inside the locked "small fixed number of retries" rule.
- Exact transcript section layout, labels, and status copy, as long as it remains separate from the note description.
- Exact first-use local model download/setup UX, including progress messaging and readiness states.
- Exact local credential persistence mechanism, as long as it stays local, masked in the UI, and validates on save.
- Handling for rare multi-attachment notes, as long as the common case remains one attachment owning one transcript.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Scope and Product Constraints
- `.planning/ROADMAP.md` — Phase 3 goal, success criteria, and planned slices for transcription orchestration, settings persistence, and provider validation.
- `.planning/PROJECT.md` — Product-level constraints for local-first behavior, no auth in v1, configurable local/backend transcription, and optional Google Drive/OneDrive destinations.
- `.planning/REQUIREMENTS.md` — Phase 3 requirements `TRNS-01` through `TRNS-04` and `SET-01` through `SET-05`.

### Prior Locked Decisions
- `.planning/phases/01-monorepo-and-local-backend-foundation/01-CONTEXT.md` — Architectural rules that still apply: separate desktop/backend packages, backend-owned contracts, contracts-only sharing, backend-agnostic desktop, and preserved local/no-auth operation.
- `.planning/phases/02-capture-and-save-flows/02-CONTEXT.md` — Locked capture/import and media-presentation decisions, including note-owned media, basic preview/play cards, and local managed storage.

### Existing Direction That Constrains Phase 3
- `.planning/phases/02-capture-and-save-flows/02-03-SUMMARY.md` — Documents the current saved-media card surface and attachment-content delivery path that transcript UX must build on.
- `.planning/codebase/CONCERNS.md` — Notes that storage should become configurable in settings and that the renderer currently centralizes too much UI state, both of which are directly relevant to Phase 3 planning.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/desktop/src/renderer/App.jsx` — Current single-workspace note UI already renders the active note, capture panel, and saved media section where transcript output will need to appear.
- `apps/desktop/src/renderer/components/media-card.jsx` — Existing saved-media card component is the established surface around media attachments and could host transcript affordances or status cues without replacing the dedicated transcript section.
- `apps/desktop/src/lib/backend-client.js` and `apps/desktop/src/main/preload.js` — Existing desktop-side backend client and preload bridge patterns should carry new transcript/settings contract calls.
- `apps/backend/src/contracts/`, `apps/backend/src/routes/`, and `apps/backend/src/services/` — Existing backend-owned versioned contract and route/service pattern should be reused for transcript jobs and persisted settings.
- `apps/backend/src/storage/runtime-paths.js` and `apps/backend/src/storage/database.js` — Current local data root and SQLite schema/bootstrap code are the natural integration points for storage preferences and any new settings/transcript persistence tables.
- `apps/backend/src/services/media-service.js` — Current save/import orchestration is the existing backend seam that successful media persistence should connect to when auto-transcription starts.

### Established Patterns
- Desktop and backend communicate only through backend-owned contracts; renderer code does not talk directly to storage or external services.
- Saved media are already note-owned managed attachments, and audio/video preview uses the backend attachment-content route instead of raw renderer file access.
- The current desktop UI is still a single note workspace with no separate settings surface or transcript section yet.
- There is no existing transcript schema, settings persistence layer, external provider integration, or local transcription runtime in the codebase today.

### Integration Points
- Auto-transcription should connect to successful `saveRecording` and `importMedia` backend flows so transcript jobs stay backend-owned.
- Transcript text and status need to render in the active note pane without collapsing into the user-authored description field.
- Settings need a persisted backend configuration surface plus a desktop navigation entry from the current workspace shell.
- Storage-destination choices must align with the existing `resolveDataRoot()` and managed-attachments structure while keeping cloud transfer execution deferred to Phase 4.

</code_context>

<specifics>
## Specific Ideas

- "well the commons will be that a note just have an attatment file, and that will the trancript"
- "the destiny is just an option for the user to have the fredoom to chose in what place save its information, this could be local, in google drive or one drive"
- "is not to migrate from local to cloud options"
- Backend transcription in Phase 3 should be one specific built-in provider, fixed to OpenAI Whisper-style.

</specifics>

<deferred>
## Deferred Ideas

- Actual Google Drive or OneDrive upload/sync execution remains Phase 4 work even if destination preferences appear in Phase 3 settings.
- Transcript history/versioning, direct transcript editing, timestamped output, and speaker-aware transcript formats are deferred beyond Phase 3.

</deferred>

---

*Phase: 03-transcription-and-settings*
*Context gathered: 2026-03-30*
