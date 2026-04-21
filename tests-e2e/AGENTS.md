# AGENTS.md

## Folder purpose

This package contains Playwright coverage for the demo scenarios in `apps/test-app`.

## Naming alignment

Spec names should stay aligned with demo scenario names when possible.

Current examples include:

- `local-storage-default-key.spec.ts`
- `local-storage-custom-key.spec.ts`
- `local-storage-faulty-migration.spec.ts`
- `local-storage-successful-migration.spec.ts`

## Important files

- `tests/*.spec.ts`: scenario coverage
- `fixtures.ts`: shared setup
- `utils.ts`: shared helpers
- `playwright.config.ts`: test config

## Editing rules

- Keep specs scenario-focused and readable.
- Prefer shared helpers for repeated setup, but keep assertions local to the scenario.
- When a demo scenario changes, review the mirrored spec in the same task.
- If naming changes in `apps/test-app`, update corresponding spec names and references.

## Validation

- Preserve route/spec alignment.
- Keep shared helpers minimal and scenario-agnostic.

### Validation commands

Run from `tests-e2e` when validating e2e changes:

- `pnpm test:e2e`
- `pnpm test:e2e:ui`
- `pnpm test:e2e:debug`

## Runtime assumptions

- Default base URL: `http://localhost:5173`
- E2E starts the demo app with `cd ../test-app/ && pnpm run dev`
- Outside CI, Playwright reuses an existing local server when available
