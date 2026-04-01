# Roadmap: Privanote

## Overview

This brownfield roadmap takes Privanote from a single-package Electron prototype to a local-first monorepo with a desktop frontend, local backend, media capture flows, configurable transcription, and optional cloud sync. The sequencing starts with monorepo and backend foundation work so recording, transcript, settings, and provider integrations all build on a stable local architecture.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Monorepo and Local Backend Foundation** - Restructure the repo, ship a local backend with the app, and stabilize storage, lifecycle, and test foundations.
- [x] **Phase 2: Capture and Save Flows** - Add audio/video recording plus import flows and persist media through the backend.
- [x] **Phase 3: Transcription and Settings** - Add configurable local/backend transcription and settings for storage, transcription, and providers.
- [x] **Phase 4: Optional Cloud Sync** - Connect Google Drive and OneDrive and sync local-first media to optional cloud storage. (completed 2026-03-30)

## Phase Details

### Phase 1: Monorepo and Local Backend Foundation
**Goal**: Establish the monorepo and local backend architecture while fixing startup, persistence, deletion behavior, and packaging foundations needed for the rest of v1.
**Depends on**: Nothing (first phase)
**Requirements**: [PLAT-01, PLAT-02, PLAT-03, PLAT-04, PLAT-05, PLAT-06, PLAT-07]
**UI hint**: no
**Success Criteria** (what must be TRUE):
  1. The repository is organized as a monorepo containing the desktop frontend and backend service.
  2. User can launch the desktop app successfully in development mode with the local backend available.
  3. User can launch the packaged desktop app with the local backend shipped as part of the product.
  4. User data persists in a stable app-owned directory and deletion flows do not leave orphaned data behind.
  5. The full v1 app remains usable without authentication, and regression coverage exists for critical frontend, backend, storage, and transcription workflows.
**Plans**: 3 planned

Plans:
- [x] 01-01: Restructure the workspace into a monorepo and define frontend/backend contracts
- [x] 01-02: Ship the local backend with the desktop app and stabilize storage plus lifecycle handling
- [x] 01-03: Add packaging, no-auth app flow guarantees, and regression coverage for the new architecture

### Phase 2: Capture and Save Flows
**Goal**: Let users record or import media in the desktop app and persist the result through the backend as part of the note workflow.
**Depends on**: Phase 1
**Requirements**: [CAP-01, CAP-02, CAP-03, CAP-04, CAP-05]
**UI hint**: yes
**Success Criteria** (what must be TRUE):
  1. User can record audio inside the desktop app.
  2. User can record video inside the desktop app.
  3. User can import existing audio, video, and file attachments.
  4. User can save recorded or imported media through the backend and see it again after relaunch.
**Plans**: 3 planned

Plans:
- [x] 02-01: Add the recording upload seam, permission handling, and review-first capture UX
- [x] 02-02: Add import flows and shared backend-managed persistence for recorded and existing media
- [x] 02-03: Surface saved media as cards in the workspace and add relaunch regression coverage

### Phase 3: Transcription and Settings
**Goal**: Add configurable transcription and the settings surface needed to control storage, transcription mode, and provider credentials.
**Depends on**: Phase 2
**Requirements**: [TRNS-01, TRNS-02, TRNS-03, TRNS-04, SET-01, SET-02, SET-03, SET-04, SET-05]
**UI hint**: yes
**Success Criteria** (what must be TRUE):
  1. User can generate a transcript for recorded or imported audio/video.
  2. User can choose whether transcription runs locally or through the backend from settings.
  3. User can save and revisit transcripts alongside the related note and media.
  4. User can configure local storage, transcription preferences, and provider credentials from settings with validation.
  5. Settings persist across relaunch and are reused by the app and local backend.
**Plans**: 3 planned

Plans:
- [x] 03-01: Add transcript persistence, transcriber adapters, and backend queue orchestration
- [x] 03-02: Add settings navigation, persisted preferences, and configurable local media destination
- [x] 03-03: Add provider credential validation, transcript states, and retry/error regressions

### Phase 4: Optional Cloud Sync
**Goal**: Extend the local-first workflow with optional Google Drive and OneDrive sync while preserving a local copy of recorded and imported media.
**Depends on**: Phase 3
**Requirements**: [SYNC-01, SYNC-02, SYNC-03, SYNC-04, SYNC-05]
**UI hint**: yes
**Success Criteria** (what must be TRUE):
  1. User can connect a Google Drive account for optional storage sync.
  2. User can connect a OneDrive account for optional storage sync.
  3. User can upload or sync recorded/imported media to the selected cloud provider.
  4. User can distinguish local-only and cloud-synced media in the UI.
  5. User keeps a local-first copy even when cloud sync is enabled.
**Plans**: 3/3 plans complete

Plans:
- [x] 04-01: Add a shared sync abstraction and Google Drive provider integration
- [x] 04-02: Add OneDrive provider integration and sync metadata persistence
- [x] 04-03: Surface sync state, retry controls, and local-first/cloud distinction in the workspace

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Monorepo and Local Backend Foundation | 3/3 | Complete | 2026-03-29 |
| 2. Capture and Save Flows | 3/3 | Complete | 2026-03-30 |
| 3. Transcription and Settings | 3/3 | Complete | 2026-03-30 |
| 4. Optional Cloud Sync | 3/3 | Complete    | 2026-03-30 |

### Phase 5: Make record or import always accessible as a persistent entry point

**Goal:** Restructure the workspace UX so recording and importing are the primary entry points. The capture panel moves to a persistent top-of-sidebar position. Notes are created automatically as a result of capture; the Create Note form is removed.
**Requirements**: [UX-01]
**Depends on:** Phase 4
**Plans:** 1/1 plans complete

Plans:
- [x] 05-01-PLAN.md — Refactor App.jsx sidebar layout and update regression tests for capture-first flow

### Phase 6: Always-on-top floating capture button for external app screen capture

**Goal:** Add a floating always-on-top button that lets users capture screenshots and extract text from any active external app, automatically creating structured notes grouped by source app when the session ends.
**Requirements**: [EXT-01, EXT-02, EXT-03, EXT-04, EXT-05, EXT-06]
**Depends on:** Phase 5
**Plans:** 4 plans

Plans:
- [x] 06-01-PLAN.md — Create floating overlay window, preload IPC bridge, and CaptureOverlay React component
- [x] 06-02-PLAN.md — Build capture session state machine, screenshot engine, and OCR text extraction
- [x] 06-03-PLAN.md — Wire overlay, capture session, and note creation into main.js with global shortcut
- [x] 06-04-PLAN.md — Add macOS Accessibility tree text extraction as primary method with OCR fallback

### Phase 7: Fix screen capture to record system audio instead of microphone

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 6
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 7 to break down)

### Phase 8: Limit floating capture button to specific apps

**Goal:** Show/hide the floating capture overlay based on the active foreground app. The overlay is hidden by default and only appears when the active app matches a user-configured whitelist of 5 preset apps. A settings UI lets users toggle which apps trigger the overlay.
**Requirements**: [APPVIS-01, APPVIS-02, APPVIS-03, APPVIS-04, APPVIS-05, APPVIS-06]
**Depends on:** Phase 7
**Plans:** 1/2 plans executed

Plans:
- [x] 08-01-PLAN.md — Build app detector, whitelist persistence, polling loop, and IPC bridge
- [ ] 08-02-PLAN.md — Add Capture Apps toggle section to Settings and verify end-to-end
