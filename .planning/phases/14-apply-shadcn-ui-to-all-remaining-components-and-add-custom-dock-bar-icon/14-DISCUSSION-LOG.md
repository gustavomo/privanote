# Phase 14: Apply shadcn/ui to All Remaining Components and Add Custom Dock Bar Icon - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-02
**Phase:** 14-apply-shadcn-ui-to-all-remaining-components-and-add-custom-dock-bar-icon
**Areas discussed:** Remaining buttons, Dock icon design, Component coverage, Overlay styling, Scroll areas, Tooltips, Dialogs, Icon library, Additional components, Dark mode colors

---

## Remaining Buttons

| Option | Description | Selected |
|--------|-------------|----------|
| Keep as-is (Recommended) | They already use shadcn CSS variables and match the design. Phase 12 proved ToggleGroup breaks them. | ✓ |
| Wrap in shadcn Button | Use the Button component with custom className overrides. Risk of conflicts. | |
| Create custom components | Extract into dedicated components using shadcn primitives. | |

**User's choice:** Keep as-is
**Notes:** All 3 raw buttons in App.jsx (capture mode, note list, tab switcher) stay as custom-styled elements.

---

## Dock Icon Design

| Option | Description | Selected |
|--------|-------------|----------|
| Rounded square with P lettermark (Recommended) | macOS-style rounded square with bold P centered. Clean, recognizable. | ✓ |
| Shield / lock with P | Privacy-focused shield shape with P inside. | |
| Notepad with pen | Classic note-taking icon with pen motif. | |

**User's choice:** Rounded square with P lettermark

### Dock Icon Color

| Option | Description | Selected |
|--------|-------------|----------|
| Dark/charcoal solid (Recommended) | Matches app's primary color. White P on dark background. Professional. | ✓ |
| Teal gradient | Teal accent from overlay. Adds color to dock. | |
| Blue gradient | Classic tech-app blue. Stands out in dock. | |

**User's choice:** Dark/charcoal solid

---

## Component Coverage

| Option | Description | Selected |
|--------|-------------|----------|
| Migrate card-like containers (Recommended) | Replace styled divs with shadcn Card. | |
| Full migration | Migrate everything: cards, alerts, scroll areas, tooltips. | ✓ |
| Skip structural migration | Keep current styled divs. | |

**User's choice:** Full migration — "i want to use ui shadcn for all elements to keep consistent, and with the style i want, simple elegant"

---

## Overlay Styling

| Option | Description | Selected |
|--------|-------------|----------|
| Keep excluded (Recommended) | Overlay is standalone HTML without React/Tailwind. Major rearchitecture for little gain. | ✓ |
| Align colors only | Keep standalone but update CSS colors to match shadcn variables. | |
| Full migration | Rebuild overlay with React + Tailwind + shadcn. | |

**User's choice:** Keep excluded

---

## Scroll Areas

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, both areas (Recommended) | Note list and editor content get ScrollArea. Themed scrollbars. | ✓ |
| Note list only | Only sidebar gets ScrollArea. | |
| Skip ScrollArea | Keep native scrollbars. | |

**User's choice:** Both areas

---

## Tooltips

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, for icon buttons (Recommended) | Icon-only buttons get tooltips for accessibility. Text+icon buttons don't need them. | ✓ |
| Tooltips everywhere | All action buttons get tooltips. | |
| No tooltips | No tooltips at all. | |

**User's choice:** For icon buttons only

---

## Dialogs

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, for destructive actions (Recommended) | AlertDialog before Remove Media and Delete Note. | ✓ |
| All confirmations | Dialogs for destructive + save/discard actions. | |
| No dialogs | Actions happen immediately. | |

**User's choice:** For destructive actions only

---

## Icon Library

| Option | Description | Selected |
|--------|-------------|----------|
| Text + icon (Recommended) | lucide icons alongside text labels. Most readable and elegant. | ✓ |
| Icon-only for secondary actions | Primary: text+icon, secondary: icon-only with tooltips. | |
| No icons | Keep buttons text-only. | |

**User's choice:** Text + icon

---

## Additional Components

| Option | Description | Selected |
|--------|-------------|----------|
| Skeleton | Loading placeholders with animated shapes. | ✓ |
| Tabs | shadcn Tabs for Workspace/Settings switcher. | ✓ |
| Sonner (Toast) | Toast notifications for success/error feedback. | ✓ |
| Progress | Progress bar for recording/sync status. | ✓ |

**User's choice:** All four

### Tabs Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Both switchers (Recommended) | Tabs for view switcher AND capture mode. | |
| Workspace/Settings only | Only the top-level view switcher. | ✓ |
| You decide | Claude picks best approach. | |

**User's choice:** Workspace/Settings only — capture mode stays as custom buttons

---

## Dark Mode Colors

| Option | Description | Selected |
|--------|-------------|----------|
| VS Code dark (cool blue-gray) | Deep blue-gray backgrounds, muted borders, soft white text. | ✓ |
| GitHub dark | Near-black backgrounds, high contrast. | |
| Keep current warm dark | Current oklch warm stone palette. | |

**User's choice:** VS Code 2026 dark theme — "dark 2026 of vs code"

### Light Mode

| Option | Description | Selected |
|--------|-------------|----------|
| Only change dark mode (Recommended) | Keep current light mode. Only rework .dark CSS variables. | ✓ |
| Update both modes | Rework both light and dark for VS Code look. | |
| You decide | Claude picks. | |

**User's choice:** Only change dark mode

---

## Claude's Discretion

- Exact VS Code 2026 oklch values for dark palette
- Specific lucide-react icons for each button
- Skeleton shapes and timing
- Toast position and duration
- Progress bar styling
- Card border-radius values
- AlertDialog confirmation copy
- Dock icon asset generation method

## Deferred Ideas

None — discussion stayed within phase scope
