# Repo map

This workspace is a monorepo for `@config-store`.

## Main areas

- `packages/core`: config manager, migrations, adapters, errors, public types
- `packages/react`: React provider and hooks over the core manager
- `apps/docs`: docs site source and API docs
- `apps/test-app`: demo app with route-based scenarios
- `tests-e2e`: Playwright specs mirroring demo scenarios

## High-value entry files

- `packages/core/src/manager.ts`
- `packages/core/src/types.ts`
- `packages/core/src/errors.ts`
- `packages/react/src/hooks.ts`
- `packages/react/src/provider.tsx`

## Generated or low-value paths

Avoid reading these unless explicitly needed:

- `apps/docs/.astro/**`
- `apps/test-app/.tanstack/**`
- `**/node_modules/**`
- `**/dist/**`
- `**/coverage/**`
