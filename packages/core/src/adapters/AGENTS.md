# AGENTS.md

## Folder purpose

This folder contains persistence boundary implementations for `packages/core`.

## Files

- `base.ts`: abstract adapter contract
- `local-storage.ts`: synchronous browser persistence
- `async.ts`: asynchronous persistence and concurrency handling

## Read order

1. `base.ts`
2. target adapter file
3. target adapter tests
4. `../types.ts` if metadata or envelope behavior is involved

## Editing rules

- Keep adapter concerns at the persistence boundary.
- Preserve envelope shape and metadata flow unless the task explicitly changes them.
- Treat concurrency behavior in `async.ts` as externally meaningful behavior.
- Do not move UI or React concerns into adapters.
- Prefer targeted fixes over broad abstraction changes.

## Validation

- Update adapter-specific tests.
- If metadata or conflict behavior changes, review manager tests too.
- If public behavior changes, update adapter docs/examples.
