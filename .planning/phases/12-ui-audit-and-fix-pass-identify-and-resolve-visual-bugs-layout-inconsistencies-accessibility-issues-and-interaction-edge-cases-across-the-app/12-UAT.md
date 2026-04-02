---
status: complete
phase: 12-ui-audit-and-fix-pass
source: [12-01-SUMMARY.md, 12-02-SUMMARY.md, 12-03-SUMMARY.md]
started: 2026-04-02T00:05:00Z
updated: 2026-04-02T00:05:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Dark mode toggle switches theme
expected: In Settings view, an "Appearance" section appears at the top with a Light/Dark/System toggle group. Clicking "Dark" switches the entire UI to dark mode. Clicking "Light" switches back. Clicking "System" follows your OS preference.
result: pass

### 2. Dark mode persists across relaunch
expected: Set theme to "Dark", close the app completely, reopen it. The app loads in dark mode immediately with no flash of light mode.
result: pass

### 3. Settings checkboxes use shadcn styling
expected: In Settings > Capture apps section, checkboxes have styled appearance (rounded corners, smooth check animation) instead of native browser checkboxes. Toggling them still works correctly.
result: issue
reported: "Some buttons don't have the desired style - missing borders. Buttons should have black background. Capture mode selector (Audio/Video/Video+Audio) shows unwanted radio button circles and border shadows."
severity: major

### 4. Settings radio buttons use shadcn styling
expected: In Settings, the "Default destination" and "Transcription mode" radio groups have styled circular indicators instead of native radio buttons with ugly border shadows. Selecting options still works correctly.
result: pass

### 5. All buttons have visible borders
expected: Throughout the app, all action buttons (Start Recording, Import Files, Save Settings, Choose Folder, etc.) have visible borders or filled backgrounds instead of appearing as borderless/invisible clickable text.
result: issue
reported: "Some buttons don't have the desired style. All buttons should have a border. Use a black background for primary buttons."
severity: major

### 6. Workspace/Settings tab switcher works
expected: The tab toggle at the top switches between Workspace and Settings views. The active tab shows a filled primary background with shadow and ring styling. Arrow keys navigate between tabs.
result: issue
reported: "Doesn't work - tab switcher not functioning"
severity: blocker

### 7. Capture mode selector works
expected: The Audio/Video/Video+Audio capture mode buttons switch correctly. The active mode shows filled primary styling. Buttons are disabled while recording.
result: issue
reported: "Doesn't work - capture mode selector not functioning"
severity: blocker

### 8. Note editor form uses shadcn inputs
expected: Select a note. The Title and Tags fields use styled inputs with consistent border radius and focus ring. The Description textarea has matching styling. Labels appear above each field.
result: pass

### 9. Media card buttons and badges styled
expected: On a note with media, the sync status badge uses styled pill-shaped badges. "Remove Media" button shows destructive outline styling (red text, red border). "Open File" button has outline styling.
result: pass

### 10. Transcript section buttons styled
expected: On a note with a transcript, the "Regenerate Transcript" button has outline styling and the "Retry Transcript" (on failure) has destructive outline styling with red text.
result: pass

## Summary

total: 10
passed: 6
issues: 4
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "All action buttons (Start Recording, etc.) should have visible borders or filled black background. Capture mode selector (Audio/Video/Video+Audio) and Workspace/Settings tab switcher should not show radio button circles or border shadows — they are toggle groups, not radio buttons."
  status: failed
  reason: "User reported: Some buttons missing borders, should use black background. Capture mode selector and Workspace/Settings toggle show unwanted radio button circles and border shadows."
  severity: major
  test: 3
  artifacts: [apps/desktop/src/renderer/App.jsx]
  missing: []
- truth: "All primary action buttons should have a black filled background with visible border, not the current shadcn primary color."
  status: failed
  reason: "User reported: Some buttons missing style. All buttons need a border. Primary buttons should use black background."
  severity: major
  test: 5
  artifacts: [apps/desktop/src/renderer/App.jsx, apps/desktop/src/renderer/components/settings-view.jsx]
  missing: []
- truth: "Workspace/Settings tab switcher should switch views correctly with visible active state styling"
  status: failed
  reason: "User reported: Doesn't work - tab switcher not functioning"
  severity: blocker
  test: 6
  artifacts: [apps/desktop/src/renderer/App.jsx]
  missing: []
- truth: "Capture mode selector (Audio/Video/Video+Audio) should switch modes correctly with visible active state"
  status: failed
  reason: "User reported: Doesn't work - capture mode selector not functioning"
  severity: blocker
  test: 7
  artifacts: [apps/desktop/src/renderer/App.jsx]
  missing: []
