# Phase 12: UI Audit and Fix Pass - Research

**Researched:** 2026-04-01
**Domain:** shadcn/ui component migration, dark mode theming, Tailwind CSS, accessibility
**Confidence:** HIGH

## Summary

Phase 12 migrates the Privanote main window from hand-rolled HTML form controls to shadcn/ui components, fixes specific visual bugs (borderless buttons, ugly checkboxes, ugly radio buttons), adds dark/light mode theming, and unifies spacing. The codebase is well-prepared: `shadcn@4.1.1` CLI is installed and configured with `components.json` (preset `bIkfWsK`, `tsx: false`, `radix-nova` style, `taupe` base color). The `@` path alias is set up in Vite. CSS variables for light mode are already in `index.css`. No shadcn UI components have been added yet -- the `components/ui/` directory does not exist.

The migration is straightforward because: (1) the CLI generates proper `.jsx` files when `tsx: false`, (2) all 10 required components resolve cleanly via `npx shadcn add`, (3) the existing hand-rolled controls already follow a consistent pattern (inline-flex h-11 items-center rounded-xl) that maps naturally to shadcn variants, and (4) the light mode CSS variables from the preset are already applied.

**Primary recommendation:** Scaffold all 10 shadcn components in one batch via `npx shadcn add`, then customize the Button component with project-specific size variants (h-10 and h-11) before migrating files. Add the `.dark` CSS variables block and a theme toggle. Migrate files in order: settings-view.jsx first (highest bug density), then media-card.jsx and transcript-section.jsx, then App.jsx.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Initialize shadcn/ui with preset `bIkfWsK` and migrate all main window components to use shadcn primitives (Button, Checkbox, RadioGroup, Card, Input, etc.).
- **D-02:** Scope covers the full main window: sidebar, editor area, settings view, media cards, capture panel, and all form controls.
- **D-03:** The floating overlay (capture-overlay.html) is excluded -- keep its Phase 11 custom styling untouched.
- **D-04:** Tailwind CSS and shadcn are already installed (`tailwindcss@3.4.19`, `shadcn@4.1.1`, `radix-ui@1.4.3`, `tailwind-merge@3.5.0`). `components.json` and `tailwind.config.js` exist. No shadcn UI components have been added yet.
- **D-05:** Buttons (start recording, save changes, etc.) need visible borders -- currently borderless and look unfinished.
- **D-06:** App list checkboxes in settings (Capture Apps section) are ugly -- replace with shadcn Checkbox.
- **D-07:** Radio buttons in the settings panel have ugly border shadows -- replace with shadcn RadioGroup.
- **D-08:** Add a dark/light mode toggle in settings. Both themes should work. Use shadcn's CSS variable theming approach.
- **D-09:** Keep current sidebar width and content area proportions. Unify padding, margins, and gaps across all views for consistency.
- **D-10:** Use shadcn default font stack (Inter / system fonts). No custom font required.

### Claude's Discretion
- Exact shadcn components to use for each UI element
- CSS variable values for the theme preset
- Where to place the dark/light toggle in settings
- Specific padding/margin values for consistency pass
- Whether to use shadcn's built-in dark mode class strategy or CSS media query

### Deferred Ideas (OUT OF SCOPE)
- **Migrate codebase to TypeScript** (tooling, score: 0.4) -- Related but separate concern
- **AI-powered capture processing and deduplication** (ui, score: 0.3) -- New capability, not UI polish
- **Restructure project organization** (general, score: 0.2) -- Structural, not visual
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| shadcn | 4.1.1 | CLI to scaffold UI components | Already installed; generates JSX when `tsx: false` |
| radix-ui | 1.4.3 | Accessible component primitives | shadcn's default primitive layer |
| tailwindcss | 3.4.19 | Utility-first CSS framework | Already configured with PostCSS |
| class-variance-authority | 0.7.1 | Variant management for components | shadcn components use CVA for variant/size props |
| lucide-react | 1.7.0 | Icon library | shadcn default icon library; used by Checkbox indicator |
| tailwind-merge | 3.5.0 | Smart Tailwind class deduplication | Powers the `cn()` utility |
| clsx | 2.1.1 | Conditional class composition | Powers the `cn()` utility |
| tw-animate-css | 1.4.0 | Tailwind animation presets | Already imported in index.css |
| @fontsource-variable/inter | 5.2.8 | Inter variable font | Already imported and configured |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none needed) | -- | -- | All dependencies already installed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| shadcn toggle-group | Custom button group | toggle-group is heavier but provides proper Radix a11y (roving focus, aria-pressed). Use it. |
| localStorage for theme | Electron store | localStorage is simpler, works in renderer, sufficient for a UI preference. No IPC needed. |

**Installation:**
```bash
# All dependencies already installed. Only need to scaffold components:
cd apps/desktop
npx shadcn add button input textarea checkbox radio-group card badge label separator toggle-group
```

This single command creates 11 files (toggle depends on toggle-group) under `src/renderer/components/ui/`.

## Architecture Patterns

### Recommended Project Structure
```
src/renderer/
  components/
    ui/                       # shadcn-generated (DO NOT hand-edit unless adding variants)
      badge.jsx
      button.jsx
      card.jsx
      checkbox.jsx
      input.jsx
      label.jsx
      radio-group.jsx
      separator.jsx
      textarea.jsx
      toggle.jsx
      toggle-group.jsx
    media-card.jsx            # EXISTING -- migrate to use shadcn primitives
    settings-view.jsx         # EXISTING -- migrate to use shadcn primitives
    transcript-section.jsx    # EXISTING -- migrate to use shadcn primitives
    theme-toggle.jsx          # NEW -- dark/light/system toggle for settings
  lib/
    utils.js                  # EXISTING -- cn() already here
  App.jsx                     # EXISTING -- migrate to use shadcn primitives
  index.css                   # EXISTING -- add .dark block
  index.html                  # EXISTING -- no changes needed
  main.jsx                    # EXISTING -- add theme initialization script
```

### Pattern 1: shadcn Component Usage (Button Migration)
**What:** Replace hand-rolled `<button>` elements with shadcn `<Button>` component
**When to use:** Every `<button>` in the main window
**Example:**
```jsx
// BEFORE (hand-rolled, no visible border):
<button
  type="button"
  onClick={handleSaveSettings}
  disabled={isLoading || isSaving}
  className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
>
  Save Settings
</button>

// AFTER (shadcn Button with project variant):
import { Button } from '@/components/ui/button';

<Button
  type="button"
  onClick={handleSaveSettings}
  disabled={isLoading || isSaving}
  size="lg"
>
  Save Settings
</Button>
```

### Pattern 2: Checkbox Migration (settings-view.jsx)
**What:** Replace native `<input type="checkbox">` with Radix Checkbox
**When to use:** Capture Apps section in settings
**Example:**
```jsx
// BEFORE (ugly native checkbox):
<input
  type="checkbox"
  checked={Boolean(captureApps[app.id])}
  onChange={() => onToggleCaptureApp(app.id)}
  disabled={isLoading || isSaving}
  className="h-5 w-5 accent-primary"
/>

// AFTER (shadcn Checkbox):
import { Checkbox } from '@/components/ui/checkbox';

<Checkbox
  checked={Boolean(captureApps[app.id])}
  onCheckedChange={() => onToggleCaptureApp(app.id)}
  disabled={isLoading || isSaving}
/>
```
**Note:** Radix Checkbox uses `onCheckedChange` instead of `onChange`, and its `checked` prop accepts `boolean | 'indeterminate'`.

### Pattern 3: RadioGroup Migration (settings-view.jsx)
**What:** Replace native `<input type="radio">` inside `<fieldset>` with Radix RadioGroup
**When to use:** Storage destination and transcription mode selectors
**Example:**
```jsx
// BEFORE (ugly native radio with border shadows):
<fieldset className="grid gap-3">
  <legend className="text-sm font-semibold">Default destination</legend>
  {storageOptions.map((option) => (
    <label key={option.value} className="flex items-center gap-3 rounded-2xl border bg-background px-4 py-3">
      <input
        type="radio"
        name="storage-destination"
        value={option.value}
        checked={settings.storageDestination === option.value}
        onChange={() => onChange({ storageDestination: option.value })}
        disabled={isLoading || isSaving}
      />
      <span className="text-sm font-semibold">{option.label}</span>
    </label>
  ))}
</fieldset>

// AFTER (shadcn RadioGroup):
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

<div className="grid gap-3">
  <Label className="text-sm font-semibold">Default destination</Label>
  <RadioGroup
    value={settings.storageDestination}
    onValueChange={(value) => onChange({ storageDestination: value })}
    disabled={isLoading || isSaving}
  >
    {storageOptions.map((option) => (
      <label key={option.value} className="flex items-center gap-3 rounded-2xl border bg-background px-4 py-3">
        <RadioGroupItem value={option.value} />
        <span className="text-sm font-semibold">{option.label}</span>
      </label>
    ))}
  </RadioGroup>
</div>
```
**Note:** Radix RadioGroup uses `value`/`onValueChange` instead of individual `checked`/`onChange` per item. The `name` prop is optional (Radix handles grouping). The `<fieldset>`/`<legend>` can be replaced with `<div>`/`<Label>`.

### Pattern 4: Dark Mode Toggle
**What:** Class-based dark mode with localStorage persistence
**When to use:** Settings view, Appearance section
**Example:**
```jsx
// theme-toggle.jsx
import React, { useEffect, useState } from 'react';

const THEME_KEY = 'privanote-theme';

function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(preference) {
  const resolved = preference === 'system' ? getSystemTheme() : preference;
  document.documentElement.classList.toggle('dark', resolved === 'dark');
}

export function useTheme() {
  const [preference, setPreference] = useState(() => {
    return localStorage.getItem(THEME_KEY) || 'system';
  });

  useEffect(() => {
    applyTheme(preference);
    localStorage.setItem(THEME_KEY, preference);
  }, [preference]);

  // Listen for system theme changes when preference is 'system'
  useEffect(() => {
    if (preference !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [preference]);

  return { preference, setPreference };
}
```

### Pattern 5: Badge Migration
**What:** Replace inline `<span>` pills with shadcn Badge
**When to use:** Connected/disconnected status, sync status, local only badges
**Example:**
```jsx
// BEFORE:
<span className="inline-flex items-center rounded-full bg-primary px-3 py-1 text-sm font-semibold text-primary-foreground">
  Connected
</span>

// AFTER:
import { Badge } from '@/components/ui/badge';

<Badge variant="default">Connected</Badge>
```

### Anti-Patterns to Avoid
- **Mixing hand-rolled and shadcn buttons:** After migration, ALL buttons in the main window must use the shadcn Button component. Do not leave some as raw `<button>` elements.
- **Editing shadcn-generated files for one-off styling:** Use `className` prop overrides or add new CVA variants instead of inlining styles into the generated component.
- **Using `onChange` with Radix primitives:** Radix components use `onCheckedChange`, `onValueChange`, etc. -- NOT standard DOM event handlers.
- **Forgetting to remove "use client" from generated files:** The toggle-group.jsx includes `"use client"` which is a Next.js directive. It is harmless in Vite but should be removed for code hygiene.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Accessible checkbox | `<input type="checkbox">` with CSS hacks | shadcn Checkbox (Radix primitive) | Keyboard navigation, focus management, aria-checked, indeterminate state |
| Accessible radio group | `<input type="radio">` with name grouping | shadcn RadioGroup (Radix primitive) | Roving tabindex, arrow key navigation, form integration |
| Button variants | className string with conditional classes | shadcn Button with CVA variants | Type-safe variants, consistent hover/focus/disabled states |
| Dark mode toggling | Manual DOM class manipulation scattered across components | Centralized useTheme hook + localStorage | System preference detection, persistence, single source of truth |
| Class merging | Template literal concatenation | `cn()` from `@/lib/utils` (already exists) | Handles Tailwind class conflicts correctly |

**Key insight:** The current codebase already uses Tailwind classes that closely match shadcn's CSS variable approach. The migration is mostly about replacing raw HTML elements with shadcn components that provide consistent styling AND built-in accessibility. The visual fix for buttons (borderless look) is solved automatically by shadcn's `outline` variant which includes `border-border`.

## Common Pitfalls

### Pitfall 1: shadcn Button Default Size Mismatch
**What goes wrong:** shadcn v4 button defaults to `h-8` (32px), with `lg` at `h-9` (36px). The UI-SPEC requires `h-11` (44px) for form-level buttons and `h-10` (40px) for card-level buttons.
**Why it happens:** shadcn's default sizing is more compact than what this project uses.
**How to avoid:** After scaffolding, immediately customize `button.jsx` to add project-specific size variants:
```jsx
// Add to buttonVariants sizes:
size: {
  default: "h-10 gap-2 px-4",    // 40px, card-level
  sm: "h-8 gap-1.5 px-2.5",      // 32px, shadcn default
  lg: "h-11 gap-2 px-4",         // 44px, form-level
  icon: "size-10",
}
```
**Warning signs:** Buttons look noticeably smaller after migration.

### Pitfall 2: Radix Checkbox Event Handler API Difference
**What goes wrong:** Using `onChange` instead of `onCheckedChange` causes the handler to never fire.
**Why it happens:** Radix primitives do not use native DOM events; they use custom callback props.
**How to avoid:** Replace every `onChange` on checkboxes with `onCheckedChange` and every radio `onChange` with the parent RadioGroup's `onValueChange`.
**Warning signs:** Toggling checkboxes or radios does nothing visually.

### Pitfall 3: tailwind.config.js Missing darkMode Setting
**What goes wrong:** Adding `.dark` class to `<html>` has no effect because Tailwind v3 defaults to `media` strategy, not `class`.
**Why it happens:** The current `tailwind.config.js` has no `darkMode` key at all.
**How to avoid:** Add `darkMode: 'class'` to `tailwind.config.js` BEFORE any dark mode CSS variables are tested.
**Warning signs:** Dark mode CSS variables are defined but dark: variants in Tailwind classes have no effect.

### Pitfall 4: Theme Initialization Flash (FOIT/FOUC)
**What goes wrong:** Page loads with light theme, then flashes to dark when React hydrates and reads localStorage.
**Why it happens:** Theme preference is applied asynchronously after React mounts.
**How to avoid:** Add a synchronous `<script>` in `index.html` (before React bundle) that reads localStorage and applies the `.dark` class immediately:
```html
<script>
  (function() {
    var t = localStorage.getItem('privanote-theme') || 'system';
    var d = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (d) document.documentElement.classList.add('dark');
  })();
</script>
```
**Warning signs:** Brief white flash when loading in dark mode.

### Pitfall 5: Capture Overlay Contamination
**What goes wrong:** Tailwind's `content` glob in `tailwind.config.js` picks up `capture-overlay.html` and dark mode classes get applied to the overlay.
**Why it happens:** The current content path `./src/renderer/**/*.{js,jsx,ts,tsx,html}` includes `capture-overlay.html`.
**How to avoid:** Verify that `capture-overlay.html` does not use Tailwind classes (it uses custom inline CSS from Phase 11). Even if the glob matches it, Tailwind only generates classes that are used in the file. Since the overlay uses oklch inline styles, there is no actual contamination risk. However, the `.dark` class applied to `<html>` in the main window does NOT affect the overlay because it runs in a separate `BrowserWindow` with its own HTML document.
**Warning signs:** Overlay appearance changes after dark mode is toggled (should NOT happen since it is a separate window).

### Pitfall 6: Badge Size Differences
**What goes wrong:** shadcn Badge defaults to `h-5` (20px) with `text-xs` (12px). The existing inline badges use `text-sm` (14px) with `px-3 py-1`.
**Why it happens:** shadcn Badge is designed to be compact.
**How to avoid:** Override Badge className with `text-sm px-3 py-1` when a larger badge is needed, or accept the slightly smaller size as the new standard.
**Warning signs:** Badges look noticeably smaller after migration.

## Code Examples

### Full Dark Mode CSS Variables Block
```css
/* Add to index.css after the :root block */
.dark {
  --background: oklch(0.147 0.004 49.3);
  --foreground: oklch(0.986 0.002 67.8);
  --card: oklch(0.147 0.004 49.3);
  --card-foreground: oklch(0.986 0.002 67.8);
  --popover: oklch(0.147 0.004 49.3);
  --popover-foreground: oklch(0.986 0.002 67.8);
  --primary: oklch(0.922 0.005 34.3);
  --primary-foreground: oklch(0.214 0.009 43.1);
  --secondary: oklch(0.214 0.009 43.1);
  --secondary-foreground: oklch(0.986 0.002 67.8);
  --muted: oklch(0.214 0.009 43.1);
  --muted-foreground: oklch(0.547 0.021 43.1);
  --accent: oklch(0.214 0.009 43.1);
  --accent-foreground: oklch(0.986 0.002 67.8);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.268 0.011 36.5);
  --input: oklch(0.268 0.011 36.5);
  --ring: oklch(0.547 0.021 43.1);
  --chart-1: oklch(0.268 0.011 36.5);
  --chart-2: oklch(0.547 0.021 43.1);
  --chart-3: oklch(0.438 0.017 39.3);
  --chart-4: oklch(0.714 0.014 41.2);
  --chart-5: oklch(0.868 0.007 39.5);
  --sidebar: oklch(0.214 0.009 43.1);
  --sidebar-foreground: oklch(0.986 0.002 67.8);
  --sidebar-primary: oklch(0.922 0.005 34.3);
  --sidebar-primary-foreground: oklch(0.214 0.009 43.1);
  --sidebar-accent: oklch(0.268 0.011 36.5);
  --sidebar-accent-foreground: oklch(0.986 0.002 67.8);
  --sidebar-border: oklch(0.268 0.011 36.5);
  --sidebar-ring: oklch(0.547 0.021 43.1);
}
```
Source: 12-UI-SPEC.md

### tailwind.config.js Dark Mode Addition
```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/renderer/**/*.{js,jsx,ts,tsx,html}'],
  theme: {
    extend: {},
  },
  plugins: [],
};
```
Source: [Tailwind CSS v3 Dark Mode docs](https://v3.tailwindcss.com/docs/dark-mode)

### Theme Initialization Script (index.html)
```html
<!-- Add before closing </head> or before main script -->
<script>
  (function() {
    var t = localStorage.getItem('privanote-theme') || 'system';
    var d = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (d) document.documentElement.classList.add('dark');
  })();
</script>
```

### Button Variant Customization for Project Needs
```jsx
// In button.jsx, replace the sizes object:
size: {
  default: "h-10 gap-2 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
  sm: "h-8 gap-1.5 px-2.5 text-[0.8rem]",
  lg: "h-11 gap-2 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
  icon: "size-10",
  "icon-sm": "size-8",
},

// Also add a destructive-outline variant:
variant: {
  // ... keep existing variants ...
  "destructive-outline":
    "border-destructive/30 bg-transparent text-destructive hover:bg-destructive/10 focus-visible:border-destructive/40 focus-visible:ring-destructive/20",
},
```
Source: 12-UI-SPEC.md button variant requirements

### Component Migration Count
| File | Buttons | Inputs | Textareas | Radios | Checkboxes | Badges | Total |
|------|---------|--------|-----------|--------|------------|--------|-------|
| App.jsx | 10 | 2 | 1 | 0 | 0 | 0 | 13 |
| settings-view.jsx | 5 | 5 | 0 | 2 | 1 | 2 | 15 |
| media-card.jsx | 3 | 0 | 0 | 0 | 0 | 1 | 4 |
| transcript-section.jsx | 2 | 0 | 0 | 0 | 0 | 0 | 2 |
| **Total** | **20** | **7** | **1** | **2** | **1** | **3** | **34** |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| shadcn v2 with HSL colors | shadcn v4 with OKLCH colors | March 2026 | Project already uses OKLCH -- no conversion needed |
| `shadcn-ui` CLI package | `shadcn` package (renamed) | v4 | Already using `shadcn@4.1.1` |
| TypeScript-only components | `tsx: false` generates JSX | v4 | Project correctly configured for JSX output |
| Manual component copy | `npx shadcn add` CLI scaffolding | v3+ | Use CLI for consistency |

**Deprecated/outdated:**
- `@shadcn/ui` package name: replaced by `shadcn` (project already uses correct name)
- HSL color format in CSS variables: project uses OKLCH which is the current standard

## Open Questions

1. **Toggle-group vs custom button group for Workspace/Settings tabs**
   - What we know: The current implementation uses custom `<button>` elements with `aria-pressed` and `data-state` for tab switching. shadcn's ToggleGroup provides Radix roving focus and proper accessibility.
   - What's unclear: The UI-SPEC specifies custom active styles (shadow, translate-y, ring-2) that differ from ToggleGroup defaults.
   - Recommendation: Use shadcn ToggleGroup but override className on items to match the UI-SPEC's active state styling. The accessibility benefits outweigh the styling customization effort.

2. **Badge sizing**
   - What we know: shadcn Badge is `h-5 text-xs`. Current badges use `text-sm px-3 py-1`.
   - What's unclear: Whether the smaller default size is acceptable.
   - Recommendation: Accept shadcn default size. The existing badges are slightly oversized compared to standard design systems. If needed, apply `className="text-sm px-3 py-1"` to individual badges.

## Sources

### Primary (HIGH confidence)
- shadcn CLI v4 `--view` and `--dry-run` output -- verified exact component source code for all 10 components
- `components.json` in project -- verified `tsx: false`, `radix-nova` style, `taupe` base color
- `index.css` in project -- verified light mode CSS variables already applied
- `tailwind.config.js` in project -- verified no `darkMode` key (needs addition)
- [Tailwind CSS v3 Dark Mode docs](https://v3.tailwindcss.com/docs/dark-mode) -- class-based strategy
- [shadcn/ui Theming docs](https://ui.shadcn.com/docs/theming) -- CSS variable approach
- [shadcn CLI v4 changelog](https://ui.shadcn.com/docs/changelog/2026-03-cli-v4) -- preset system, JSX support

### Secondary (MEDIUM confidence)
- [shadcn Manual Installation docs](https://ui.shadcn.com/docs/installation/manual) -- tsx: false behavior
- [BetterLink Blog: shadcn Theme Customization](https://eastondev.com/blog/en/posts/dev/20260326-shadcn-ui-theme-customization/) -- CSS variable theming patterns

### Tertiary (LOW confidence)
- None -- all claims verified against project source code and official documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all packages already installed and version-verified via `npm ls`
- Architecture: HIGH -- shadcn CLI `--view` output verified exact component source; migration patterns derived from actual codebase analysis
- Pitfalls: HIGH -- pitfalls 1-4 identified from direct comparison of shadcn defaults vs UI-SPEC requirements and codebase inspection

**Research date:** 2026-04-01
**Valid until:** 2026-05-01 (stable -- shadcn v4 just released, unlikely to change within 30 days)
