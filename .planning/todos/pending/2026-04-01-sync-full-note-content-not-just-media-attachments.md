---
created: 2026-04-01T23:02:00.000Z
title: Sync full note content not just media attachments
area: general
files: []
---

## Problem

Currently, cloud sync (Google Drive / OneDrive) only handles media attachments. The note itself — its description text and capture screen data — does not sync. When a user copies content, it only fills a description locally. All notes should sync their full content (description, capture data, metadata) to the selected cloud provider, not just the attached media files.

## Solution

Extend the existing sync pipeline to include the full note payload:
1. Sync note description/text content alongside media attachments
2. Sync capture screen data (OCR text, screenshots metadata) as part of the note
3. Ensure the synced note folder on the provider contains a complete representation of the note, not just media files
4. Reuse the existing per-note folder structure and metadata sidecar pattern from Phase 4
