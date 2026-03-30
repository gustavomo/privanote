# Phase 2: Capture and Save Flows - Research

**Researched:** 2026-03-29
**Scope:** Phase 2 planning input

## Planning Summary

- Phase 2 extends the existing note-plus-attachments workflow rather than replacing it. The current desktop workspace already supports note selection, attachment listing, file picking, and backend-backed CRUD, so the phase should layer capture, import-copy, and richer attachment presentation onto that foundation.
- The main architectural constraint is transport: the current desktop client sends JSON payloads through `ipcRenderer.invoke('backend:request', ...)`, and Electron IPC explicitly cannot carry DOM `File` objects. Phase 2 therefore needs a deliberate binary upload path rather than trying to force recording blobs through the existing JSON-only request shape.
- Renderer-side media capture is the lowest-friction path for Phase 2. `navigator.mediaDevices.getUserMedia()` and `MediaRecorder` fit the requested audio/video/both capture model and naturally support the lightweight review step the user chose.
- The backend should remain the owner of persisted media. Imports and recordings should end in app-managed storage under the existing backend attachment root, with attachment rows written only after the managed file exists.
- Packaged camera/microphone capture on macOS has an extra product requirement that the current repo does not satisfy yet: the packaged app config does not define `NSMicrophoneUsageDescription` or `NSCameraUsageDescription`.
- The plans should preserve a basic scope boundary: no trimming, transcoding, waveform editing, or transcript coupling in Phase 2. The hard part is capture/save/relaunch reliability, not media editing.

## Recommended Plan Slices

- **02-01: Recording UX, permission handling, and contract seam** — Add renderer-side capture state for audio/video/both, inline permission/device failure handling, lightweight review state, and the desktop/backend upload seam needed for recording payloads. This slice should also cover packaged permission prerequisites because recording cannot be verified without them.
- **02-02: Backend-managed media persistence for recordings and imports** — Add backend routes/services/storage helpers that auto-create notes when needed, copy imported files into managed storage, write recorded media into the managed attachments root, and persist attachment metadata only after successful file handling.
- **02-03: Workspace media cards, relaunch behavior, and regression coverage** — Replace plain attachment rows with basic media cards for audio/video, keep generic file cards simple, verify relaunch visibility, and add regression coverage for capture review, import copy, save/discard behavior, and persisted media reload.

## Technical Findings

### Capture runtime belongs in the renderer

- The current desktop UI already lives in `apps/desktop/src/renderer/App.jsx`, and Phase 2’s chosen behaviors are highly interaction-driven: start capture without a selected note, show inline permission/device errors, enter review state after stop, and preview media before save.
- MDN documents `getUserMedia()` as the API that requests camera/microphone input and returns a `MediaStream`. It is available only in secure contexts, but MDN explicitly counts both `file:///` and `localhost` as secure contexts, which matches this repo’s two launch modes: `http://localhost:5173` in development and `file://.../dist/index.html` in packaged mode.
- MDN documents `MediaRecorder` as the standard recording API for a `MediaStream`, with `start()`, `stop()`, and `MediaRecorder.isTypeSupported()` to choose a supported MIME container at runtime instead of hardcoding one container/codec combination.
- For the user’s selected lightweight review flow, the renderer can accumulate recorded chunks into a `Blob`, preview it with a blob URL, and clean that URL up with `URL.revokeObjectURL()` when the user discards the review or the component unmounts.
- Inference from the current code and MDN/Electron docs: live preview should stay in the renderer because it already owns interaction state, while persisted file ownership should stay backend-owned because the backend already owns managed attachment deletion and relaunch storage.

### The current desktop/backend transport is insufficient for media uploads

- The current desktop transport in `apps/desktop/src/main/preload.js` calls `ipcRenderer.invoke('backend:request', { operationId, payload })`, and `apps/desktop/src/main/main.js` only proxies JSON bodies for `POST` and `PUT`.
- Electron’s `ipcRenderer` docs say IPC arguments are serialized with the Structured Clone Algorithm, but DOM objects such as `File` cannot be sent to the main process over Electron IPC.
- That means the current `addAttachment({ nodeId, kind, localPath })` pattern is adequate for metadata-only attachment creation, but not for capture blobs or imported file contents when the backend is supposed to own persistence.
- Research conclusion: Phase 2 should add a dedicated upload path rather than overloading the current JSON-only route. Two viable shapes fit the current architecture:
  - **Preferred:** keep the backend-owned contract model, but add dedicated media-save operations and a preload/main upload bridge that accepts plain serializable metadata plus binary data normalized from the renderer blob/file.
  - **Fallback:** add a separate Electron-only upload IPC path for raw media transfer, then have main proxy it to the backend using multipart upload. This is less elegant than a fully contract-shaped transport, but still keeps persistence backend-owned.
- Direct renderer `fetch()` to `127.0.0.1` is not the lowest-risk first step here because the current app does not expose a CORS path or direct renderer/backend networking pattern; Phase 1 intentionally concentrated backend communication through the Electron boundary.

### Multipart upload is the right backend shape for Phase 2

- The backend currently exposes only JSON attachment creation in `apps/backend/src/routes/attachments.js`, and `apps/backend/package.json` does not yet include a multipart parser.
- The `@fastify/multipart` docs support streamed file handling, file-size limits, and direct piping to disk. That aligns with the local-backend requirement better than base64-in-JSON, which would add size overhead and make larger video uploads more memory-heavy.
- Research conclusion: Phase 2 plans should assume a multipart-based media ingest endpoint for recordings/imported content, with explicit limits for file size and part count.
- Because Fastify multipart processing is stream-based, the planner should prefer backend code that writes to a temp or final managed path via streams/pipeline, then inserts the attachment row only after the file has been fully handled. This keeps database state and file state aligned.

### Auto-created note handling should stay backend-owned

- The current backend already owns node creation in `apps/backend/src/services/nodes-service.js`, and note titles are validated there (`title` is required).
- The user locked a note-creation default for both recording and import when no note is selected, plus a generated placeholder title based on capture/import type and time.
- Research conclusion: note auto-creation should happen in backend-owned flows, not as a renderer-side “best effort” sequence. Otherwise, the renderer risks creating a note, failing media persistence, and leaving behind an orphan note that the user did not explicitly create.
- The planner should therefore prefer one of these patterns:
  - a backend endpoint that creates the note and attachment atomically for capture/import save flows, or
  - a backend service-level transaction/orchestration path that wraps note creation plus attachment persistence and rolls back on failure.

### Managed storage should be extended, not reinvented

- The backend already resolves an app-managed attachments root in `apps/backend/src/storage/runtime-paths.js`, and deletes managed files through the trigger-backed cleanup path in `apps/backend/src/storage/database.js` plus `apps/backend/src/storage/attachment-files.js`.
- That means imported-file copying and recorded-media writes do not need a new storage subsystem. They need an extension of the existing managed-attachments model so saved files land under the current attachments root and inherit delete cleanup.
- The main missing behaviors are:
  - deterministic file naming/path generation for new managed media,
  - copy/import helpers for existing files,
  - write helpers for recording blobs/buffers,
  - metadata persistence that points `attachments.local_path` at the managed file path rather than an external path.
- This is a strong fit for the user’s Phase 2 decision that imports must be copied into app-managed storage.

### Packaged permission handling is a real planning requirement

- Electron’s `session` API documents `setPermissionRequestHandler()` and `setPermissionCheckHandler()` for media permission handling. For media capture, the relevant permission type is `media`.
- Electron’s `systemPreferences` docs document `getMediaAccessStatus()` and `askForMediaAccess()` for `microphone` and `camera` on macOS, and note that previously denied access may require changing the OS settings and restarting the app for the new permission to take effect.
- The same Electron docs also state that macOS camera/microphone prompts require `NSMicrophoneUsageDescription` and `NSCameraUsageDescription` entries in the packaged app’s `Info.plist`.
- The current `apps/desktop/electron-builder.yml` has no `extendInfo` or plist usage-description entries, and repo search shows no existing `NSMicrophoneUsageDescription` or `NSCameraUsageDescription` declarations.
- Research conclusion: the Phase 2 plan must include packaged permission-plumbing work, not just renderer capture code. Otherwise dev capture may work while packaged capture fails or prompts incorrectly.

### UI scope should stay intentionally narrow

- The user chose a lightweight review state and basic saved-media cards. That points to a narrow Phase 2 interface: start capture, stop capture, review `Save`/`Discard`, then basic playback/open/remove on the saved card.
- The existing attachment section in `apps/desktop/src/renderer/App.jsx` is already the natural integration point. Phase 2 does not need a separate “studio” or “recorder app” shell.
- Research conclusion: plans should bias toward extending the existing attachment area with:
  - capture controls,
  - review state,
  - inline error/status copy,
  - richer cards for saved audio/video,
  - simpler file cards for imported generic files.
- More advanced editing controls should be explicitly deferred so they do not consume capture/save bandwidth.

### Testing strategy needs both browser-API mocks and backend file assertions

- The repo already has Vitest-based desktop and backend tests from Phase 1, so Phase 2 does not need to introduce a new test runner.
- Desktop tests will need to mock browser media APIs that jsdom does not provide out of the box: `navigator.mediaDevices.getUserMedia`, `MediaRecorder`, and likely blob URL creation/revocation.
- Backend tests should verify managed-file writes and import copies under temporary data roots, not just attachment rows in SQLite.
- End-to-end or smoke coverage should specifically prove relaunch behavior: a saved capture or copied import still renders as an attachment after the app/backend restart.
- Because permission problems are platform-sensitive, plans should treat automated permission-denied UI tests and packaged smoke verification as complementary, not interchangeable.

## Risks and Traps

- If plans try to reuse `v1.attachments.addAttachment` with raw blobs stuffed into JSON payloads, Phase 2 will either hit IPC serialization errors or create an unnecessarily memory-heavy upload path.
- If note auto-creation is done renderer-first without rollback, failed saves can leave behind placeholder notes with no media, which conflicts with the intended “capture/import owns the note” behavior.
- If the backend stores imported files by external path only, CAP-05 becomes brittle because relaunch visibility depends on external files not moving.
- If packaged macOS permissions are ignored during planning, capture can appear “done” in dev while failing in actual distributed builds.
- If plans hardcode a single recording MIME type without runtime capability checks, capture can fail on some machines even when camera/microphone access is granted.
- If review URLs are created without `revokeObjectURL()`, repeated recording/discard flows can leak memory in longer sessions.
- If uploaded files are persisted in the database before file writes finish, the app can end up with attachment rows that point to missing files after partial failures.
- If tests cover only backend file persistence or only renderer review state, Phase 2 can still miss the critical contract seam where captured/imported media crosses from desktop to backend.

## Verification Guidance

- Plans should verify that the desktop exposes capture modes for audio, video, and combined video-with-audio, and that a capture can start without an existing selected note.
- Plans should verify that stopping a recording does not immediately persist the media; persistence should occur only after an explicit `Save` action, and `Discard` should leave no saved attachment behind.
- Backend verification should check that imported files are copied into the managed attachments root and that saved recordings also land under that managed root instead of an external path.
- Packaging verification should include a grep-level check that `NSMicrophoneUsageDescription` and `NSCameraUsageDescription` are present in the Electron build config, plus a runtime smoke path where feasible.
- Contract verification should check that the desktop no longer depends on a metadata-only attachment-create path for recorded/imported media saves, and that new backend operations exist for Phase 2 media persistence.
- Relaunch verification should prove that a saved capture/import is visible after backend/database reopen, not just immediately after save.
- Desktop regression tests should explicitly cover:
  - permission denied / device unavailable inline state,
  - auto-created note placeholder behavior,
  - review `Save` / `Discard`,
  - rich card rendering for saved audio/video,
  - simpler file card rendering for generic file imports.
- Backend regression tests should explicitly cover:
  - auto-create note plus media save orchestration,
  - import copy into managed storage,
  - delete cleanup of managed files,
  - error behavior when file writes or note lookup fail.

## Requirement Coverage Notes

- **CAP-01:** Plans must include renderer-side audio capture plus backend persistence, not only UI scaffolding.
- **CAP-02:** Plans must include video capture, and the user’s “both” decision means video capture with audio included should count as the combined mode.
- **CAP-03:** Plans must preserve and extend native file picking so audio, video, and generic files can still be imported, then copied into managed storage.
- **CAP-04:** Plans must create a real backend persistence path for recorded and imported media; metadata-only attachment creation is not enough for the locked Phase 2 behavior.
- **CAP-05:** Plans must verify relaunch visibility against managed persisted media, not just immediate in-memory preview.

## External Source Checks

- Electron `ipcRenderer` docs — IPC uses structured clone and rejects DOM objects such as `File`, which constrains the current upload path: https://www.electronjs.org/docs/latest/api/ipc-renderer
- Electron `session` docs — `setPermissionRequestHandler()` / `setPermissionCheckHandler()` cover media permission handling in the app session: https://www.electronjs.org/docs/latest/api/session
- Electron `systemPreferences` docs — macOS/Windows media permission status, `askForMediaAccess()`, and required Info.plist usage descriptions: https://www.electronjs.org/docs/latest/api/system-preferences
- MDN `getUserMedia()` docs — secure-context rules, error conditions, and `file:///` / `localhost` secure-context note: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
- MDN `MediaRecorder` docs — recorder lifecycle and runtime MIME support checks via `MediaRecorder.isTypeSupported()`: https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder
- MDN `URL.createObjectURL()` docs — blob URL preview and cleanup with `revokeObjectURL()`: https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL_static
- MDN `FormData()` docs — browser-native multipart request construction from files/blobs: https://developer.mozilla.org/en-US/docs/Web/API/FormData/FormData
- `@fastify/multipart` docs — streaming multipart upload handling and file-size limits: https://github.com/fastify/fastify-multipart
