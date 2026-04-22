# Core package map

## Purpose

This package owns the framework-agnostic config manager and persistence contract.

## High-value files

- `src/index.ts`
    - package entrypoint and export surface
- `src/manager.ts`
    - main control plane for load/save/migrate/status handling
- `src/types.ts`
    - public types: metadata, state, version defs, options, helper schemas
- `src/errors.ts`
    - user-visible error classes
- `src/adapters/base.ts`
    - abstract persistence boundary
- `src/adapters/local-storage.ts`
    - sync browser persistence
- `src/adapters/async.ts`
    - async persistence and concurrency behavior

## Tests

- `src/manager.test.ts`
- `src/manager-errors.test.ts`
- `src/errors.test.ts`
- adapter-specific tests in `src/adapters/*.test.ts`

## Common edit paths

### Change config lifecycle behavior

Read:

- `src/manager.ts`
- `src/types.ts`
- relevant manager tests

### Change adapter behavior

Read:

- `src/adapters/base.ts`
- target adapter file
- adapter tests
- `src/types.ts` if metadata/envelope is involved

### Change public types or options

Read:

- `src/types.ts`
- `src/index.ts`
- tests and docs/examples using the changed type

### Change migration behavior

Read:

- `src/manager.ts`
- `src/types.ts`
- `src/errors.ts`
- manager and migration-related tests

## Docs to review when behavior changes

- `apps/docs/src/content/docs/guides/schema.md`
- `apps/docs/src/content/docs/guides/loading-and-error-states.md`
- `apps/docs/src/content/docs/guides/adapters/**`
- `apps/docs/src/content/docs/api/**`

## Common edit → validation mapping

### Manager, metadata, migrations, or errors

Run:

- `pnpm test:unit`
- `pnpm typecheck`

### Adapter changes

Run:

- `pnpm test:unit`
- `pnpm typecheck`

### Public type changes

Run:

- `pnpm test:unit`
- `pnpm typecheck`
- review docs/examples
