# Phase 9: Discussion Log

**Date:** 2026-04-01
**Phase:** 09-toggle-button-for-clipboard-text-capture
**Mode:** discuss
**Areas discussed:** 4/4

## Gray Areas Identified

1. Activation model
2. Capture scope and grouping
3. Deduplication and filtering
4. UI surface

## Discussion Summary

### 1. Activation model (5 questions)

| Question | Decision |
|----------|----------|
| When active — tied to capture session or independent? | Separate toggle, independent of capture |
| Where toggle lives | Floating overlay button (extend existing overlay) |
| How to save captured entries | Buffer until manually stopped, auto-create note |
| Coexistence with screen capture | Both run simultaneously, produce separate notes |
| Global keyboard shortcut | Yes, register a global shortcut for toggle |

### 2. Capture scope and grouping (3 questions)

| Question | Decision |
|----------|----------|
| Content types to capture | Text only (no images/files) |
| Note organization | Grouped by source app (headings per app) |
| Metadata per entry | Timestamp + source app name |

### 3. Deduplication and filtering (3 questions)

| Question | Decision |
|----------|----------|
| Duplicate handling | Deduplicate globally (skip same text regardless of source) |
| Minimum text length | Yes, ~5 char threshold to filter noise |
| Sensitive content | Skip concealed clipboard entries (password manager convention) |

### 4. UI surface (3 questions)

| Question | Decision |
|----------|----------|
| Overlay button placement | Second button next to capture button |
| Live entry count | Yes, badge counter on clipboard button |
| Review before save | No — auto-save on stop, consistent with capture |

## Output

- `09-CONTEXT.md` written with 13 decisions (D-01 through D-13)
- All 4 gray areas resolved
- No deferred ideas
