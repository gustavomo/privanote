# Phase 12: UI Audit and Fix Pass - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-01
**Phase:** 12-ui-audit-and-fix-pass
**Areas discussed:** shadcn migration scope, specific bug fixes, overlay scope, dark mode, layout/spacing, typography

---

## Todo Folding

| Todo | Area | Score | Folded |
|------|------|-------|--------|
| Fix UI issues | ui | 0.9 | Yes |
| Migrate codebase to TypeScript | tooling | 0.4 | No |
| AI-powered capture processing | ui | 0.3 | No |
| Restructure project organization | general | 0.2 | No |

**User's choice:** Fold "Fix UI issues" into phase scope.

---

## Initial Input (Free Text)

User provided specific feedback instead of selecting predefined gray areas:
1. Want to use shadcn/ui setup with preset `bIkfWsK`
2. Buttons (start recording, save changes) don't have borders
3. App list checkboxes in settings are ugly
4. Radio buttons on the panel have ugly border shadows

---

## shadcn Migration Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full main window | Migrate all controls/components to shadcn | Yes |
| Only broken controls | Only replace buttons, checkboxes, and radio buttons | |
| Controls + settings | Fix broken controls AND restyle settings view | |

**User's choice:** Full main window
**Notes:** Covers sidebar, editor, settings, media cards — everything in the main BrowserWindow.

---

## Overlay Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Keep overlay as-is | The overlay was just polished in Phase 11 | Yes |
| Include overlay | Restyle the overlay to match shadcn | |

**User's choice:** Keep overlay as-is
**Notes:** Phase 11 just polished the overlay — no need to touch it again.

---

## Additional Issues

| Option | Description | Selected |
|--------|-------------|----------|
| That's it | Those are the main issues | Yes |
| More issues | More complaints to add | |

**User's choice:** That's it — the three specific issues plus shadcn migration covers everything.

---

## Dark Mode / Theming

| Option | Description | Selected |
|--------|-------------|----------|
| Dark only | Dark-themed only | |
| Follow system | Respect macOS light/dark preference | |
| User toggle | Add a light/dark toggle in settings | Yes |
| You decide | Claude picks | |

**User's choice:** User toggle
**Notes:** Explicit setting in the app, not just following system preference.

---

## Layout & Spacing

| Option | Description | Selected |
|--------|-------------|----------|
| Just consistency | Keep proportions, unify padding/margins/gaps | Yes |
| Redesign layout | Rethink sidebar width and proportions | |
| You decide | Claude audits and fixes | |

**User's choice:** Just consistency
**Notes:** No layout redesign — just make existing spacing uniform.

---

## Typography

| Option | Description | Selected |
|--------|-------------|----------|
| shadcn defaults | Inter / system font stack | Yes |
| Specific font | User has a font in mind | |
| You decide | Claude picks | |

**User's choice:** shadcn defaults

---

## Claude's Discretion

- Exact shadcn components for each UI element
- CSS variable values for the theme preset
- Dark/light toggle placement in settings
- Specific padding/margin values
- Dark mode implementation strategy (class vs media query)

## Deferred Ideas

None — discussion stayed within phase scope.
