---
created: 2026-03-30T21:31:20.654Z
title: Remove src directories
area: general
files:
  - apps/backend/src/
---

## Problem

Packages have an extra `src/` nesting layer (e.g. `apps/backend/src/services/...`). This adds unnecessary depth and doesn't align with the intended flat package structure.

## Solution

Move files from `src/` up one level into the package root, update all imports and build/tooling configs that reference `src/` paths, then delete the empty `src/` directories.
