---
created: 2026-03-30T21:31:20.654Z
title: Migrate codebase to TypeScript
area: tooling
files: []
---

## Problem

The project is currently in JavaScript. Adding TypeScript would improve type safety, IDE support, and catch bugs at compile time across both frontend and backend.

## Solution

Convert all `.js` files to `.ts`, add `tsconfig.json` files per package, update build tooling and scripts to handle TypeScript compilation.
