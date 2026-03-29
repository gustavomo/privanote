# Requirements: Privanote

**Defined:** 2026-03-28
**Core Value:** A user can capture and revisit media-backed notes locally, quickly, and without losing control of where their data lives.

## v1 Requirements

Requirements for the current brownfield scope. These map to roadmap phases for stabilizing the existing desktop app and shipping the next attachment-focused features.

### Foundation

- [ ] **CORE-01**: User can launch the desktop app successfully in development mode
- [ ] **CORE-02**: User can launch the packaged desktop app and reach the existing node workspace
- [ ] **CORE-03**: User data is stored in a stable app-owned directory instead of the current working directory
- [ ] **CORE-04**: Deleting a node removes its attachment rows without leaving orphaned data
- [ ] **CORE-05**: The Electron window and IPC boundary use explicit secure defaults appropriate for a preload-based desktop app
- [ ] **CORE-06**: Critical startup, database, and attachment workflows are covered by automated regression tests

### Media Experience

- [ ] **MEDIA-01**: User can preview supported text and file attachments from the node details view
- [ ] **MEDIA-02**: User can play attached audio inside the app
- [ ] **MEDIA-03**: User can play attached video inside the app
- [ ] **MEDIA-04**: User can open unsupported attachment types from the app with a clear fallback action

### Settings

- [ ] **SET-01**: User can choose the app storage directory from a settings surface
- [ ] **SET-02**: User can enter and update provider credentials from a settings surface
- [ ] **SET-03**: User receives validation feedback for invalid storage paths or provider configuration

### Cloud Attachments

- [ ] **CLOUD-01**: User can connect a Google Drive account for cloud-backed attachments
- [ ] **CLOUD-02**: User can connect a OneDrive account for cloud-backed attachments
- [ ] **CLOUD-03**: User can attach provider-backed files to a node and persist provider metadata
- [ ] **CLOUD-04**: User can distinguish local and cloud-backed attachments in the UI

## v2 Requirements

### Attachment Intelligence

- **MEDIA-05**: User can resume media playback from the last known position
- **MEDIA-06**: User can view thumbnails or richer previews for more attachment types

### Sync and Expansion

- **CLOUD-05**: User can cache cloud attachments for offline access
- **CLOUD-06**: User can connect additional storage providers beyond Google Drive and OneDrive
- **ORG-01**: User can search and filter nodes by tags, title text, and attachment type

## Out of Scope

Explicitly excluded from the current roadmap to keep the brownfield scope controlled.

| Feature | Reason |
|---------|--------|
| Real-time collaboration | Product is currently single-user and local-first |
| Full note database sync across devices | Current cloud scope is attachment providers only |
| Web client | Existing architecture is Electron desktop only |
| Mobile app | Not aligned with the current repo architecture or near-term milestones |
| Advanced media editing/transcoding | Preview and playback are the current usability priority |

## Traceability

Which phases cover which requirements. This will be updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CORE-01 | Phase 1 | Pending |
| CORE-02 | Phase 1 | Pending |
| CORE-03 | Phase 1 | Pending |
| CORE-04 | Phase 1 | Pending |
| CORE-05 | Phase 1 | Pending |
| CORE-06 | Phase 1 | Pending |
| MEDIA-01 | Phase 2 | Pending |
| MEDIA-02 | Phase 2 | Pending |
| MEDIA-03 | Phase 2 | Pending |
| MEDIA-04 | Phase 2 | Pending |
| SET-01 | Phase 3 | Pending |
| SET-02 | Phase 3 | Pending |
| SET-03 | Phase 3 | Pending |
| CLOUD-01 | Phase 4 | Pending |
| CLOUD-02 | Phase 4 | Pending |
| CLOUD-03 | Phase 4 | Pending |
| CLOUD-04 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-28*
*Last updated: 2026-03-28 after roadmap creation*
