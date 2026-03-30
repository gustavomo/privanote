# Phase 5: Make Record or Import Always Accessible as a Persistent Entry Point - Research

**Researched:** 2026-03-30
**Domain:** React UI restructuring — sidebar layout, state cleanup, capture-first UX
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** The creation flow is capture-first. A note is a result of a recording or import, not a prerequisite. Users do not create a note before capturing — they capture, and the note is created automatically.
- **D-02:** Remove the "Create Note" form (title + description + tags input fields + "Create Note" button) from the sidebar entirely. Notes are only created as a by-product of a recording or import.
- **D-03:** The capture panel becomes the top section of the workspace sidebar, above the notes list. It is always visible in workspace view without requiring a selected note.
- **D-04:** The layout remains the same two-column grid (sidebar + note detail panel). The sidebar changes its content: capture panel at top, notes list below. The right panel still shows note detail when a note is selected.
- **D-05:** After a recording is saved or a file is imported, Privanote auto-creates a note with a generated title (e.g. "Audio note — 3:45 PM"), saves the media, and immediately navigates to the created note's detail view.
- **D-06:** No title prompt before saving. The auto-title is applied immediately; the user can rename from the note detail view after the note is created.
- **D-07:** Remove the inline capture panel that currently appears inside the note detail view. Capture now only happens from the persistent top-of-sidebar entry point. Once a note exists with its media attached, no secondary capture surface is needed inside the note.
- **D-08:** The note detail view retains the full editable title, description, and tags fields. After capture creates a note automatically, the user can rename it and add description/tags from the detail view.

### Claude's Discretion

- Exact height, padding, and styling of the capture panel in the sidebar position.
- Whether the mode selector (Audio / Video / Video + Audio) appears inline in the sidebar panel or in an expanded area.
- Whether to show the notes list label/count before or after the capture panel.
- Exact auto-title format (pattern, timestamp style) — the current `createPlaceholderTitle` function can be reused or adjusted.
- Tags field retention in note detail (can keep or remove at Claude's discretion based on what fits the capture-first UX).

### Deferred Ideas (OUT OF SCOPE)

- Adding multiple media items to an existing note (user indicated this is not the use case they're optimizing for in this phase).
- "Fix UI issues" todo (area: ui, score 0.3) — Too generic for this phase; requires a separate audit pass.
</user_constraints>

---

## Summary

Phase 5 is a UI restructuring of `App.jsx` — it does not add new backend contracts, new API routes, or new components. The work is entirely contained within the layout and state management of the existing workspace view.

The current code has two render sites for `renderCapturePanel()`: one inside the note detail view at line 1221 (rendered when `selectedNode` is truthy), and one in the right-panel empty state at line 1265 (rendered when `selectedNode` is null). Phase 5 consolidates these two render sites into one: a permanent position at the top of the `<aside>` sidebar. The "Create Note" form at lines 1090–1117 is removed entirely, along with the three associated state variables (`newNodeTitle`, `newNodeDescription`, `newNodeTags`) and the `handleCreateNode` handler.

The `ensureCaptureNode()` function already handles auto-creating a note when none is selected. Post-capture navigation (`setSelectedNodeId(result.node.id)`) already exists in `handleSaveRecording` and `handleImportFiles`. Both handlers work correctly with the new layout without any logic changes.

The most important downstream consequence is that the existing tests in `app.note-flow.test.jsx` directly assert on the "Create Note" button and the form's input fields. Those assertions will break and must be updated as part of this phase. The tests are not removed — they become Phase 5's regression coverage for the new capture-first flow.

**Primary recommendation:** Treat this as a single-file layout refactor of `App.jsx` plus targeted test updates in `app.note-flow.test.jsx`. No new files are needed. No backend changes are needed.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | Already installed | Component rendering, `useState`, `useEffect` | Project stack |
| Tailwind CSS | Already installed | Utility class styling | Project stack — all existing UI uses utility classes |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@testing-library/react` | Already installed | Render + query in tests | Existing test pattern for all desktop tests |
| `vitest` | Already installed | Test runner | `npm test --workspace @privanote/desktop` |

**No new packages are needed for this phase.**

---

## Architecture Patterns

### Current Sidebar Structure (to be changed)
```
<aside>
  heading ("Notes") + note count
  <form> Create Note (title + description + tags + submit button) </form>  ← REMOVE
  notes list (empty state or <ul>)
</aside>
```

### Target Sidebar Structure (Phase 5)
```
<aside>
  {renderCapturePanel()}      ← MOVE HERE from right panel
  notes list label/count      ← Keep, reposition after capture panel
  notes list (empty state or <ul>)
</aside>
```

### Current Right Panel Structure (to be changed)
```
<section>
  {selectedNode ? (
    <div>
      note header + delete button
      edit form (title, description, tags, Save Changes)
      {renderCapturePanel()}      ← REMOVE from here (D-07)
      <TranscriptSection />
      Saved Media section
    </div>
  ) : (
    <div>{renderCapturePanel()}</div>   ← REMOVE from here (consolidated to sidebar)
  )}
</section>
```

### Target Right Panel Structure (Phase 5)
```
<section>
  {selectedNode ? (
    <div>
      note header + delete button
      edit form (title, description, tags, Save Changes)   ← Keep (D-08)
      <TranscriptSection />
      Saved Media section
    </div>
  ) : (
    empty state placeholder (no capture panel — it is in the sidebar)
  )}
</section>
```

### Pattern: Sidebar Capture Panel Sizing
The sidebar is constrained to `minmax(320px, 380px)` by the grid. The existing `renderCapturePanel()` uses `rounded-[28px] bg-secondary/70 p-6` which is appropriate for sidebar placement. However, the sidebar capture panel will coexist with the notes list — consider using a more compact heading (e.g., remove the descriptive paragraph, shorten the title) when the panel is in the sidebar vs. the center-screen empty state.

The `renderCapturePanel()` function currently has conditional heading text: `selectedNode ? 'Capture and review' : 'Capture Your First Note'`. After Phase 5, since the panel is always in the sidebar, the `selectedNode` conditional in the heading text is no longer meaningful. The heading should be simplified to a single, always-visible label like "Capture" or "New Recording."

### Pattern: State Variable Cleanup
Remove from `App.jsx`:
- `const [newNodeTitle, setNewNodeTitle] = useState('');`
- `const [newNodeDescription, setNewNodeDescription] = useState('');`
- `const [newNodeTags, setNewNodeTags] = useState('');`
- `handleCreateNode` function (lines 603–622)

These are entirely owned by the Create Note form and have no other uses.

### Pattern: Existing Auto-Navigate on Capture
Both save handlers already navigate to the created note after capture:

```javascript
// handleSaveRecording (line 829–831)
await loadNodes();
setSelectedNodeId(result.node.id);
await loadAttachments(result.node.id);

// handleImportFiles (line 692–694)
await loadNodes();
setSelectedNodeId(result.node.id);
await loadAttachments(result.node.id);
```

This satisfies D-05 with zero changes. No new logic needed.

### Pattern: ensureCaptureNode Already Works
`ensureCaptureNode()` (lines 444–468) already handles the case where no note is selected: it creates a new note with `createPlaceholderTitle()`, adds it to `nodes`, and sets `selectedNodeId`. This behavior is unchanged and satisfies D-01 and D-05.

### Anti-Patterns to Avoid
- **Don't add a new "capture only" view or route.** Phase 5 explicitly uses the existing `workspace` view and the existing two-column layout (D-04).
- **Don't change the `ensureCaptureNode` / `handleSaveRecording` / `handleImportFiles` logic.** These handlers already produce the correct capture-first behavior. Only the render position changes.
- **Don't leave dead state variables.** `newNodeTitle`, `newNodeDescription`, `newNodeTags` must be removed — leaving them adds confusion and misleads future readers of the code.
- **Don't remove the empty-state placeholder in the right panel.** When no note is selected, the right panel will show nothing meaningful. Add a brief empty state (e.g., "Select a note or capture a new one") rather than an empty `<section>`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auto-creating note on capture | A new creation flow | Existing `ensureCaptureNode()` | Already handles no-note-selected case correctly |
| Auto-navigating after save | New navigation logic | Existing `setSelectedNodeId(result.node.id)` pattern | Already present in both save handlers |
| Auto-title generation | New title format logic | Existing `createPlaceholderTitle()` + `createImportPlaceholderTitle()` | Both functions exist and generate timestamped titles |
| Compact sidebar capture panel | A new "SidebarCapturePanel" component | Modified `renderCapturePanel()` in-place | The phase has one capture location; a separate component adds indirection without benefit |

---

## Common Pitfalls

### Pitfall 1: Breaking Existing Tests Without Updating Them
**What goes wrong:** `app.note-flow.test.jsx` explicitly asserts `screen.getByRole('button', { name: 'Create Note' })` (line 76) and simulates form input to `'New note title'`, `'Description'`, and `'Tags'` placeholders (lines 85–93). After the form is removed, these assertions and interactions will fail.
**Why it happens:** The tests were written to verify the current form-based creation flow, which is being replaced.
**How to avoid:** Update these specific assertions to instead verify the capture-first entry points: the persistent sidebar capture panel is present, the "Start Recording" button is accessible without first navigating to a note, and saving a recording navigates to the created note.
**Warning signs:** Vitest output showing "Unable to find an element with the role 'button' and name 'Create Note'" or "Unable to find an element with the placeholder 'New note title'".

### Pitfall 2: Sidebar Overflow When Notes List Is Long
**What goes wrong:** The sidebar currently has the form at the top and the notes list below. After adding the capture panel at the top, if there are many notes, the sidebar may scroll awkwardly or clip the capture panel.
**Why it happens:** The capture panel is taller than the form it replaced (it includes mode toggles and action buttons). The sidebar `<aside>` is not currently configured with a max-height or overflow scroll.
**How to avoid:** Ensure the sidebar uses `overflow-y-auto` on the notes list portion or the entire `<aside>`, not the capture panel. The capture panel should be sticky/always-visible; only the notes list should scroll.
**Warning signs:** Capture panel clips off screen when many notes exist.

### Pitfall 3: Capture Panel Heading Still References `selectedNode`
**What goes wrong:** `renderCapturePanel()` currently checks `selectedNode` to choose between two headings: `'Capture and review'` vs. `'Capture Your First Note'`. After Phase 5, the panel is always in the sidebar — `selectedNode` state is still available but is no longer the right signal for panel heading text.
**Why it happens:** The heading was written for two contexts (empty state centered in right panel vs. inside note detail). The sidebar is a third context with different meaning.
**How to avoid:** Replace the conditional heading with a single static label appropriate for a persistent sidebar action, such as "Capture" or "New Capture".
**Warning signs:** The panel heading says "Capture Your First Note" even after notes exist, because `selectedNode` is null when no note is highlighted.

### Pitfall 4: Right Panel Has No Empty State After Removal
**What goes wrong:** Removing the capture panel from the `selectedNode === null` branch of the right panel leaves the right panel completely empty when no note is selected. This can look broken.
**Why it happens:** The capture panel was the only content in that branch.
**How to avoid:** Replace the removed capture panel in the right panel empty state with a minimal placeholder (e.g., "Select a note from the sidebar to view and edit it."). This is not a new design surface — it is a fallback for the empty state.
**Warning signs:** The right panel renders a blank white card with no content.

---

## Code Examples

### Current Sidebar Render (to be refactored)
```jsx
// App.jsx lines 1080–1162 (current)
<aside className="rounded-[28px] border bg-secondary/70 p-6 shadow-sm">
  <div className="mb-6 flex items-center justify-between gap-4">
    <div>
      <h2 className="text-xl font-semibold leading-[1.2]">Notes</h2>
      <p ...>{nodes.length} note{...} available</p>
    </div>
  </div>

  <form className="mb-6 grid gap-3" onSubmit={handleCreateNode}>
    {/* ... inputs + Create Note button ... */}
  </form>

  {/* notes list ... */}
</aside>
```

### Target Sidebar Render (Phase 5)
```jsx
// Phase 5 target
<aside className="rounded-[28px] border bg-secondary/70 p-6 shadow-sm">
  {renderCapturePanel()}

  <div className="mb-4 mt-6">
    <h2 className="text-xl font-semibold leading-[1.2]">Notes</h2>
    <p className="text-sm leading-5 text-muted-foreground">
      {nodes.length} note{nodes.length === 1 ? '' : 's'} available
    </p>
  </div>

  {/* notes list (unchanged) */}
</aside>
```

### Existing Auto-Navigate After Save (no changes needed)
```javascript
// handleSaveRecording — lines 829–831 of App.jsx (unchanged)
await loadNodes();
setSelectedNodeId(result.node.id);
await loadAttachments(result.node.id);

// handleImportFiles — lines 692–694 of App.jsx (unchanged)
await loadNodes();
setSelectedNodeId(result.node.id);
await loadAttachments(result.node.id);
```

### ensureCaptureNode — No Changes Needed
```javascript
// App.jsx lines 444–468 — already handles auto-creation when no note selected
async function ensureCaptureNode(mode) {
  if (selectedNode) {
    return { node: selectedNode, placeholderNoteId: null, ... };
  }
  // Auto-creates note with placeholder title when nothing is selected
  const placeholderTitle = createPlaceholderTitle(mode);
  const node = await client.createNode({ title: placeholderTitle, ... });
  setNodes((current) => [node, ...current.filter(...)]);
  setSelectedNodeId(node.id);
  return { node, placeholderNoteId: node.id, ... };
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Note-first: user creates a note then attaches media | Capture-first: capture creates the note automatically | Phase 5 | Removes the Create Note form; sidebar becomes the capture entry point |
| Capture panel in note detail + empty state of right panel | Capture panel only in sidebar, always visible | Phase 5 | Single render site, no conditional logic based on `selectedNode` for panel visibility |

---

## Open Questions

1. **Sidebar overflow behavior with long notes list**
   - What we know: The sidebar has no explicit height or overflow constraint today.
   - What's unclear: Whether the notes list should scroll independently of the capture panel, or whether the entire sidebar scrolls.
   - Recommendation: Make the notes list portion independently scrollable (`overflow-y-auto` on the list container) so the capture panel stays pinned at the top. The simplest implementation is to give the `<aside>` a `flex flex-col` layout and let the list section have `flex-1 overflow-y-auto`.

2. **Capture panel heading text in sidebar context**
   - What we know: `renderCapturePanel()` has conditional heading logic tied to `selectedNode`.
   - What's unclear: The exact preferred wording for the always-visible sidebar panel label (left to Claude's discretion per CONTEXT.md).
   - Recommendation: Use "Capture" as the heading and "Start a recording or import a file — a note is created automatically." as the subline. This is concise and accurately describes the capture-first flow.

3. **Tags field in note detail (Claude's discretion)**
   - What we know: CONTEXT.md explicitly marks retention of the tags field as Claude's discretion.
   - What's unclear: Whether removing tags now (since the Create Note form already had tags) simplifies the UX or breaks power users.
   - Recommendation: Keep the tags field in note detail. The Create Note form removal makes note creation implicit; tags remain useful for post-capture annotation alongside the already-kept title and description fields.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 5 is a pure frontend UI refactor of `App.jsx`. No new external tools, services, CLIs, runtimes, or databases are required. All dependencies (React, Tailwind, Vitest, @testing-library/react) are already installed in the monorepo.

---

## Runtime State Inventory

Step 2.5: SKIPPED — Phase 5 is a UI restructuring of the workspace, not a rename, rebrand, or migration. No stored data keys, service configurations, OS-registered state, secrets, or build artifacts embed a string that this phase renames or replaces.

---

## Sources

### Primary (HIGH confidence)
- Direct code audit: `apps/desktop/src/renderer/App.jsx` (full file read, 1344 lines)
- Direct test audit: `apps/desktop/test/app.note-flow.test.jsx` (full file read)
- Direct test audit: `apps/desktop/test/capture-review.test.jsx` (full file read, header)
- `05-CONTEXT.md` — locked decisions D-01 through D-08, code context section

### Secondary (MEDIUM confidence)
- `02-CONTEXT.md` — original capture flow decisions still active (D-01 through D-05 from Phase 2 confirmed compatible)
- `REQUIREMENTS.md` — CAP-01 through CAP-05 all complete; Phase 5 improves UX around these, not functional capability

### Tertiary (LOW confidence)
- None — all findings are grounded in direct source code inspection.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; direct inspection of installed packages
- Architecture: HIGH — direct inspection of App.jsx identifies exact render sites, state variables, and handlers
- Pitfalls: HIGH — identified from existing test assertions that will break + layout constraints visible in code
- Test impact: HIGH — specific test file and line numbers identified from direct read

**Research date:** 2026-03-30
**Valid until:** Stable — this research is based on the current source file. Valid until App.jsx is refactored.
