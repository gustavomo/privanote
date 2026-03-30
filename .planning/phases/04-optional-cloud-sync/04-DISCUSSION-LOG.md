# Phase 4: Optional Cloud Sync - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md; this log preserves the alternatives considered.

**Date:** 2026-03-30
**Phase:** 04-optional-cloud-sync
**Areas discussed:** Sync target model, Sync trigger behavior, Sync payload shape, Sync state and failure UX, Account connection flow, Cloud folder organization, Local-first behavior during sync failure, Resync and duplicate behavior, Existing synced item behavior on default change, Disconnect behavior, Provider auth persistence, Transcript sync trigger timing

---

## Sync Target Model

### Q1. How an attachment chooses a provider

| Option | Description | Selected |
|--------|-------------|----------|
| One selected provider per attachment | Each media item syncs to exactly one cloud destination. | ✓ |
| Mirror the same attachment to both providers | More flexible, but doubles sync state and provider bookkeeping. | |
| One app-wide provider only | Simplest model, but less flexible for later note/media choices. | |

**User's choice:** `One selected provider per attachment`
**Notes:** User clarified that both providers may be connected, but the user should choose only one target per attachment.

---

## Sync Trigger Behavior

### Q1. How sync starts

| Option | Description | Selected |
|--------|-------------|----------|
| Manual per media card | Media stays local-first until the user explicitly syncs it. | |
| Automatic for new saves based on the selected default destination | New saves sync automatically according to the current default provider. | ✓ |
| Global default plus per-card override | More flexible, but heavier UI/state for the first sync phase. | |

**User's choice:** `Automatic for new saves based on the selected default destination`
**Notes:** Automatic sync should key off the current default destination setting.

### Q2. What happens when the default destination changes

| Option | Description | Selected |
|--------|-------------|----------|
| Leave older unsynced local items untouched | Only future saves use the new default. | |
| Queue older unsynced local items to the new default | Existing unsynced items should also begin syncing to the new default provider. | ✓ |
| Ask before queueing older unsynced local items | Adds a migration prompt/workflow. | |

**User's choice:** `Queue older unsynced local items to the new default`
**Notes:** This applies only to unsynced items, not to attachments that were already synced elsewhere.

---

## Sync Payload Shape

### Q1. What gets uploaded

| Option | Description | Selected |
|--------|-------------|----------|
| Media file plus a small metadata sidecar | Keeps the cloud copy understandable outside the app. | |
| Media file only | Lowest scope, but loses note context. | |
| Full note package | Richer cloud replication, but much larger scope. | |
| Freeform | Media file, transcript text, and note metadata sidecar. | ✓ |

**User's choice:** `Media file, transcript text, and note metadata sidecar`
**Notes:** Follow-up clarification confirmed the "small metadata sidecar" option should also include transcript text.

---

## Sync State and Failure UX

### Q1. How sync state appears on media cards

| Option | Description | Selected |
|--------|-------------|----------|
| Compact status badge plus retry action | Show concise sync state directly on each media card. | ✓ |
| Detailed sync panel on every card | More information, but heavier than needed. | |
| Status only in Settings | Too hidden for a media-first workflow. | |

**User's choice:** `Compact status badge plus retry action`
**Notes:** Phase 4 should surface sync state directly on media cards.

---

## Account Connection Flow

### Q1. Where provider connection happens

| Option | Description | Selected |
|--------|-------------|----------|
| Connect from Settings with provider-specific `Connect` actions | Keeps account setup app-wide and separate from media actions. | ✓ |
| Connect on first sync from a media card | More contextual, but mixes setup with media actions. | |
| Support both | Flexible, but heavier UX for the first sync phase. | |

**User's choice:** `Connect from Settings with provider-specific Connect actions`
**Notes:** "Connected" state should persist in the app once established.

---

## Cloud Folder Organization

### Q1. Top-level provider organization

| Option | Description | Selected |
|--------|-------------|----------|
| One app root folder per provider, organized beneath it | Keeps provider storage understandable and contained. | ✓ |
| Flat single folder | Simpler, but messy as attachments accumulate. | |
| User chooses exact folder each time | Too much friction for automatic sync. | |

**User's choice:** `One app root folder per provider, organized beneath it`
**Notes:** Sync should not scatter files into arbitrary provider locations.

### Q2. Organization under the app root

| Option | Description | Selected |
|--------|-------------|----------|
| Note-based folders | Each note gets its own folder so media and metadata stay grouped. | ✓ |
| Date-based folders | Simpler chronologically, but weaker note grouping. | |
| Flat filenames inside the app root | Still under one root, but no meaningful grouping. | |

**User's choice:** `Note-based folders`
**Notes:** User explicitly said the project should create one folder per note.

---

## Local-First Behavior During Sync Failure

### Q1. What failure should do to the local attachment

| Option | Description | Selected |
|--------|-------------|----------|
| Keep the local attachment fully usable, mark sync failed, and allow retry | Strongest local-first behavior. | ✓ |
| Pause access until sync succeeds | Conflicts with the product's local-first value. | |
| Fall back silently to local-only | Less visible, but too surprising. | |

**User's choice:** `Keep the local attachment fully usable, mark sync failed, and allow retry`
**Notes:** Sync failure must never reduce local usability.

---

## Resync and Duplicate Behavior

### Q1. What happens on resync or destination update

| Option | Description | Selected |
|--------|-------------|----------|
| Keep one cloud copy per provider target and update/overwrite it | Avoids duplicate clutter and keeps sync state simple. | ✓ |
| Create a new cloud copy each time | Preserves history, but quickly creates clutter. | |
| Ask each time whether to overwrite or duplicate | Too much friction for automatic sync. | |

**User's choice:** `Keep one cloud copy per provider target and update/overwrite it`
**Notes:** Phase 4 should not create provider-specific duplicates for normal retries or updates.

---

## Existing Synced Item Behavior on Default Change

### Q1. What happens to attachments already synced to the old provider

| Option | Description | Selected |
|--------|-------------|----------|
| Leave existing synced items where they are | Future and previously-unsynced items use the new default, but already-synced items stay put. | ✓ |
| Queue previously synced items to the new default too | Makes the new default comprehensive, but creates duplicate remote copies. | |
| Ask whether to migrate already-synced items | Adds a migration workflow. | |

**User's choice:** `Leave existing synced items where they are`
**Notes:** Default-destination changes should not migrate or duplicate already-synced attachments.

---

## Disconnect Behavior

### Q1. What happens to remote files on disconnect

| Option | Description | Selected |
|--------|-------------|----------|
| Leave remote files in place and forget the live connection locally | Safest first sync behavior. | ✓ |
| Prompt to optionally clean up remote files | Adds destructive remote-delete scope. | |
| Automatically delete remote files on disconnect | Too risky. | |

**User's choice:** `Leave remote files in place and forget the live connection locally`
**Notes:** Disconnect is not a destructive cleanup action in Phase 4.

---

## Provider Auth Persistence

### Q1. How provider auth should live locally

| Option | Description | Selected |
|--------|-------------|----------|
| Persist the provider connection and refresh it when possible | Best fit for background automatic sync. | ✓ |
| Require reconnect every app session | Weak for automatic sync. | |
| Persist only a minimal connected flag | Lower complexity, but awkward once automatic sync starts. | |

**User's choice:** `Persist the provider connection and refresh it when possible`
**Notes:** Automatic sync depends on connections surviving relaunch.

---

## Transcript Sync Trigger Timing

### Q1. What happens if cloud sync starts before transcript generation finishes

| Option | Description | Selected |
|--------|-------------|----------|
| Upload the media first, then patch the cloud folder later with transcript/metadata updates | Fits the existing async transcript flow and avoids blocking sync on transcription. | ✓ |
| Wait until transcript is ready before first cloud sync | Couples two background jobs more tightly and delays sync. | |
| Provider-dependent behavior | Too much branching for Phase 4. | |

**User's choice:** `Upload the media first, then patch the cloud folder later with transcript/metadata updates`
**Notes:** Initial cloud sync should not wait for transcript completion.

## the agent's Discretion

- Exact sync badge wording and visual treatment on media cards.
- Exact metadata sidecar schema and provider bookkeeping fields.
- Exact token refresh/storage mechanism for persisted provider auth.
- Exact retry/backoff timing for automatic sync jobs.

## Deferred Ideas

- Mirroring the same attachment to both providers.
- Migrating already-synced items when the default provider changes.
- Remote cleanup/delete prompts during disconnect.
- Full cloud note replication beyond media, transcript, and compact metadata.

---

*Phase: 04-optional-cloud-sync*
*Discussion log generated: 2026-03-30*
