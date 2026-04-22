# AGENTS.md

## App purpose

`apps/docs` contains the documentation site for `@config-store`.

## Source of truth

Edit hand-written docs in:

- `src/content/docs/**`

Do not treat generated files as the primary source:

- `.astro/**`

## Important content areas

- `src/content/docs/index.mdx`
- `src/content/docs/index-llms.mdx`
- `src/content/docs/guides/**`
- `src/content/docs/api/**`

## Editing rules

- Edit source docs, not generated artifacts.
- Keep docs aligned to current exported behavior, not incidental implementation detail.
- Prefer short, accurate examples that mirror current package APIs.
- If public behavior changes, update docs in the same task.
- Keep the LLM-oriented index concise and current.

## Validation

- Review referenced code examples against current package exports.

### Validation commands

Run from `apps/docs` when validating local changes:

- `pnpm typegen`
- `pnpm typecheck`
- `pnpm build`
- `pnpm lint`

## Generated files

Do not hand-edit generated outputs:

- `.astro/**`
- `src/env.d.ts`

`typegen` is performed by `astro sync`.
