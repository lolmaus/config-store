# AGENTS.md

## Package purpose

`packages/core` contains the framework-agnostic config engine:

- config state management
- schema versioning and migrations
- adapter integration
- metadata and envelope handling
- load/save status tracking
- public error types

## Read order

1. `MAP.md`
2. `src/manager.ts`
3. `src/types.ts`
4. `src/errors.ts`
5. `src/adapters/base.ts`
6. Relevant adapter implementation and tests

## Key ownership

- `src/manager.ts`: orchestration for load, save, migration, optimistic updates
- `src/types.ts`: public contract surface
- `src/errors.ts`: user-visible error shapes
- `src/adapters/*`: persistence boundary implementations

## Editing rules

- Treat `src/types.ts` as the public contract surface.
- Keep migrations, selectors, reducers, and mutators pure.
- Preserve metadata semantics unless the task explicitly changes them.
- Avoid folding React-specific concerns into core logic.
- Follow existing colocated test patterns.

## Change impact

- Manager state/status changes may affect React bindings.
- Adapter envelope changes may affect docs, tests, and examples.
- Error semantics changes may affect docs and user-facing behavior.
- Migration changes should trigger test and docs review.

## Validation

- Update nearby `*.test.ts` files for logic changes.
- Review docs when public behavior changes.

### Validation commands

Run from `packages/core` when validating local changes:

- `pnpm test:unit`
- `pnpm typecheck`
- `pnpm lint`

## Notes

- Unit tests are executed with `tsx --test`.
- Public contract changes in `src/types.ts` or adapter behavior usually require test and docs review.
