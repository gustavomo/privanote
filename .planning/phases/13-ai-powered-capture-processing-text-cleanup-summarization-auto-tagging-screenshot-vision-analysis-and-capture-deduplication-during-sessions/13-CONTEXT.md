# Phase 13: AI-powered capture processing — Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Enhance both screen capture and clipboard capture sessions with AI-powered post-processing that runs at session end. This includes: text cleanup (OCR artifact removal), summarization, auto-tagging, screenshot vision analysis via OpenAI, and capture deduplication (both text-level fuzzy matching and screenshot-level perceptual hashing). The result is cleaner, more useful notes created from capture sessions.

</domain>

<decisions>
## Implementation Decisions

### Processing Trigger & Pipeline
- **D-01:** AI processing runs as a batch step at session end, inside `finalize()`, before the note is created. User waits a few extra seconds but gets a clean note immediately.
- **D-02:** AI processing is always on when the OpenAI API key is configured. No separate toggle needed — mirrors the auto-start transcription pattern from Phase 3.
- **D-03:** On API failure (error, timeout, rate limit), fall back to creating the raw unprocessed note. No retry. Capture data is never lost.
- **D-04:** Both screen capture (CaptureSession) and clipboard (ClipboardSession) sessions go through the same AI processing pipeline.
- **D-05:** Screen capture and clipboard sessions produce separate notes even when running simultaneously. No merging.

### Deduplication Strategy
- **D-06:** Text-level deduplication uses fuzzy similarity matching (>90% threshold) during capture. If extracted text from a new capture is >90% similar to a previous capture from the same app, the text portion is skipped.
- **D-07:** Screenshot-level deduplication uses perceptual hashing (pHash). Before saving a new screenshot, compare its hash against previously captured screenshots. Skip if the perceptual hash distance is below the dedup threshold.
- **D-08:** Both text and screenshot dedup run during capture (not at session end), reducing the volume of data sent to the AI pipeline.

### Vision API & Privacy
- **D-09:** Every screenshot is analyzed with OpenAI vision API (gpt-4o-mini) — not just low-confidence ones. This provides rich context that text alone can't capture (diagrams, UI layouts, visual state).
- **D-10:** Before sending screenshots to the vision API, scan extracted text for sensitive patterns (API keys, passwords, secrets, tokens) and redact those regions in the screenshot. Text-pattern-based detection using the already-extracted AX tree / OCR text.
- **D-11:** Vision model is gpt-4o-mini — matches the "mini" cost pattern from transcription (gpt-4o-mini-transcribe).

### Note Output Format
- **D-12:** AI-processed notes contain: a brief summary at the top, followed by cleaned/deduplicated text grouped by source app. Best of both overview and detail.
- **D-13:** Auto-generated tags are stored in the existing `tags` field on notes. No schema changes needed.
- **D-14:** Vision analysis descriptions appear inline in the note body alongside their corresponding screenshot text (e.g., "[Screenshot: Slack conversation showing deployment discussion]"), not in a separate section.

### Folded Todos
- **AI-powered capture processing and deduplication** — The original todo that motivated this phase. Covers text cleanup, summarization, auto-tagging, vision analysis, and deduplication. Fully absorbed into the decisions above.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Capture Infrastructure
- `apps/desktop/src/main/capture-session.js` — CaptureSession class with start/stop/finalize lifecycle. `finalize()` is the insertion point for AI processing.
- `apps/desktop/src/main/screen-capture.js` — Screenshot capture, AX tree extraction, OCR fallback, active window info.
- `apps/desktop/src/main/clipboard-session.js` — ClipboardSession class for clipboard monitoring.
- `apps/desktop/src/main/ax-tree-extractor.js` — Accessibility tree text extraction (native binary wrapper).

### AI/OpenAI Infrastructure
- `apps/backend/src/services/openai-transcription.js` — Existing OpenAI API integration pattern (error normalization, file validation, API key usage).
- `apps/backend/src/services/settings-service.js` — Settings persistence including provider credentials.

### Note Creation
- `apps/desktop/src/main/main.js` — Main process IPC handlers including note creation from capture sessions.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **CaptureSession.finalize()**: Groups captures by app, generates title — natural insertion point for AI pipeline.
- **OpenAI API pattern**: `openai-transcription.js` establishes error normalization, API key handling, and file validation patterns reusable for vision API calls.
- **AX tree extractor**: Already extracts structured text with method/confidence metadata — confidence data useful for dedup decisions.
- **Settings infrastructure**: Provider credentials (OpenAI key) already persisted and validated via settings-service.
- **Note `tags` field**: Existing database field for tags — no schema migration needed for auto-tagging.

### Established Patterns
- **Session lifecycle**: Both CaptureSession and ClipboardSession follow the same start/stop/finalize pattern with state machine (idle → capturing → finalizing → idle).
- **Event-driven capture polling**: 2s polling with app-change detection and 10s heartbeat for same-app captures.
- **Grouped-by-app note creation**: Captures are grouped by appName in finalize(), with headings per source app.

### Integration Points
- **CaptureSession.finalize()** and **ClipboardSession equivalent**: Where AI processing pipeline hooks in.
- **main.js IPC handlers**: Where finalized capture data flows into note creation.
- **Settings view**: OpenAI API key already configurable — no new settings UI needed for basic AI processing.

</code_context>

<specifics>
## Specific Ideas

- Sensitive data detection should focus on text patterns visible in AX tree / OCR output (API keys like `sk-...`, `AKIA...`, password-like strings) rather than visual field detection.
- The redaction approach: identify sensitive text positions in the extracted text, map those positions to regions in the screenshot, blur/redact those regions before sending to vision API.
- pHash for screenshot dedup — fast (~1ms per image), tolerant of minor UI changes (cursor, clock), good for detecting same-screen revisits.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 13-ai-powered-capture-processing-text-cleanup-summarization-auto-tagging-screenshot-vision-analysis-and-capture-deduplication-during-sessions*
*Context gathered: 2026-04-01*
