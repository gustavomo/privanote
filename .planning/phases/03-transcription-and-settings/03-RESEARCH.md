# Phase 3: Transcription and Settings - Research

**Researched:** 2026-03-30
**Scope:** Phase 3 planning input

## Planning Summary

- Phase 3 is not just "call a transcription API." It needs a durable transcript state model, a background orchestration path, a settings surface, and a settings persistence layer that both the desktop and local backend can reuse across relaunch.
- The current codebase has no transcript schema, no settings contracts, no queue or retry mechanism, and no settings navigation. The phase therefore has to add both backend domain pieces and a visible desktop shell change.
- The storage setting the user described is easy to misread. The app still needs one stable runtime root for the database, app settings, downloaded local models, and retry metadata, while the user-configurable local storage directory should affect only future saved media destinations.
- Auto-transcription should remain backend-owned. The renderer should not decide retry counts, persist transcript text, or call provider/local runtimes directly.
- Local transcription "works out of the box" strongly favors an app-managed sidecar runtime with first-use setup rather than Python- or user-tooling-dependent approaches.
- Backend transcription with the chosen OpenAI Whisper-style provider is viable, but the plan has to account for provider file limits and format constraints before it claims that every saved media file can be sent upstream.
- Because Phase 3 introduces both backend state and new UI surfaces, it is a good fit for the roadmap's three-slice structure: transcript orchestration first, settings persistence/navigation second, provider validation and failure UX third.

## Recommended Plan Slices

- **03-01: Transcript data model and backend orchestration** — Add transcript persistence, queued/processing/succeeded/failed state, retry accounting, startup resume behavior, and the backend trigger path that starts transcription after recording/import save succeeds.
- **03-02: Settings shell and persisted preferences** — Add desktop settings navigation plus backend-owned settings read/update contracts for storage destination, local save directory, transcription mode, and any non-secret provider configuration.
- **03-03: Provider credentials, validation, and transcript UX** — Add backend provider credential handling, save-time validation, transcript section UI states, retry/failure surfacing, and regression coverage across relaunch and mode switching.

## Technical Findings

### Runtime root and media destination must be split

- The current backend storage helpers still derive both the SQLite file and managed attachments root from `resolveDataRoot()` in [apps/backend/src/storage/runtime-paths.js](/Users/gustavo.moreno/Documents/personal%20info/privanote/apps/backend/src/storage/runtime-paths.js).
- The Phase 3 user decision is different: changing the local folder path should affect only future local saves, not migrate existing data and not redefine the app's own runtime home.
- Research conclusion: planning should separate:
  - **runtime/app root** — database, settings persistence, local transcription assets, and retry metadata
  - **future media destination root** — where new locally saved attachments go when destination is `Local`
- If Phase 3 overloads the existing data root for both concerns, changing a setting would effectively relocate the database and managed-attachment base, which conflicts with the user's stated intent.
- Electron's `app.getPath('userData')` remains the right anchor for runtime-owned state in packaged apps, while the user-selected local save directory should be modeled as a separate setting. Source: Electron `app` API docs.

### Transcript state needs its own persisted model

- The user locked a dedicated transcript section, plain-text output, read-only behavior, replace-in-place semantics, and retry/failure state that survives relaunch.
- The current note schema only has `nodes` and `attachments` in [apps/backend/src/storage/database.js](/Users/gustavo.moreno/Documents/personal%20info/privanote/apps/backend/src/storage/database.js). There is nowhere to persist transcript content, ownership, attempts, or failure details yet.
- Research conclusion: Phase 3 should not try to squeeze transcript data into `nodes.description`. It needs a dedicated persisted record keyed to the note's effective media attachment.
- A good planning target is one `transcripts` table keyed by `node_id` with fields such as:
  - `node_id`
  - `attachment_id`
  - `status` (`queued`, `processing`, `succeeded`, `failed`)
  - `text`
  - `mode` (`local`, `backend`)
  - `provider`
  - `attempt_count`
  - `last_error`
  - `created_at`, `updated_at`, `completed_at`
- Because the user chose replace-in-place instead of versioning, a single current transcript row per note is a better Phase 3 fit than transcript history tables.

### Auto-transcription should be backend-owned asynchronous work

- Today `saveRecording()` and `importMedia()` in [media-service.js](/Users/gustavo.moreno/Documents/personal%20info/privanote/apps/backend/src/services/media-service.js) complete synchronously and return `{ node, attachment }`.
- If transcription is started inline inside those request handlers, save/import latency will balloon and failures will block the primary media-save workflow.
- The user chose auto-start plus a small fixed retry count. That combination points to a backend-owned job lifecycle rather than renderer polling logic or a one-shot synchronous route.
- Research conclusion: save/import flows should mark transcript work as `queued` after successful attachment persistence, then hand off processing to a backend worker/orchestrator that:
  - updates status to `processing`
  - runs local or backend transcription according to saved settings
  - retries a small fixed number of times
  - leaves a persisted `failed` state with the last error after retries are exhausted
- The backend should also resume `queued` or interrupted `processing` work on startup so relaunch does not strand transcript jobs in an indeterminate state.

### Local transcription should use an app-managed sidecar runtime

- "Local mode must work out of the box" rules out solutions that depend on the user separately installing Python, ffmpeg, or model tooling.
- The current backend package has no transcription dependencies at all in [apps/backend/package.json](/Users/gustavo.moreno/Documents/personal%20info/privanote/apps/backend/package.json), so Phase 3 is choosing a local runtime strategy from scratch.
- `whisper.cpp` is the strongest fit for the locked Phase 3 shape because it supports downloadable GGML/GGUF model assets and CLI-style local transcription without requiring a Python environment. The official model docs show downloadable preconverted models via `download-ggml-model.sh` and CLI invocation after download.
- Research conclusion: the planner should prefer an app-managed sidecar approach for `Local` mode:
  - ship or obtain a platform-matched transcription binary/runtime under the app runtime root
  - download the chosen default model on first use
  - persist readiness state so later jobs can start without repeating setup
  - execute transcription out-of-process so failures do not take down the backend request loop
- Packaging risk remains real here. Phase 3 planning should keep the model/runtime setup path explicit instead of hiding it inside a future "magic local mode" placeholder.

### Backend provider integration is viable but constrained

- The chosen backend provider is OpenAI Whisper-style transcription.
- OpenAI's speech-to-text docs currently support transcription endpoints with models such as `gpt-4o-mini-transcribe` and list supported input types including `mp3`, `mp4`, `mpeg`, `mpga`, `m4a`, `wav`, and `webm`.
- The same docs currently state a 25 MB upload limit for speech-to-text requests.
- That matters because Phase 2 already supports recorded and imported video, and some video attachments can exceed 25 MB quickly.
- Research conclusion: Phase 3 planning must include provider preflight logic before enqueuing backend transcription:
  - validate that the attachment type/extension is supported by the provider path
  - check file size before upload
  - surface a clear retryable or configuration error when provider constraints are exceeded
- Without that preflight, backend mode will fail unpredictably on perfectly valid Phase 2 media files.

### Settings persistence needs a backend-owned contract surface

- The desktop currently has one large note workspace component in [apps/desktop/src/renderer/App.jsx](/Users/gustavo.moreno/Documents/personal%20info/privanote/apps/desktop/src/renderer/App.jsx) and no settings navigation at all.
- The desktop/backend contract surface in [apps/backend/src/contracts/index.js](/Users/gustavo.moreno/Documents/personal%20info/privanote/apps/backend/src/contracts/index.js) has operations only for nodes, attachments, and media save/import flows.
- Research conclusion: Phase 3 should add backend-owned settings contracts rather than introducing renderer-side config files or direct preload persistence.
- A practical Phase 3 settings shape is:
  - one persisted settings record for non-secret values such as storage destination, local storage directory, transcription mode, and provider kind
  - one credential-bearing value for the backend provider key, still surfaced through backend-owned contracts
  - explicit validation on save so the UI can show field-level or section-level failures immediately
- The same settings API should also drive transcript orchestration so the backend does not rely on stale in-memory configuration after the user changes modes or paths.

### Credential handling is a scope decision, not just a form decision

- The user locked "stored locally, masked in the UI, validated on save," but did not require OS-keychain integration.
- Electron does provide `safeStorage.isEncryptionAvailable()` plus `encryptString()` and `decryptString()` for local encrypted string storage, but using that directly would make secret persistence depend on the Electron shell rather than the backend package alone.
- Research conclusion: the plan should explicitly choose between:
  - **backend-managed local persistence** for all settings, which best matches the backend-owned contract rule, or
  - **desktop-encrypted secret persistence** with `safeStorage`, which improves local secrecy but introduces a desktop/backend coordination seam for credential reuse.
- For planning, the important part is not to leave this ambiguous. Validation, masking, relaunch reuse, and testability all depend on where the secret actually lives.

### Transcript UX should remain note-centered, but the app shell needs one more mode

- The current UI already has a clear note workspace and saved-media section in [App.jsx](/Users/gustavo.moreno/Documents/personal%20info/privanote/apps/desktop/src/renderer/App.jsx), which matches the user's decision to keep transcripts inside the active note.
- However, the same file is already carrying note CRUD, capture, import, attachment loading, and saved-media presentation. Phase 3 adds transcript rendering plus a dedicated settings panel, which is too much for the current one-component shape to absorb cleanly.
- Research conclusion: the planner should assume a small shell split:
  - workspace mode/view for notes, capture, saved media, and transcript section
  - settings mode/view for storage and transcription settings
- The transcript section should remain in the active note pane, but settings should not be bolted into that pane inline.

### Tests need to cover persistence, retries, and relaunch

- The repo already has working backend and desktop Vitest suites, including media persistence tests and UI tests for capture/import/media cards.
- That gives Phase 3 a good testing base. It does not need a new runner; it needs new coverage areas.
- Research conclusion: plans should add at least:
  - backend tests for transcript row creation, status transitions, retry exhaustion, startup resume, and settings persistence
  - provider-validation tests for invalid key/config cases and oversize backend files
  - desktop tests for transcript section states (`queued`, `processing`, `failed`, `succeeded`) and settings view interactions
  - relaunch tests that prove transcripts and settings survive backend/database recreation

## Risks and Traps

- Treating the user-selected local storage directory as the new global data root would relocate the database and app-owned assets unintentionally.
- Storing transcript text inside note descriptions would violate the locked Phase 3 UX and make regenerate/replace semantics messy immediately.
- Running transcription inline in the save/import request path would make recording/import feel broken whenever transcription is slow or retried.
- Picking a local transcription path that assumes Python or user-installed tooling would violate the "works out of the box" decision.
- Ignoring the OpenAI backend file-size limit would make backend mode fail on larger video attachments after the user has already chosen and saved that mode.
- Defining retry behavior only in the renderer would break relaunch continuity and make background retries impossible to reason about.
- Adding settings UI without a backend-owned persistence contract would reintroduce desktop-side business logic that Phase 1 intentionally moved out.
- Adding `safeStorage` late without deciding whether the backend or desktop owns the secret would create awkward cross-process dependencies during validation and runtime use.

## Verification Guidance

- Plans should verify that successful recording/import save creates transcript state automatically without making the save/import action wait for full transcript completion.
- Plans should verify that transcript state persists separately from the note description and survives backend restart.
- Plans should verify that a failed transcript job retries a small fixed number of times, then lands in a stable failed state with retryable UI feedback.
- Plans should verify that changing the local storage directory affects only future media saves, not existing attachments, database location, or previously saved transcripts.
- Plans should verify that settings persist across relaunch and that both the desktop UI and backend orchestration read the same effective transcription mode afterward.
- Plans should verify provider save-time validation, including bad credentials and backend-provider file constraints.
- Plans should verify local-mode first-use setup behavior, including a persisted readiness state after the runtime/model is prepared.

## Requirement Coverage Notes

- **TRNS-01:** Plans must create a real transcript-generation path for saved audio/video attachments, not just a transcript text field in the UI.
- **TRNS-02:** Plans must persist one app-wide transcription mode and make the backend respect it automatically for new transcript jobs.
- **TRNS-03:** Plans must persist transcript content/status so the user can reopen the app and still see the transcript beside the note and media.
- **TRNS-04:** Plans must include retry accounting plus a durable failed state, not only a transient renderer error.
- **SET-01:** Plans must distinguish app runtime storage from the user-selected local media destination.
- **SET-02:** Plans must provide one settings surface that controls storage and transcription preferences without mixing them into note editing.
- **SET-03:** Plans must include a real provider credential path, not only placeholder fields.
- **SET-04:** Plans must validate storage, mode, and provider settings at save time with clear user feedback.
- **SET-05:** Plans must persist settings in a form reused after relaunch by both the desktop and the local backend.

## External Source Checks

- Electron `app` API — `app.getPath(name)` / `userData` runtime storage guidance: https://www.electronjs.org/docs/latest/api/app
- Electron `safeStorage` API — local string encryption helpers and availability rules: https://www.electronjs.org/docs/latest/api/safe-storage
- OpenAI speech-to-text guide — current transcription models, supported formats, and 25 MB limit: https://platform.openai.com/docs/guides/speech-to-text
- `whisper.cpp` model docs — downloadable preconverted models and CLI usage after download: https://github.com/ggml-org/whisper.cpp/blob/master/models/README.md
