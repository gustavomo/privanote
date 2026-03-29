# Phase 1: Monorepo and Local Backend Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md; this log preserves the alternatives considered.

**Date:** 2026-03-28
**Phase:** 01-monorepo-and-local-backend-foundation
**Areas discussed:** Workspace shape and package boundaries

---

## Workspace Shape and Package Boundaries

### Q1. Top-level monorepo shape

| Option | Description | Selected |
|--------|-------------|----------|
| `apps/desktop` + `apps/backend` + `packages/shared` | Clear separation between the desktop app, local backend, and shared contracts/utilities. | |
| `apps/desktop` + `packages/backend` + `packages/shared` | Backend stays library-like and is consumed by the desktop app rather than treated as an app/service. | |
| `apps/desktop` only, with backend nested inside it | Fastest migration, but weakens the frontend/backend split. | |
| Freeform | Desktop and backend totally separated, communicate with contracts using API. | ✓ |

**User's choice:** Desktop and backend should be totally separated and communicate through API contracts.
**Notes:** Interpreted as separate desktop and backend packages with an explicit contract boundary.

### Q2. Contract ownership

| Option | Description | Selected |
|--------|-------------|----------|
| `packages/contracts` | Dedicated shared package for schemas and client helpers. | |
| `apps/backend` | Backend owns contract definitions and exports them for desktop consumption. | ✓ |
| Spec-first protocol docs | Define contracts in protocol docs first and generate code later. | |
| `You decide` | Agent chooses the lightest approach preserving the API boundary. | |

**User's choice:** `apps/backend`
**Notes:** Contract ownership stays on the backend side.

### Q3. Cross-package sharing

| Option | Description | Selected |
|--------|-------------|----------|
| Contracts only | Desktop can consume contracts and a thin client, but no shared business logic. | ✓ |
| Contracts + generic utilities | Allow neutral shared utilities later. | |
| Shared domain modules are fine | Allow broader domain sharing while keeping an API. | |

**User's choice:** Contracts only
**Notes:** Business logic must not be shared across packages.

### Q4. Migration style

| Option | Description | Selected |
|--------|-------------|----------|
| Desktop keeps shell/preload, backend takes operations behind the API | Incremental extraction from the current app. | |
| Rebuild both packages cleanly from scratch | Use current app as reference only. | ✓ |
| Temporary mixed migration | Keep some logic in desktop during Phase 1 and clean it later. | |

**User's choice:** Rebuild both packages cleanly from scratch
**Notes:** This was later constrained by parity expectations in Q8.

### Q5. Backend-agnostic desktop

| Option | Description | Selected |
|--------|-------------|----------|
| Yes | Keep the desktop package backend-agnostic behind the contract so mocks/alternates are possible. | ✓ |
| No | Desktop can assume the real local backend only. | |

**User's choice:** Yes
**Notes:** This reinforces the contract boundary and future testability.

### Q6. Contract formality

| Option | Description | Selected |
|--------|-------------|----------|
| Versioned public API surface with explicit exports | Treat the contract as a real public interface. | ✓ |
| Explicit but lightweight | Clear contract, but no formal versioning yet. | |
| Minimal discipline | Keep interfaces separated informally in code. | |

**User's choice:** Versioned public API surface with explicit exports
**Notes:** The boundary should be maintained with deliberate interface discipline.

### Q7. Package independence

| Option | Description | Selected |
|--------|-------------|----------|
| Each package builds and runs independently | Root scripts orchestrate, but package scripts remain first-class. | ✓ |
| Independent enough, but root scripts are the main interface | Some local scripts, but root is primary. | |
| Root-managed is fine | One coordinated app with separated folders. | |

**User's choice:** Each package builds and runs independently
**Notes:** Root tooling should orchestrate, not hide package boundaries.

### Q8. Rebuild vs parity

| Option | Description | Selected |
|--------|-------------|----------|
| Rebuild architecture cleanly, but preserve current note/attachment behavior by Phase 1 completion | Clean split without violating the brownfield requirement. | ✓ |
| Full clean rebuild is more important than short-term parity | Some current behavior may be dropped or deferred. | |
| Keep the old app running in parallel until new packages reach parity | Safer migration path with temporary duplication. | |

**User's choice:** Rebuild architecture cleanly, but preserve current note and attachment behavior by Phase 1 completion
**Notes:** Planning should not trade away existing note and attachment capability.

## the agent's Discretion

- Monorepo tooling and workspace implementation details
- Contract schema/client mechanics
- Migration sequencing details
- Other Phase 1 gray areas the user chose not to discuss yet

## Deferred Ideas

None.
