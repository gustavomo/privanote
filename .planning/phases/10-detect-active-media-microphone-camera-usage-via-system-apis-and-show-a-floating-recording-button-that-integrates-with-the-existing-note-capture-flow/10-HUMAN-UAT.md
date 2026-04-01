---
status: partial
phase: 10-detect-active-media-microphone-camera-usage-via-system-apis-and-show-a-floating-recording-button-that-integrates-with-the-existing-note-capture-flow
source: [10-VERIFICATION.md]
started: 2026-04-01T15:10:00.000Z
updated: 2026-04-01T15:10:00.000Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Call detection and button appearance
expected: Third button appears within 2-3s when external call app uses mic/camera
result: [pending]

### 2. Recording produces note with attachment
expected: Record call, stop, note created with "[App] call — [Date], [Time]" title and audio/video attachment
result: [pending]

### 3. Amber state on call end
expected: End external call while recording, button turns amber, recording continues
result: [pending]

### 4. Mutual exclusion
expected: Screen capture button disabled during call recording and vice versa
result: [pending]

### 5. Overlay resize animation
expected: Smooth 200ms animation when buttons appear/disappear
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
