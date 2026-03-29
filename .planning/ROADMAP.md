# Roadmap: Privanote

## Overview

This brownfield roadmap takes Privanote from an unstable but functional local-first Electron app to a reliable attachment workspace with richer media handling, managed settings, and cloud-backed attachment providers. The sequencing starts with startup, storage, deletion, security, and regression fixes so later UI and provider work builds on a trustworthy desktop foundation instead of inheriting current defects.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation and Reliability** - Fix startup, storage, data-integrity, security defaults, and regression gaps in the current desktop app.
- [ ] **Phase 2: Local Media Experience** - Add in-app preview, playback, and fallback actions for local attachments.
- [ ] **Phase 3: Settings and Configuration** - Add a settings surface for storage location and provider credentials with validation.
- [ ] **Phase 4: Cloud-backed Attachments** - Connect Google Drive and OneDrive and expose provider-backed attachments in the workspace.

## Phase Details

### Phase 1: Foundation and Reliability
**Goal**: Stabilize the existing Electron application so startup, persistence, deletion behavior, and desktop security defaults are dependable before feature expansion.
**Depends on**: Nothing (first phase)
**Requirements**: [CORE-01, CORE-02, CORE-03, CORE-04, CORE-05, CORE-06]
**UI hint**: no
**Success Criteria** (what must be TRUE):
  1. User can launch the desktop app successfully in development mode and reach the existing node workspace.
  2. User can launch the packaged desktop app and reach the existing node workspace.
  3. User data persists in a stable app-owned directory regardless of the working directory used to launch the app.
  4. Deleting a node removes its attachment rows without leaving orphaned data behind.
  5. Regression coverage exists for startup, database, and attachment workflows, and the preload-based Electron window uses explicit secure defaults.
**Plans**: TBD

Plans:
- [ ] 01-01: Repair Electron bootstrap and dev/package startup path handling
- [ ] 01-02: Stabilize database storage location and enforce attachment cleanup guarantees
- [ ] 01-03: Harden preload-based window defaults and add startup/database/attachment regression coverage

### Phase 2: Local Media Experience
**Goal**: Turn attachment rows into usable in-app media interactions so users can inspect and play local content without leaving Privanote.
**Depends on**: Phase 1
**Requirements**: [MEDIA-01, MEDIA-02, MEDIA-03, MEDIA-04]
**UI hint**: yes
**Success Criteria** (what must be TRUE):
  1. User can preview supported text and file attachments from the node details view.
  2. User can play attached audio inside the app.
  3. User can play attached video inside the app.
  4. User can open unsupported attachment types from the app with a clear fallback action.
**Plans**: TBD

Plans:
- [ ] 02-01: Refactor the attachment details surface into preview-ready UI states
- [ ] 02-02: Implement supported file previews plus inline audio and video playback
- [ ] 02-03: Add unsupported-file fallback actions and media workflow regression checks

### Phase 3: Settings and Configuration
**Goal**: Give users a managed settings surface for storage and provider configuration so local and cloud attachment behavior can be controlled without manual file edits.
**Depends on**: Phase 1
**Requirements**: [SET-01, SET-02, SET-03]
**UI hint**: yes
**Success Criteria** (what must be TRUE):
  1. User can choose the app storage directory from a settings surface.
  2. User can enter and update provider credentials from a settings surface.
  3. User receives validation feedback for invalid storage paths or provider configuration.
  4. Saved settings persist across relaunch and are reused by the desktop app.
**Plans**: TBD

Plans:
- [ ] 03-01: Add settings navigation, renderer state, and preload/IPC configuration plumbing
- [ ] 03-02: Implement storage directory selection, persistence, and migration-safe handling
- [ ] 03-03: Implement provider credential forms, secure persistence, and validation feedback

### Phase 4: Cloud-backed Attachments
**Goal**: Extend attachments beyond local files by integrating supported cloud providers and making provider-backed attachment state visible in the UI.
**Depends on**: Phase 3
**Requirements**: [CLOUD-01, CLOUD-02, CLOUD-03, CLOUD-04]
**UI hint**: yes
**Success Criteria** (what must be TRUE):
  1. User can connect a Google Drive account for cloud-backed attachments.
  2. User can connect a OneDrive account for cloud-backed attachments.
  3. User can attach provider-backed files to a node and persist provider metadata.
  4. User can distinguish local and cloud-backed attachments in the UI.
**Plans**: TBD

Plans:
- [ ] 04-01: Add a shared provider abstraction and Google Drive attachment connector
- [ ] 04-02: Add a OneDrive attachment connector and provider metadata persistence
- [ ] 04-03: Surface cloud attachment actions, states, and local-vs-cloud distinction in the workspace

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation and Reliability | 0/TBD | Not started | - |
| 2. Local Media Experience | 0/TBD | Not started | - |
| 3. Settings and Configuration | 0/TBD | Not started | - |
| 4. Cloud-backed Attachments | 0/TBD | Not started | - |
