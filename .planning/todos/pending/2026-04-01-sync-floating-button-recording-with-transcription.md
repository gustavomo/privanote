---
created: 2026-04-01T23:00:01.538Z
title: Sync floating button recording with transcription
area: ui
files: []
---

## Problem

The floating button can trigger a recording, but it does not start transcription or sync the way the main panel recording does. This creates an inconsistent experience — recordings started from the floating button lack transcription and are not synced, while the same action from the main panel works fully.

## Solution

Ensure the floating button's recording action invokes the same transcription and sync pipeline as the main panel recording. The floating button's record handler should trigger:
1. Audio recording start
2. Transcription service start (same provider/config as main panel)
3. Sync initiation on completion

Reuse the existing main panel recording logic rather than duplicating it.
