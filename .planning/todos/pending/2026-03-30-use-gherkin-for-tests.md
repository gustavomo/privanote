---
created: 2026-03-30T21:31:20.654Z
title: Use Gherkin for tests
area: testing
files: []
---

## Problem

Tests lack a consistent, readable format. Gherkin (Given/When/Then) would make acceptance criteria and test scenarios easier to read, write, and align with product requirements.

## Solution

Adopt a Gherkin-based testing framework (e.g. Cucumber.js or Vitest with a Gherkin plugin). Write `.feature` files for user-facing flows and wire them to step definitions.
