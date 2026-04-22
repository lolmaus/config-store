# React package map

## Purpose

This package exposes React bindings for the core config manager.

## High-value files

- `src/index.ts`
    - package export surface
- `src/hooks.ts`
    - `useConfig`, `useUpdateConfig`, `useUpdateConfigReducer`, `createHooks`
- `src/provider.tsx`
    - `ConfigProvider`
- `src/context.ts`
    - shared React context
- `src/types.ts`
    - hook-related helper types and result contracts

## Tests

- `src/hooks.test.tsx`

## Common edit paths

### Change read-hook behavior

Read:

- `src/hooks.ts`
- `src/types.ts`
- `src/hooks.test.tsx`

### Change provider wiring

Read:

- `src/provider.tsx`
- `src/context.ts`
- any hook code consuming context

### Change update-hook status behavior

Read:

- `src/hooks.ts`
- `src/types.ts`
- relevant core state in `packages/core/src/types.ts`

## Docs to review when behavior changes

- `apps/docs/src/content/docs/guides/react-quickstart.md`
- `apps/docs/src/content/docs/guides/loading-and-error-states.md`
- `apps/docs/src/content/docs/api/react/**`

## Common edit → validation mapping

### Hook logic or selector behavior

Run:

- `pnpm test:unit`
- `pnpm typecheck`

### Provider/context wiring

Run:

- `pnpm test:unit`
- `pnpm typecheck`

### Public hook type changes

Run:

- `pnpm test:unit`
- `pnpm typecheck`
- review docs/examples
