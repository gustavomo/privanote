---
created: 2026-03-30T21:31:20.654Z
title: Rename apps folder
area: general
files:
  - apps/
---

## Problem

The `apps/` folder name may not be descriptive or aligned with the intended monorepo conventions. Renaming it would improve clarity.

## Solution

Decide on the target name (e.g. `packages/`, `services/`, or keep `apps/`), update all references in `package.json` workspaces, scripts, and imports.
