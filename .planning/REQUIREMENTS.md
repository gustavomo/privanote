# Requirements: Privanote

**Defined:** 2026-03-28
**Core Value:** A user can capture and revisit media-backed notes locally, quickly, and without losing control of where their data lives.

## v1 Requirements

Requirements for the clarified v1 scope. These map to roadmap phases for turning the current brownfield desktop prototype into a monorepo with a local backend, capture flows, transcription, and optional cloud sync.

### Platform Foundation

- [x] **PLAT-01**: The repository is organized as a monorepo containing the desktop frontend and backend service
- [x] **PLAT-02**: User can launch the desktop app successfully in development mode with the local backend available
- [x] **PLAT-03**: User can launch the packaged desktop app with the local backend shipped as part of the product
- [x] **PLAT-04**: User data is stored in a stable app-owned directory instead of the current working directory
- [x] **PLAT-05**: Deleting a note or media item removes related persisted data without leaving orphaned records
- [x] **PLAT-06**: User can use the full v1 app without creating an account or signing in
- [x] **PLAT-07**: Critical frontend, backend, capture, storage, and transcription workflows are covered by automated regression tests

### Capture and Save

- [x] **CAP-01**: User can record audio inside the desktop app
- [x] **CAP-02**: User can record video inside the desktop app
- [x] **CAP-03**: User can import existing audio, video, and file attachments
- [x] **CAP-04**: User can save recorded or imported media through the backend and associate it with a note
- [x] **CAP-05**: User can see saved recordings and imported media in the desktop workspace after relaunch

### Transcription

- [x] **TRNS-01**: User can generate a transcript for recorded or imported audio/video
- [x] **TRNS-02**: User can choose whether transcription runs locally or through the backend from settings
- [x] **TRNS-03**: User can save and revisit transcripts alongside the related note and media
- [x] **TRNS-04**: User receives a clear retryable error state when transcription fails

### Settings and Storage

- [x] **SET-01**: User can choose the local storage directory from a settings surface
- [x] **SET-02**: User can configure storage and transcription preferences from a settings surface
- [x] **SET-03**: User can enter and update provider credentials from a settings surface
- [x] **SET-04**: User receives validation feedback for invalid storage, transcription, or provider configuration
- [x] **SET-05**: Settings persist across relaunch and are reused by the app and local backend

### Optional Cloud Sync

- [x] **SYNC-01**: User can connect a Google Drive account for optional storage sync
- [x] **SYNC-02**: User can connect a OneDrive account for optional storage sync
- [x] **SYNC-03**: User can upload or sync recorded/imported media to the selected cloud provider
- [x] **SYNC-04**: User can distinguish local-only and cloud-synced media in the UI
- [x] **SYNC-05**: User keeps a local-first copy of media even when cloud sync is enabled

### Workspace UX

- [x] **UX-01**: The capture panel (recording and import) is always visible at the top of the workspace sidebar so users can start a capture from anywhere without creating a note first. Notes are created automatically as a result of capture.

### External App Screen Capture

- [ ] **EXT-01**: User can see and interact with a floating capture button that stays on top of all other apps
- [ ] **EXT-02**: User can start and stop a screen capture session from the floating button or via keyboard shortcut (Cmd+Shift+R)
- [x] **EXT-03**: Screenshots of the active external app are captured automatically during a session, tagged with app name and timestamp
- [x] **EXT-04**: Text is extracted from captured screenshots using OCR
- [ ] **EXT-05**: A structured note is automatically created when the capture session ends, grouping content by source app
- [x] **EXT-06**: Text is extracted from the active app's accessibility tree when available, falling back to OCR

## v2 Requirements

### Deployment and Identity

- **DEP-01**: The backend can be deployed outside the desktop app for cloud-hosted operation
- **AUTH-01**: User can sign in when hosted/backend-shared operation becomes necessary

### Media Expansion

- **MEDIA-06**: User can resume media playback from the last known position
- **MEDIA-07**: User can view thumbnails or richer previews for more attachment types
- **SYNC-06**: User can connect additional storage providers beyond Google Drive and OneDrive

## Out of Scope

Explicitly excluded from the current roadmap to keep the brownfield scope controlled.

| Feature | Reason |
|---------|--------|
| User accounts or sign-in in v1 | The first release should work without authentication |
| Hosted/cloud backend deployment in v1 | Deployment strategy is deferred to v2 |
| Real-time collaboration | Product is currently single-user and local-first |
| Web client | Current scope is a desktop frontend plus local backend |
| Mobile app | Not aligned with the current repo architecture or near-term milestones |
| Advanced media editing/transcoding | Capture, transcript, save, and sync matter before editing workflows |

## Traceability

Which phases cover which requirements. This will be updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PLAT-01 | Phase 1 | Complete |
| PLAT-02 | Phase 1 | Complete |
| PLAT-03 | Phase 1 | Complete |
| PLAT-04 | Phase 1 | Complete |
| PLAT-05 | Phase 1 | Complete |
| PLAT-06 | Phase 1 | Complete |
| PLAT-07 | Phase 1 | Complete |
| CAP-01 | Phase 2 | Complete |
| CAP-02 | Phase 2 | Complete |
| CAP-03 | Phase 2 | Complete |
| CAP-04 | Phase 2 | Complete |
| CAP-05 | Phase 2 | Complete |
| TRNS-01 | Phase 3 | Complete |
| TRNS-02 | Phase 3 | Complete |
| TRNS-03 | Phase 3 | Complete |
| TRNS-04 | Phase 3 | Complete |
| SET-01 | Phase 3 | Complete |
| SET-02 | Phase 3 | Complete |
| SET-03 | Phase 3 | Complete |
| SET-04 | Phase 3 | Complete |
| SET-05 | Phase 3 | Complete |
| SYNC-01 | Phase 4 | Complete |
| SYNC-02 | Phase 4 | Complete |
| SYNC-03 | Phase 4 | Complete |
| SYNC-04 | Phase 4 | Complete |
| SYNC-05 | Phase 4 | Complete |
| UX-01 | Phase 5 | In Progress |
| EXT-01 | Phase 6 | Planned |
| EXT-02 | Phase 6 | Planned |
| EXT-03 | Phase 6 | Planned |
| EXT-04 | Phase 6 | Planned |
| EXT-05 | Phase 6 | Planned |
| EXT-06 | Phase 6 | Planned |

**Coverage:**
- v1 requirements: 33 total
- Mapped to phases: 33
- Unmapped: 0

---
*Requirements defined: 2026-03-28*
*Last updated: 2026-03-31 after Phase 6 planning*
