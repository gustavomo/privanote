# Phase 4: Optional Cloud Sync - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend Privanote's local-first workflow with optional Google Drive and OneDrive sync for note-owned media. This phase covers provider connection, automatic sync based on the selected default destination, sync-state presentation, remote file/update behavior, and preserving a local copy of media and transcript data while cloud sync runs. Cross-device conflict resolution, destructive remote cleanup, cloud-only notes, and full cloud note replication remain out of scope.

</domain>

<decisions>
## Implementation Decisions

### Provider Connection and Destination Model
- **D-01:** Provider connection should happen from Settings with provider-specific `Connect` actions and persisted connected state.
- **D-02:** Users may connect both Google Drive and OneDrive, but each attachment syncs to exactly one selected provider rather than mirroring to both.
- **D-03:** Provider connections should persist locally and refresh when possible so automatic sync can continue across sessions.
- **D-04:** Disconnecting a provider removes the live local connection only; already-synced remote files stay in that provider account.

### Automatic Sync Scope and Default-Destination Rules
- **D-05:** Cloud sync should start automatically for future saves based on the current default destination selected in Settings.
- **D-06:** If the default destination changes, older unsynced local attachments should be queued automatically to the new default provider.
- **D-07:** Changing the default destination must not migrate or re-home attachments that were already synced to a previous provider; those stay where they were synced originally.

### Synced Payload and Remote Organization
- **D-08:** Phase 4 cloud sync should upload the media file, transcript text, and a small metadata sidecar with note context and sync bookkeeping.
- **D-09:** Each provider account should have one Privanote app root folder rather than scattering synced files across arbitrary provider locations.
- **D-10:** Under the provider app root, Privanote should create one folder per note so a note's media, transcript, and metadata stay grouped together.
- **D-11:** If cloud sync begins before transcript generation finishes, Privanote should upload the media first and patch the cloud note folder later with transcript and metadata updates.

### Sync State, Failure Handling, and Resync Behavior
- **D-12:** Sync failure must not affect local usability; the attachment remains fully usable locally and should show a failed sync state with retry.
- **D-13:** Media cards should show compact sync badges and retry actions rather than a heavyweight sync panel or a settings-only status surface.
- **D-14:** Resync/update behavior should keep one cloud copy per provider target and update or overwrite that copy instead of creating duplicates.

### the agent's Discretion
- Exact sync badge wording, iconography, and card-level layout as long as states remain compact and clearly distinguish local-only, syncing, synced, and failed.
- Exact metadata sidecar schema, filename conventions, and provider bookkeeping fields as long as note context and sync bookkeeping are preserved.
- Exact token/refresh persistence mechanism for provider connections, as long as connections persist locally and can refresh when possible.
- Exact queue backoff, batching, and retry timing for automatic sync jobs within the locked local-first and retry-visible behavior.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Scope and Product Constraints
- `.planning/ROADMAP.md` — Phase 4 goal, success criteria, and planned slices for Google Drive integration, OneDrive integration, and sync-state UI.
- `.planning/PROJECT.md` — Product-level constraints for local-first behavior, optional Google Drive/OneDrive sync, single-user v1, and keeping local control over saved media.
- `.planning/REQUIREMENTS.md` — Phase 4 sync requirements `SYNC-01` through `SYNC-05`.

### Prior Locked Decisions
- `.planning/phases/01-monorepo-and-local-backend-foundation/01-CONTEXT.md` — Architectural constraints that still apply: separate desktop/backend packages, backend-owned contracts, backend-agnostic desktop, and no-auth local operation.
- `.planning/phases/02-capture-and-save-flows/02-CONTEXT.md` — Locked note-owned media, managed storage, and saved-media presentation decisions that sync must build on.
- `.planning/phases/03-transcription-and-settings/03-CONTEXT.md` — Locked storage-destination preferences, one provider surface in Settings, local-first storage behavior, and transcript ownership/persistence rules.

### Existing Direction That Constrains Phase 4
- `.planning/phases/02-capture-and-save-flows/02-03-SUMMARY.md` — Documents the current saved-media card surface and attachment content delivery path where sync states/actions will appear.
- `.planning/phases/03-transcription-and-settings/03-02-SUMMARY.md` — Documents the current settings shell and destination-preference behavior that provider connection and default-destination controls must extend.
- `.planning/phases/03-transcription-and-settings/03-03-SUMMARY.md` — Documents the current transcript section and retry/state behavior that cloud sync timing must coexist with.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/desktop/src/renderer/components/settings-view.jsx` — Already exposes `Local`, `Google Drive`, and `OneDrive` destination choices inside the dedicated Settings view, making it the natural connection/default-destination surface for Phase 4.
- `apps/desktop/src/renderer/components/media-card.jsx` — Existing saved-media card component is the established place to render compact sync badges and retry actions.
- `apps/desktop/src/renderer/App.jsx` — Already coordinates the workspace/settings shell, note/media loading, transcript loading, and card actions that sync states must plug into.
- `apps/desktop/src/lib/backend-client.js` and `apps/desktop/src/main/preload.js` — Existing desktop-side backend contract/client bridge should carry any new provider and sync operations.
- `apps/backend/src/contracts/`, `apps/backend/src/routes/`, and `apps/backend/src/services/` — Existing backend-owned versioned contract and route/service pattern should be reused for provider connection, sync jobs, and sync metadata.
- `apps/backend/src/services/media-service.js` and `apps/backend/src/services/transcription-runner.js` — Existing backend-owned save/import and transcript queue paths are the natural places to enqueue automatic sync work and later transcript/metadata patch updates.

### Established Patterns
- Storage destination already exists as a persisted backend-owned setting, but actual cloud provider auth and sync execution do not exist yet.
- Media are note-owned managed attachments, and transcripts are note-scoped persisted records that can complete asynchronously after media save/import.
- The desktop UI is still centered on one workspace with saved-media cards plus a dedicated Settings view, so sync should extend those surfaces rather than inventing a separate sync application area.
- The app remains local-first and no-auth in v1, so provider sync must stay optional and must not block local note/media use.

### Integration Points
- Settings needs provider-specific connect/disconnect/default-destination controls layered onto the existing destination preference surface.
- Successful media save/import should be able to enqueue automatic sync work after local persistence succeeds.
- Transcript completion should be able to trigger a follow-up cloud metadata/transcript update for already-synced note folders.
- Attachment persistence and metadata storage will need new sync-state bookkeeping beyond the current `cloud_url` placeholder so the app can distinguish local-only, syncing, synced, and failed states reliably.

</code_context>

<specifics>
## Specific Ideas

- "the user can connect both, but will exist a option to choose just one"
- "the project create a folder thath create a folder for each note"
- Cloud sync should include the media file, transcript text, and a metadata sidecar rather than only the raw media binary.

</specifics>

<deferred>
## Deferred Ideas

- Mirroring the same attachment to both providers at once.
- Migrating already-synced attachments when the default provider changes.
- Prompted or automatic destructive remote cleanup during provider disconnect.
- Full cloud note replication or a richer cloud package beyond media, transcript, and compact metadata sidecar.

</deferred>

---

*Phase: 04-optional-cloud-sync*
*Context gathered: 2026-03-30*
