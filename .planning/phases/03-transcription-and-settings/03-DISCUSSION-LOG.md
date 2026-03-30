# Phase 3: Transcription and Settings - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-30
**Phase:** 03-transcription-and-settings
**Areas discussed:** Transcript start and ownership, transcript surface and retry behavior, settings entry and storage-root behavior, transcription mode and provider configuration, local transcription experience, transcript editability and regeneration, transcript output shape, specific built-in backend provider, local model/runtime delivery, transcript replacement behavior, credential storage and validation, failure handling during auto-transcription

---

## Transcript Start and Ownership

| Option | Description | Selected |
|--------|-------------|----------|
| Manual trigger per saved audio/video card | Each saved media card gets its own transcript action, and only that attachment is processed. | |
| Auto-start after save/import | Transcription begins automatically as soon as eligible media is saved. | ✓ |
| Manual trigger at the note level | A note-level action scans the note and transcribes eligible media. | |

**User's choice:** Auto-start after save/import
**Notes:** User clarified that the common case is one attachment per note and that attachment should be "the transcript" owner for the note.

---

## Transcript Surface and Retry Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated transcript section in the active note | Keep transcript separate from the user-written note description, with its own loading/error/retry state. | ✓ |
| Write transcript directly into the note description/body | Simplifies the data model, but mixes generated and user-authored content. | |
| Transcript panel on each media card | Keeps transcript closest to the attachment, but can get cramped and repetitive. | |

**User's choice:** Dedicated transcript section in the active note
**Notes:** The transcript section should stay separate from the user-authored description and own its own status states.

---

## Settings Entry and Storage-Root Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated Settings view/panel with explicit migrate-data confirmation | Clear configuration surface and strongest protection for existing local data. | |
| Inline settings inside the note workspace | Lower navigation cost, but mixes app configuration with note work. | |
| Dedicated Settings view, but storage-root change only affects future files | Keeps configuration separate and avoids migration complexity. | ✓ |

**User's choice:** Dedicated Settings view, with local folder changes affecting only future files
**Notes:** User clarified that destination choice is about freedom to choose where future information is saved and explicitly said this is not a migrate-from-local-to-cloud flow. They named `Local`, `Google Drive`, and `OneDrive` as destination options, while actual cloud transfer remains a later phase.

---

## Transcription Mode and Provider Configuration

| Option | Description | Selected |
|--------|-------------|----------|
| One app-wide transcription mode in Settings | Users choose `Local` or `Backend` once, and new transcript jobs follow that mode. | ✓ |
| Choose mode per transcript job | More flexible, but repeats the decision every time. | |
| Global default with per-job override | Most flexible, but heavier UI/state. | |

**User's choice:** One app-wide transcription mode
**Notes:** User chose one backend provider only for Phase 3, not multiple providers.

---

## Local Transcription Experience

| Option | Description | Selected |
|--------|-------------|----------|
| Built in and works out of the box | Local transcription should work immediately inside Privanote. | ✓ |
| Depends on user-installed local tooling/models | Smaller app responsibility, but weaker first-run experience. | |
| Local mode exists but is disabled until user setup later | Keeps the setting visible, but delays usefulness. | |

**User's choice:** Built in and works out of the box
**Notes:** This applies to the `Local` mode selected from the app-wide transcription setting.

---

## Transcript Editability and Regeneration

| Option | Description | Selected |
|--------|-------------|----------|
| Read-only transcript with retry/regenerate | Keeps generated text separate from user-authored content. | ✓ |
| Fully editable transcript in place | More flexible, but complicates retries and provenance. | |
| Read-only raw transcript plus separate editable derived notes/summary field | More powerful, but too much scope for this phase. | |

**User's choice:** Read-only transcript with retry/regenerate
**Notes:** User wants the transcript itself to remain read-only in Phase 3.

---

## Transcript Output Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Plain text only | Simplest storage and UI shape. | ✓ |
| Timestamped segments | Useful for media navigation later, but adds more structure now. | |
| Rich speaker/timestamp output | Too much scope and may depend on provider-specific features. | |

**User's choice:** Plain text only
**Notes:** No timestamped or speaker-rich transcript output in Phase 3.

---

## Specific Built-In Backend Provider

| Option | Description | Selected |
|--------|-------------|----------|
| OpenAI Whisper-style backend | Fixed built-in provider with explicit credential fields and a known request shape. | ✓ |
| Another single named provider | Valid only if the user names a different provider. | |

**User's choice:** OpenAI Whisper-style backend
**Notes:** User first chose a single built-in provider model, then locked the provider to the OpenAI Whisper-style option.

---

## Local Model/Runtime Delivery

| Option | Description | Selected |
|--------|-------------|----------|
| App-managed first-use download/setup | Keep the installer smaller while still avoiding manual user setup. | ✓ |
| Ship everything inside the app bundle | Stronger offline first run, but much heavier bundle. | |
| Bundle a minimal starter model and allow larger optional downloads later | More flexible long-term, but more asset-management complexity now. | |

**User's choice:** App-managed first-use download/setup
**Notes:** Local mode should still feel built in and out of the box, but the heavy runtime/model payload does not need to ship entirely inside the initial app bundle.

---

## Transcript Replacement Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Replace the existing transcript in place | Matches the one-media-attachment, one-transcript model. | ✓ |
| Keep transcript history/versions | Useful later, but adds versioning complexity now. | |
| Ask each time whether to replace or keep both | Flexible, but adds decision friction. | |

**User's choice:** Replace the existing transcript in place
**Notes:** This applies both to regenerate flows and to cases where the note's primary media attachment changes later.

---

## Credential Storage and Validation

| Option | Description | Selected |
|--------|-------------|----------|
| Store locally, mask in the UI, validate when saving settings | Best balance of usability and immediate feedback. | ✓ |
| Store locally, but don't validate until a transcript job runs | Simpler save path, but errors appear later. | |
| Don't persist it; require re-entry each session | Stronger privacy posture, but poor usability. | |

**User's choice:** Store locally, mask in the UI, validate when saving settings
**Notes:** This applies specifically to the OpenAI Whisper-style backend credential path.

---

## Failure Handling During Auto-Transcription

| Option | Description | Selected |
|--------|-------------|----------|
| Show failed state inline and wait for explicit user retry | Clear and predictable, without hidden retries. | |
| Auto-retry in the background a few times | Recover transient failures while keeping the transcript tied to the automatic flow. | ✓ |
| Fall back automatically to the other transcription mode | Surprising and mixes configured modes. | |

**User's choice:** Auto-retry in the background a few times
**Notes:** Follow-up clarification locked the retry policy to a small fixed number of retries, then a visible failed state.

---

## the agent's Discretion

- Exact retry count and backoff timing for the small fixed retry policy.
- Exact first-use local model setup UX.
- Exact transcript/status copy and settings layout structure.
- Exact credential persistence mechanism, as long as it stays local and masked.

## Deferred Ideas

- Actual Google Drive and OneDrive upload/sync flows remain Phase 4 work.
- Transcript history/versioning, editable transcripts, and timestamp/speaker-rich transcript output remain outside Phase 3.
