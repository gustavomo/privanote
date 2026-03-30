# Phase 4: Optional Cloud Sync - Research

**Researched:** 2026-03-30
**Scope:** Phase 4 planning input

## Planning Summary

- Phase 4 is not just "upload a file to Google Drive or OneDrive." It needs a durable provider-connection model, persisted per-attachment sync state, backend-owned queueing, and UI surfaces that keep local-first behavior obvious when sync fails.
- The current codebase only has a `cloud_url` placeholder on attachments and one settings record that already mixes storage destination and transcription configuration. That is not enough to support two simultaneous provider connections, stable remote IDs, retryable sync jobs, or transcript/metadata follow-up updates.
- The cleanest Phase 4 shape is backend-owned end to end: the backend should own provider auth state, sync metadata, queue orchestration, and provider adapters, while the desktop only renders Settings controls and media-card sync states through backend contracts.
- Google Drive and OneDrive have different strengths, but the planning target can still stay unified: system-browser OAuth with PKCE, one provider root folder per account, one note folder beneath that root, media upload first, then transcript/metadata patch later.
- Resumable uploads are not optional for this phase. Recorded or imported media sizes are inherently variable, and the current app already supports video. Planning around simple one-shot uploads would create a fragile sync feature immediately.
- The roadmap's three-slice structure is still the right fit: shared abstraction plus Google first, OneDrive plus durable sync metadata second, and desktop/UI plus regression coverage third.

## Recommended Plan Slices

- **04-01: Shared sync abstraction and Google Drive provider integration** — Add backend-owned provider connection contracts, Google OAuth/browser-connect flow, Google provider adapter, sync queue foundation, and media/transcript/metadata upload rules built around one Privanote root folder with one folder per note.
- **04-02: OneDrive provider integration and durable sync metadata persistence** — Add OneDrive connection and upload adapter support, persisted provider connection records, durable per-attachment sync state, transcript/metadata patch updates, and queue rules for default-destination changes.
- **04-03: Settings/media-card sync surface and local-first regressions** — Extend the existing Settings view with connect/disconnect/default-destination UX, add compact sync badges and retry actions to media cards, and cover relaunch/default-switch/failure flows with backend and desktop tests.

## Technical Findings

### Sync needs more than `cloud_url`

- The attachment record still only exposes `cloud_url` in [apps/backend/src/services/attachments-service.js](/Users/gustavo.moreno/Documents/personal%20info/privanote/apps/backend/src/services/attachments-service.js). That is enough for a single opaque remote link, but not enough for:
  - two connected providers at once
  - stable target-provider assignment per attachment
  - provider root folder IDs
  - note-folder IDs
  - transcript file IDs
  - metadata sidecar IDs
  - retry state, last error, or sync timestamps
- The current settings record in [apps/backend/src/services/settings-service.js](/Users/gustavo.moreno/Documents/personal%20info/privanote/apps/backend/src/services/settings-service.js) is already serving storage and transcription concerns. It should keep the app-wide default destination, but it should not be overloaded with per-provider refresh tokens or per-attachment sync status.
- Research conclusion: Phase 4 should add:
  - a persisted provider-connections store for `google-drive` and `onedrive`
  - a persisted per-attachment sync-state store keyed by attachment ID and target provider
- Because already-synced items stay on their original provider when the default changes, the target provider has to be captured on the attachment sync record itself rather than derived later from the current settings value.

### The backend should own the connect flow, but the desktop should open the browser

- Phase 1 locked backend-owned contracts and a backend-agnostic desktop. That still fits Phase 4.
- The existing app already has a local backend process and an Electron main process capable of native shell actions. That makes a split OAuth flow practical:
  - backend creates auth state, PKCE verifier, and callback session
  - desktop opens the provider auth URL in the system browser
  - provider redirects back to a localhost callback handled by the local backend
- This shape preserves backend ownership of tokens and provider state without forcing the renderer to manage OAuth details.
- Google's OAuth guidance explicitly covers installed/native application flows and recommends secure handling of refresh/access tokens and client credentials. Microsoft's desktop-app registration guidance likewise supports system-browser flows and public-client configuration for desktop apps.
- Research conclusion: Phase 4 should not use embedded browser auth inside the renderer and does not need device-code UX as the primary path. The existing local backend plus system browser is the cleanest planning target.

### Google Drive is a strong fit for the first provider slice

- Google Drive folders are just files with MIME type `application/vnd.google-apps.folder`, and uploaded files can be placed into a specific folder by setting `parents` on `files.create()`. Source: Google Drive folder/file management docs.
- Google Drive resumable uploads are the right default for media. Official docs recommend resumable upload for files larger than 5 MB and for interruption-prone/mobile-style environments, and note that resumable uploads also work for smaller files with only one extra request.
- Google Drive also supports app-private custom metadata via `appProperties`, which is a good fit for storing app-owned identifiers like `noteId`, `attachmentId`, or a provider bookkeeping key directly on remote items.
- Research conclusion:
  - create one visible provider root folder named `Privanote`
  - create one child folder per note beneath that root
  - upload the media file into the note folder
  - upload `transcript.txt` and `privanote.json` as separate remote files
  - persist remote Drive item IDs locally and use `appProperties` as a recovery/search aid, not as the only source of truth
- Avoid path-only logic. Users can rename or move folders in Drive. Remote IDs are the stable update key.

### OneDrive should use Graph drive items and resumable upload sessions

- Microsoft Graph's `createUploadSession` guidance recommends resumable uploads for files larger than 10 MiB, recommends fragment sizes between 5-10 MiB, and requires chunk sizes to be multiples of 320 KiB for reliable large uploads.
- Microsoft also documents an app folder pattern for OneDrive. The `approot` special folder provides a stable app-scoped root under the user's OneDrive `Apps` area, which maps cleanly to the locked Phase 4 decision that each provider should get one Privanote root folder with note folders underneath it.
- The permissions guidance is slightly nuanced:
  - `Files.ReadWrite.AppFolder` is least-privilege for some personal-account app-folder scenarios
  - `Files.ReadWrite` is the safer common denominator when Phase 4 should not become personal-account-only
- Research conclusion:
  - use a single OneDrive provider adapter built on Microsoft Graph driveItem APIs
  - prefer the app-root pattern for the provider root folder if the chosen delegated scope supports the target account types
  - otherwise fall back to creating one `Privanote` folder under the user's drive root
  - always persist remote driveItem IDs locally rather than inferring state from paths

### Default-destination changes require attachment-level targeting, not bulk migration

- The user locked two separate rules:
  - older unsynced local attachments should queue to the new default destination automatically
  - already-synced attachments should stay on their original provider
- That means "what provider should I sync to?" is a question about attachment sync state, not only about current settings.
- Research conclusion: the sync queue should treat attachments in three broad groups:
  - **already synced** — keep existing provider target, do not migrate automatically
  - **unsynced but assigned** — continue against their stored provider target if one exists
  - **unsynced and unassigned** — assign the current default provider and queue
- Planning should not describe default switching as a migration flow. It is a target-assignment rule for unsynced work only.

### Transcript and metadata should be a second sync step, not a reason to block media upload

- Phase 3 already made transcript generation asynchronous, and Phase 4 explicitly locked media-first upload with a later transcript/metadata patch.
- The current backend already has a transcript runner in [apps/backend/src/services/transcription-runner.js](/Users/gustavo.moreno/Documents/personal%20info/privanote/apps/backend/src/services/transcription-runner.js), so cloud sync does not need to invent transcript orchestration. It needs to subscribe to transcript completion.
- Research conclusion:
  - queue a sync job as soon as local media persistence succeeds and the attachment qualifies for cloud sync
  - create or update the remote media file first
  - if a transcript is not ready yet, upload metadata that marks transcript state as pending
  - when the transcript succeeds later, enqueue a follow-up patch job that replaces `transcript.txt` and updates `privanote.json`
- This keeps sync consistent with the locked UI copy: the media card can say the media is uploaded while transcript/metadata is still pending.

### A metadata sidecar is simpler than cloud note replication

- The user explicitly limited synced payloads to media, transcript text, and a small metadata sidecar.
- The simplest stable package per note folder is:
  - original media file with its saved filename
  - `transcript.txt`
  - `privanote.json`
- Research conclusion: `privanote.json` should carry the minimum context that makes the cloud copy understandable outside Privanote:
  - note ID
  - note title
  - attachment ID
  - attachment kind
  - created timestamp
  - provider name
  - transcript status
  - synced timestamps / remote bookkeeping fields needed by the backend
- This stays inside the user's requested scope without turning Phase 4 into full note replication or cloud conflict resolution.

### Settings and media-card UI should extend the existing Phase 3 surfaces

- The current Settings view already has storage destination choices in [apps/desktop/src/renderer/components/settings-view.jsx](/Users/gustavo.moreno/Documents/personal%20info/privanote/apps/desktop/src/renderer/components/settings-view.jsx), and the current media card in [apps/desktop/src/renderer/components/media-card.jsx](/Users/gustavo.moreno/Documents/personal%20info/privanote/apps/desktop/src/renderer/components/media-card.jsx) is the natural place to show sync state.
- Research conclusion:
  - Phase 4 should add provider-specific connection cards to the existing Settings surface instead of introducing a new sync dashboard
  - the storage destination selector should become a real default-destination control only when the chosen cloud provider is connected
  - media cards should show compact badges plus retry, never a separate sync panel
- The current transcription provider card should remain separate. Cloud sync providers must not be conflated with the OpenAI transcription provider fields already in Phase 3.

### Tests need to focus on state continuity and provider-specific update rules

- The repo already has backend and desktop tests around settings persistence, media persistence, and transcript flows.
- Research conclusion: Phase 4 plans should add at least:
  - backend tests for provider connection persistence, callback completion, and refreshable tokens
  - backend tests for queue assignment when the default destination changes
  - backend tests for resumable upload failure handling and transcript-follow-up patching
  - desktop tests for Settings connection/default badges and media-card sync states
  - relaunch tests proving that connected providers and synced/failed attachment states survive backend restart

## Risks and Traps

- Overloading the current `settings` row and `cloud_url` field for all Phase 4 state would produce a shallow implementation that cannot support two provider connections, attachment-level targeting, or transcript patch updates.
- Implementing provider auth in the renderer or preload layer would break the backend-owned contract boundary and make relaunch-safe background sync much harder to reason about.
- Using path names instead of provider item IDs would make updates fragile as soon as users rename or move cloud folders.
- Choosing a OneDrive permission/special-folder path that only works for personal accounts would quietly undercut Phase 4 unless work/school support is explicitly deferred.
- Blocking local save on cloud upload would violate the core local-first promise and create a visible regression from Phases 1-3.
- Treating transcript sync as part of the initial media upload transaction would couple two asynchronous systems and create unnecessary upload delays.
- Mixing Google Drive and OneDrive connect/disconnect state into the transcription provider card would create confusing Settings semantics and violate the Phase 4 UI contract.

## Verification Guidance

- Plans should verify that connecting Google Drive and OneDrive persists provider-specific connection state across relaunch without exposing raw tokens to the renderer.
- Plans should verify that when a connected provider is the default destination, a newly saved attachment is queued for sync automatically after local persistence succeeds.
- Plans should verify that changing the default destination queues older unsynced local attachments to the new provider but does not requeue already-synced items on the previous provider.
- Plans should verify that media cards can distinguish `Local only`, `Syncing`, `Synced`, and `Sync failed` without affecting local playback or remove actions.
- Plans should verify that transcript completion updates the existing remote note folder with `transcript.txt` and refreshed metadata rather than reuploading the media binary.
- Plans should verify provider disconnect behavior: local state disconnects, remote files remain untouched, and local media use still works.
- Plans should verify resumable-upload retry behavior for interruption and 5xx scenarios, including restarting a stale upload session when the provider requires it.

## Requirement Coverage Notes

- **SYNC-01:** Plans must create a real Google Drive connection flow and provider adapter, not just a destination radio option.
- **SYNC-02:** Plans must create a real OneDrive connection flow and provider adapter, not only a placeholder card in Settings.
- **SYNC-03:** Plans must queue automatic sync for selected/default destinations and support remote media plus transcript/metadata updates through backend-owned provider adapters.
- **SYNC-04:** Plans must surface compact attachment sync states in the workspace and expose connected/default state in Settings.
- **SYNC-05:** Plans must preserve local attachment usability and local files regardless of sync success, failure, disconnect, or provider switching.

## External Source Checks

- Google OAuth 2.0 overview and installed-app guidance: https://developers.google.com/identity/protocols/oauth2
- Google OAuth token-handling best practices: https://developers.google.com/identity/protocols/oauth2/resources/best-practices
- Google Drive folder creation and parent-folder uploads: https://developers.google.com/workspace/drive/api/guides/folder
- Google Drive resumable upload guidance: https://developers.google.com/workspace/drive/api/guides/manage-uploads
- Google Drive custom `appProperties` guidance: https://developers.google.com/workspace/drive/api/guides/properties
- Microsoft desktop app registration guidance: https://learn.microsoft.com/en-us/entra/identity-platform/scenario-desktop-app-registration
- Microsoft Graph resumable upload session guidance: https://learn.microsoft.com/en-us/graph/api/driveitem-createuploadsession
- OneDrive app-folder guidance: https://learn.microsoft.com/en-us/onedrive/developer/rest-api/concepts/special-folders-appfolder?view=odsp-graph-online
- OneDrive permission-scope reference: https://learn.microsoft.com/en-us/onedrive/developer/rest-api/concepts/permissions_reference?view=odsp-graph-online
