# Phase 1: Monorepo and Local Backend Foundation - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish the monorepo and local backend architecture while fixing startup, persistence, deletion behavior, packaging, and test foundations needed for the rest of v1. This phase must preserve the current note and attachment workflow by the end of the phase while moving the product to a clean desktop/frontend plus backend structure.

</domain>

<decisions>
## Implementation Decisions

### Workspace Shape and Package Boundaries
- **D-01:** The monorepo will use separate `apps/desktop` and `apps/backend` packages rather than keeping the backend nested inside the desktop app.
- **D-02:** Desktop and backend must stay fully separated and communicate only through an explicit API contract.
- **D-03:** Contract ownership lives with the backend package, which exports the contract surface for the desktop to consume.
- **D-04:** Cross-package sharing is limited to contracts only; business logic must not be shared across desktop and backend packages.
- **D-05:** The desktop package should remain backend-agnostic behind the contract so it can run against mocks or alternate implementations in development and tests.
- **D-06:** The API contract should be treated as a versioned public interface with explicit exports rather than an informal internal boundary.
- **D-07:** Each package should build, run, and test independently; root scripts may orchestrate them but should not be the only way to work with each package.
- **D-08:** Phase 1 should rebuild the architecture cleanly from scratch using the current app as a reference, but current note and attachment behavior must still be preserved by the end of the phase.

### the agent's Discretion
- Monorepo tooling and workspace implementation details, as long as they preserve independent package operation.
- Exact contract implementation mechanics, such as schema format, code generation strategy, and client wrapper shape, as long as the contract remains explicit and versioned.
- Migration sequencing needed to preserve current note and attachment behavior while replacing the underlying architecture.
- Other Phase 1 gray areas not discussed in this session, including the local backend runtime topology, storage/deletion mechanics, packaging workflow details, and regression strategy.

</decisions>

<specifics>
## Specific Ideas

- "desktop and backend tottaly separated communicate with contracts using api"
- Rebuild the new architecture cleanly rather than incrementally moving the current Electron code across package boundaries.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Scope and Constraints
- `.planning/ROADMAP.md` — Phase 1 goal, success criteria, and plan slices for Monorepo and Local Backend Foundation.
- `.planning/PROJECT.md` — Product constraints that govern this phase: monorepo structure, brownfield migration, local backend in v1, local-first behavior, and no auth in v1.
- `.planning/REQUIREMENTS.md` — Phase 1 platform requirements `PLAT-01` through `PLAT-07`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/main/main.js`: Current Electron bootstrap, window creation, IPC registration, and file picker behavior to preserve functionally by the end of Phase 1.
- `src/main/preload.js`: Existing narrow renderer bridge pattern that can inform the new desktop-to-backend client boundary.
- `src/main/database.js`: Current persistence rules, schema, and CRUD behavior that define the baseline note and attachment parity target.
- `src/renderer/App.jsx`: Current note and attachment workflow that must remain usable after the architectural rebuild.

### Established Patterns
- The existing app is split across Electron main, preload, and React renderer layers with IPC as the only renderer-to-main boundary.
- Persistence currently lives behind main-process functions, so the codebase already favors pushing durable operations out of the renderer.
- The repo currently uses npm, JavaScript, and a single root package with no existing workspace or backend package structure.

### Integration Points
- The desktop package will need to preserve renderer behavior currently implemented in `src/renderer/App.jsx` while replacing direct preload-to-database calls with contract-based backend calls.
- The backend package will need to absorb note and attachment operations currently implemented inside `src/main/database.js`.
- The desktop shell will need to replace the current direct main-process orchestration in `src/main/main.js` with startup logic that can launch and talk to the local backend through the contract boundary.

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-monorepo-and-local-backend-foundation*
*Context gathered: 2026-03-28*
