# Monorepo navigation

- Start from the nearest `AGENTS.md`.
- In a package, read `index.ts` and the local map before scanning deeply.
- In `packages/core`, `src/manager.ts` is the control plane.
- In `packages/core`, `src/types.ts` defines the public manager contract.
- In `packages/react`, `src/hooks.ts` is the main consumer-facing surface.
- In `apps/docs`, canonical hand-written docs live under `src/content/docs/`.
- In `apps/test-app`, scenario names and folder symmetry matter.
- In `tests-e2e`, spec names should stay aligned with demo scenarios.
