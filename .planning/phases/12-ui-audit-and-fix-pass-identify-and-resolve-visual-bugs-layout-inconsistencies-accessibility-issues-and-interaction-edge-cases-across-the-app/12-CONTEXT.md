# Phase 12: UI Audit and Fix Pass - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Full UI audit and fix pass across the main window (sidebar, editor, settings, media cards). Migrate all form controls and components to shadcn/ui with preset `bIkfWsK`, fix specific visual bugs (borderless buttons, ugly checkboxes, ugly radio buttons), unify spacing/padding, add a dark/light mode toggle, and adopt shadcn default typography.

This phase does NOT include:
- Changes to the floating capture overlay (polished in Phase 11 — stays as-is)
- New features or capabilities
- Changes to capture logic, session handling, or note creation
- Layout redesign (proportions stay the same, just consistency fixes)

</domain>

<decisions>
## Implementation Decisions

### shadcn/ui Migration
- **D-01:** Initialize shadcn/ui with preset `bIkfWsK` and migrate all main window components to use shadcn primitives (Button, Checkbox, RadioGroup, Card, Input, etc.).
- **D-02:** Scope covers the full main window: sidebar, editor area, settings view, media cards, capture panel, and all form controls.
- **D-03:** The floating overlay (capture-overlay.html) is excluded — keep its Phase 11 custom styling untouched.
- **D-04:** Tailwind CSS and shadcn are already installed (`tailwindcss@3.4.19`, `shadcn@4.1.1`, `radix-ui@1.4.3`, `tailwind-merge@3.5.0`). `components.json` and `tailwind.config.js` exist. No shadcn UI components have been added yet.

### Specific Bug Fixes
- **D-05:** Buttons (start recording, save changes, etc.) need visible borders — currently borderless and look unfinished.
- **D-06:** App list checkboxes in settings (Capture Apps section) are ugly — replace with shadcn Checkbox.
- **D-07:** Radio buttons in the settings panel have ugly border shadows — replace with shadcn RadioGroup.

### Dark Mode / Theming
- **D-08:** Add a dark/light mode toggle in settings. Both themes should work. Use shadcn's CSS variable theming approach.

### Layout & Spacing
- **D-09:** Keep current sidebar width and content area proportions. Unify padding, margins, and gaps across all views for consistency.

### Typography
- **D-10:** Use shadcn default font stack (Inter / system fonts). No custom font required.

### Claude's Discretion
- Exact shadcn components to use for each UI element
- CSS variable values for the theme preset
- Where to place the dark/light toggle in settings
- Specific padding/margin values for consistency pass
- Whether to use shadcn's built-in dark mode class strategy or CSS media query

### Folded Todos
- **Fix UI issues** (from pending todos) — The generic "do a full UI review pass" todo is now the core of this phase. The specific issues identified (borderless buttons, ugly checkboxes, ugly radio buttons) plus the shadcn migration address this comprehensively.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Main Window UI
- `apps/desktop/src/renderer/App.jsx` — Main application component (1577 lines), sidebar, editor, all UI state
- `apps/desktop/src/renderer/index.css` — Global styles (63 lines)
- `apps/desktop/src/renderer/main.jsx` — React DOM entry point
- `apps/desktop/src/renderer/index.html` — HTML shell

### Components
- `apps/desktop/src/renderer/components/settings-view.jsx` — Settings panel with checkboxes, radio buttons, form controls (347 lines)
- `apps/desktop/src/renderer/components/media-card.jsx` — Media display cards (198 lines)
- `apps/desktop/src/renderer/components/transcript-section.jsx` — Transcript display (93 lines)

### Configuration
- `apps/desktop/components.json` — shadcn/ui configuration
- `apps/desktop/tailwind.config.js` — Tailwind CSS configuration
- `apps/desktop/package.json` — Dependencies (shadcn@4.1.1, tailwindcss@3.4.19, radix-ui@1.4.3)

### Overlay (DO NOT MODIFY)
- `apps/desktop/src/renderer/capture-overlay/capture-overlay.html` — Excluded from this phase

### Prior Phase Context
- `.planning/phases/11-ui-polish-button-icon-states-active-colors-and-persistent-custom-menu-bar-icon/11-CONTEXT.md` — Phase 11 overlay polish decisions (teal active color, icon pairs, template tray icon)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Tailwind CSS already configured with `tailwind.config.js`
- shadcn CLI installed (`shadcn@4.1.1`) — can run `npx shadcn add` to scaffold components
- `components.json` already initialized — shadcn knows where to put components
- `tailwind-merge` available for className composition
- `apps/desktop/src/renderer/lib/utils.js` — likely contains `cn()` helper for Tailwind class merging

### Established Patterns
- React JSX with inline styles and CSS classes in App.jsx
- `index.css` for global styles (minimal — 63 lines)
- No existing component library — all controls are hand-rolled HTML elements
- oklch color space used in the overlay (Phase 11) — main window uses different approach

### Integration Points
- `App.jsx` is the monolithic component — all UI renders here or in 3 child components
- `settings-view.jsx` contains the checkbox and radio button controls that need fixing
- `media-card.jsx` and `transcript-section.jsx` are the only extracted components
- Vite handles the build — shadcn components will be bundled automatically

</code_context>

<specifics>
## Specific Ideas

- shadcn/ui preset `bIkfWsK` — user specifically wants this visual style/theme
- Buttons need visible borders — the borderless look feels unfinished
- App list checkboxes are explicitly called out as ugly
- Radio button border shadows are explicitly called out as ugly
- Dark/light toggle requested as a user-facing setting, not just system preference following

</specifics>

<deferred>
## Deferred Ideas

### Reviewed Todos (not folded)
- **Migrate codebase to TypeScript** (tooling, score: 0.4) — Related but separate concern; TypeScript migration is its own phase
- **AI-powered capture processing and deduplication** (ui, score: 0.3) — New capability, not UI polish
- **Restructure project organization** (general, score: 0.2) — Structural, not visual

</deferred>

---

*Phase: 12-ui-audit-and-fix-pass*
*Context gathered: 2026-04-01*
