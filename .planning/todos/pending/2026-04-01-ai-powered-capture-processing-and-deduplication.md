---
created: 2026-04-01T06:10:00.000Z
title: AI-powered capture processing and deduplication
area: ui
files:
  - apps/desktop/src/main/capture-session.js
  - apps/desktop/src/main/screen-capture.js
  - apps/desktop/src/main/main.js
---

## Problem

Captured text is saved raw with no processing — OCR artifacts, duplicates from revisiting the same app/screen, and no summarization. Screenshots are not analyzed by AI, missing context that text extraction alone can't capture.

## Solution

### 1. AI-powered text processing (post-capture, before note creation)

- **Summarize** extracted text into key points using the OpenAI provider (already configured in Phase 3 for transcription)
- **Clean up** OCR artifacts before saving (remove garbled characters, fix spacing)
- **Generate tags** automatically from the content (app names, topics, keywords)
- **Analyze screenshots with AI vision** to improve text extraction results — use OpenAI vision API to read screenshots that OCR/AX tree missed or got wrong, and to describe visual content (diagrams, charts, UI layouts)

### 2. Capture deduplication (during capture session)

- **Text-level dedup**: skip adding extracted text if it's identical or very similar to a previous capture from the same app
- **Screenshot-level dedup**: skip taking a screenshot entirely if returning to the same app + window title that was already captured
- **Both combined**: skip duplicate screenshots AND deduplicate text in the final note description

### Notes

- OpenAI provider and settings infrastructure already exist from Phase 3
- Vision API analysis should be optional (configurable in settings) since it sends screenshots to external service
- Deduplication should use fuzzy matching (e.g. >90% similarity) not just exact match, since AX tree text may have minor timestamp differences
