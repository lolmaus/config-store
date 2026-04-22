# AGENTS.md

## Purpose

This monorepo contains the `@config-store` library and its supporting apps:

- `packages/core`: framework-agnostic config manager, adapters, migrations, errors, and public types
- `packages/react`: React bindings over the core manager
- `apps/docs`: documentation site and API/reference docs
- `apps/test-app`: demo app with scenario-based routes
- `tests-e2e`: Playwright tests mirroring demo scenarios

## Instruction hierarchy

- This file applies repo-wide.
- A deeper `AGENTS.md` overrides broader guidance inside its subtree.
- Before editing a subtree, read the nearest `AGENTS.md`.

## First places to read

- Core behavior:
    - `packages/core/src/manager.ts`
    - `packages/core/src/types.ts`
    - `packages/core/src/errors.ts`
- Persistence boundary:
    - `packages/core/src/adapters/base.ts`
    - `packages/core/src/adapters/*`
- React integration:
    - `packages/react/src/hooks.ts`
    - `packages/react/src/provider.tsx`
    - `packages/react/src/context.ts`
- Canonical docs content:
    - `apps/docs/src/content/docs/**`
- Demo scenarios:
    - `apps/test-app/src/routes/**`
- End-to-end coverage:
    - `tests-e2e/tests/**`

## Low-signal or generated paths

Avoid spending context on these unless the task explicitly targets them:

- `apps/docs/.astro/**`
- `apps/test-app/.tanstack/**`
- `**/node_modules/**`
- `**/dist/**`
- `**/coverage/**`

## Repo navigation heuristics

- Start from package entrypoints and nearest tests before scanning entire folders.
- Treat `packages/core/src/types.ts` as the public contract surface.
- Treat `apps/docs/src/content/docs/` as the source of truth for hand-written docs.
- Treat `apps/test-app` and `tests-e2e` as mirrored scenario layers.

## Change impact matrix

- If changing core behavior, update core tests and review React bindings.
- If changing React hook/provider behavior, update React tests and docs/examples.
- If changing public behavior, sync docs and demo scenarios.
- If changing scenario behavior in `apps/test-app`, review mirrored specs in `tests-e2e`.
- If changing adapter or migration semantics, review docs under `guides/` and relevant tests.

## Editing rules

- Prefer small, local changes over broad refactors.
- Preserve strict typing and public API stability unless the task explicitly changes API.
- Follow existing naming, export, and test placement patterns.
- Do not hand-edit generated files when a source file exists upstream.

## Validation expectations

- Logic changes should update or confirm nearby tests.
- Public API changes should update docs and examples.
- Scenario changes should preserve route/spec alignment unless divergence is intentional.

## Workspace tooling

- Package manager: `pnpm`
- Task runner: `turbo`
- Node version target: `>=24`

Prefer the nearest package-level command before running workspace-wide checks.

## Common root commands

- `pnpm checks` — runs typecheck, lint, and unit tests across the workspace
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test:unit`
- `pnpm test:e2e`
- `pnpm format`

## Generated files

Do not hand-edit generated files when a source or generator exists.

Known generated or tool-owned paths include:

- `apps/docs/.astro/**`
- `apps/docs/src/env.d.ts`
- `apps/test-app/.tanstack/**`
- `apps/test-app/src/routeTree.gen.ts`
