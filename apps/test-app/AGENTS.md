# AGENTS.md

## App purpose

`apps/test-app` is a demo and scenario app for exercising real package behavior.

It is not just a playground. Its route scenarios model expected usage patterns and often pair with e2e coverage.

## Important areas

- `src/routes/**`: scenario routes and supporting files
- `src/mocks/**`: request mocking and test support
- `src/main.tsx`: app entrypoint

## Editing rules

- Preserve scenario clarity over clever abstraction.
- Keep scenario names stable unless the task explicitly renames them.
- Prefer symmetric structure across similar scenarios.
- If a scenario changes, review mirrored e2e specs.

## Low-signal paths

Avoid reading generated or temporary files unless explicitly needed:

- `.tanstack/**`

## Validation

- Review matching route files and related e2e specs.
- Keep demo scenarios aligned with current public behavior and docs.

### Validation commands

Run from `apps/test-app` when validating local changes:

- `pnpm typegen`
- `pnpm typecheck`
- `pnpm build`
- `pnpm lint`

## Generated files

Do not hand-edit generated outputs:

- `.tanstack/**`
- `src/routeTree.gen.ts`

`typegen` is generated from the route configuration.
