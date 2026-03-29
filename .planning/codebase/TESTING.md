# Testing Patterns

**Analysis Date:** 2026-03-28

## Test Framework

**Runner:**
- No test runner is configured in `package.json`.
- `npm test` currently executes `echo "No tests"` and does not run any assertions.
- There is no `jest`, `vitest`, `mocha`, or `playwright` setup in the repo snapshot.

**Assertion Library:**
- No assertion library is configured because there are no committed tests.
- There is no observed use of `expect`, `assert`, or Chai in the repository.

**Run Commands:**
```bash
npm test
npm run build
npm run dev
npm start
```
- `npm test` is a placeholder only.
- `npm run build` builds the renderer with Vite, not tests.
- `npm run dev` starts Electron plus the Vite renderer for manual verification.
- `npm start` launches Electron directly for manual app checks.

## Test File Organization

**Location:**
- No test directories or colocated `*.test.*` / `*.spec.*` files exist in the current repo state.
- There is no `tests/` or `__tests__/` tree.

**Naming:**
- No naming convention exists yet for unit, integration, or E2E tests.
- There are no committed example files to mirror.

**Structure:**
```text
No committed test structure exists yet.
```

## Test Structure

**Suite Organization:**
```typescript
No test suites are present in the repository.
```

**Patterns:**
- No shared setup or teardown pattern is established.
- No arrange/act/assert convention is visible in code because there are no tests.
- No hooks such as `beforeEach` or `afterEach` are present.

## Mocking

**Framework:**
- No mocking framework is configured.
- There is no `vi.mock()`, `jest.mock()`, or Sinon usage in the repo.

**Patterns:**
```typescript
No committed mocking pattern exists yet.
```

**What to Mock:**
- Nothing is currently codified.
- If tests are added later, the obvious boundaries to mock are Electron IPC, SQLite access, and file dialogs, but that is an inference from the app architecture rather than an existing pattern.

**What NOT to Mock:**
- No rule exists yet for what should remain real in tests.

## Fixtures and Factories

**Test Data:**
```typescript
No fixture or factory helpers are currently present.
```

**Location:**
- There is no `tests/fixtures/` directory.
- There are no factory modules under `src/` or a separate test support tree.

## Coverage

**Requirements:**
- No coverage target is defined.
- There is no CI-enforced minimum coverage in the current repo state.

**Configuration:**
- Coverage tooling is not configured.
- `.gitignore` already excludes `coverage/`, but that is a general ignore rule rather than evidence of a working coverage workflow.

**View Coverage:**
```bash
No coverage command is defined.
```

## Test Types

**Unit Tests:**
- No unit tests are committed.
- No unit-test granularity standard can be inferred from the repo itself.

**Integration Tests:**
- No integration test setup exists.
- The main-process database and IPC layers in `src/main/` are untested in the repository snapshot.

**E2E Tests:**
- No end-to-end framework is configured.
- No browser automation or Electron automation harness is present.

## Common Patterns

**Async Testing:**
```typescript
No async test pattern exists yet.
```

**Error Testing:**
```typescript
No error assertion pattern exists yet.
```

**Snapshot Testing:**
- Snapshot testing is not used in the current repo state.
- There is no snapshot directory or snapshot update workflow.

## Manual Verification

- Current verification is manual through `npm run dev` and `npm start`.
- The renderer UI in `src/renderer/App.jsx` can be exercised directly to check node CRUD, attachment CRUD, and file picker flows.
- The database layer in `src/main/database.js` can be verified by observing persisted rows in `data/privanote.db`, which is ignored by git.
- The Vite build output lands in `dist/`, which is also ignored by git.

## Current Gaps

- There is no automated test framework.
- There are no test files to use as examples.
- There is no coverage reporting.
- There is no documented mocking strategy.
- There is no CI test command beyond the placeholder `npm test`.

*Testing analysis: 2026-03-28*
*Update when test patterns change*
