# AGENTS.md

## Package purpose

`packages/react` provides React bindings over the core manager:

- context/provider wiring
- read hooks with selector support
- update hooks and reducer helpers
- React-facing save status exposure

## Read order

1. `MAP.md`
2. `src/hooks.ts`
3. `src/provider.tsx`
4. `src/context.ts`
5. `src/types.ts`
6. Relevant tests

## Key ownership

- `src/hooks.ts`: main consumer-facing API
- `src/provider.tsx`: manager injection into the tree
- `src/context.ts`: shared context holder
- `src/types.ts`: hook result and helper types

## Editing rules

- Preserve selector semantics and rerender behavior.
- Keep React-facing API aligned with core manager contracts.
- Avoid adding package-specific behavior that belongs in core.
- Treat hook result status flags as user-facing behavior.

## Change impact

- Hook behavior changes may require docs and example updates.
- Changes to manager status exposure should be checked against core types.
- Provider/context changes should be minimal and well-tested.

## Validation

- Update React tests for behavior changes.
- Review docs/examples using hooks and provider when public behavior changes.

### Validation commands

Run from `packages/react` when validating local changes:

- `pnpm test:unit`
- `pnpm typecheck`
- `pnpm lint`

## Notes

- React tests include both `*.test.ts` and `*.test.tsx`.
- Hook contract changes should trigger docs/example review.
