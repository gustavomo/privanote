# Phase 13: AI-powered capture processing - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-01
**Phase:** 13-ai-powered-capture-processing
**Areas discussed:** Processing trigger & pipeline, Deduplication strategy, Vision API & privacy, Note output format

---

## Processing Trigger & Pipeline

| Option | Description | Selected |
|--------|-------------|----------|
| Batch at session end | Process all captures in finalize() before creating the note | ✓ |
| Async after note creation | Create raw note instantly, process in background | |
| Real-time during capture | Process each capture as it arrives | |

**User's choice:** Batch at session end
**Notes:** Simpler, single API call with full context. User waits a few seconds for a clean note.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Always on if API key set | If user has OpenAI key, captures are always AI-processed | ✓ |
| Separate toggle in settings | Add a 'Smart capture processing' toggle | |
| Per-session choice | Prompt at session end | |

**User's choice:** Always on if API key set
**Notes:** Matches transcription auto-start pattern from Phase 3.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Fall back to raw note | Create note with unprocessed captures on failure | ✓ |
| Retry then fall back | Retry once, then fall back | |

**User's choice:** Fall back to raw note
**Notes:** Capture data is never lost.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, both pipelines | Both screen captures and clipboard entries get AI processing | ✓ |
| Screen capture only | Only screen captures get AI processing | |
| You decide | Claude picks | |

**User's choice:** Yes, both pipelines
**Notes:** Unified experience across capture types.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Keep separate notes | Each session type produces its own note | ✓ |
| Merge if overlapping | Combine captures from both into one note | |
| You decide | Claude picks | |

**User's choice:** Keep separate notes
**Notes:** Simpler, matches current behavior.

---

## Deduplication Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Fuzzy similarity threshold | Skip text if >90% similar to previous from same app | ✓ |
| Exact match only | Only skip if byte-identical | |
| Let AI handle it | Send all text to AI for dedup at session end | |

**User's choice:** Fuzzy similarity threshold (>90%)
**Notes:** Handles minor timestamp/counter differences in AX tree text.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Skip by app+title match | Don't re-screenshot same appName + windowTitle | |
| Always capture, dedup later | Take all screenshots, remove duplicates in finalization | |
| Skip by visual similarity | Compare screenshot pixels/hash to detect content changes | ✓ |

**User's choice:** Skip by visual similarity
**Notes:** Most accurate approach.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Perceptual hash (pHash) | Fast fingerprint comparison, tolerates minor UI changes | ✓ |
| Pixel diff percentage | Compare raw pixels, skip if <10% changed | |

**User's choice:** Perceptual hash (pHash)
**Notes:** Good balance of speed (~1ms) and accuracy.

---

## Vision API & Privacy

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, with global toggle | Enable via setting, default off | |
| Always on with API key | Runs automatically when key exists | ✓ |
| No vision API in Phase 13 | Defer to later phase | |

**User's choice:** Always on with API key, but with sensitive data redaction
**Notes:** User specified that sensitive data (API keys, passwords) visible in text should be detected and redacted in screenshots before sending.

---

| Option | Description | Selected |
|--------|-------------|----------|
| App-based filtering | Skip vision for sensitive apps via blocklist | |
| Blur/redact heuristics | Detect and blur sensitive content before sending | ✓ |
| User-controlled blocklist | Let users configure which apps skip vision | |

**User's choice:** Blur/redact heuristics
**Notes:** User clarified this should be text-pattern-based detection — scan extracted text for API keys, passwords, secrets and redact those regions in the screenshot.

---

| Option | Description | Selected |
|--------|-------------|----------|
| gpt-4o-mini | Cheaper, faster, good for screenshots | ✓ |
| gpt-4o | More capable for complex diagrams | |
| You decide | Claude picks | |

**User's choice:** gpt-4o-mini
**Notes:** Matches the 'mini' cost pattern from transcription.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Always analyze | Every screenshot gets vision analysis | ✓ |
| Only on low-confidence | Run vision only when text extraction was poor | |
| You decide | Claude picks | |

**User's choice:** Always analyze
**Notes:** Provides rich context that text alone can't capture.

---

## Note Output Format

| Option | Description | Selected |
|--------|-------------|----------|
| Summary + cleaned text | AI summary at top, cleaned text grouped by app below | ✓ |
| Summary only | Replace raw text with AI summary | |
| Cleaned text only | Clean OCR artifacts, no summarization | |

**User's choice:** Summary + cleaned text
**Notes:** Best of both overview and detail.

---

| Option | Description | Selected |
|--------|-------------|----------|
| AI-generated hashtags in body | Append tags as hashtags in note description | |
| Structured tag metadata | Store tags in database field | ✓ |
| No auto-tagging | Skip tagging | |

**User's choice:** Use existing `tags` field
**Notes:** User indicated there's already a tags field on notes. Use that directly.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Inline in note body | Vision descriptions appear alongside text per screenshot | ✓ |
| Separate section | Vision descriptions in dedicated section at bottom | |

**User's choice:** Inline in note body
**Notes:** Single place for all captured context.

---

## Claude's Discretion

No areas deferred to Claude's discretion.

## Deferred Ideas

None — discussion stayed within phase scope.
