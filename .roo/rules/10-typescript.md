# TypeScript guidance

- Preserve strict typing and existing public type contracts.
- Treat `packages/core/src/types.ts` as the public contract surface.
- Prefer explicit types at package boundaries and public exports.
- Follow existing export style in each package; do not restyle unrelated files.
- Keep reducers, mutators, selectors, and migrations pure.
- Do not weaken types to make tests pass; fix the contract or usage instead.
- When changing a public type, update tests and docs/examples that depend on it.
