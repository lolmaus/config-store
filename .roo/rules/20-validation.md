# Validation rules

- For logic changes, check the nearest relevant tests first.
- For public API changes, update docs and examples.
- For adapter or migration changes, review both tests and guides.
- For React hook/provider changes, review rerender semantics and save/load state exposure.
- For demo scenario changes in `apps/test-app`, verify mirrored specs in `tests-e2e`.
- Prefer validation close to the edited package before workspace-wide validation.
- Prefer the nearest package-level validation command before workspace-wide validation.
- Use workspace-wide checks when a change crosses package boundaries.
- Regenerate tool-owned files instead of editing them by hand.
- In `apps/docs`, run `typegen` before typecheck when docs content or config affects generated types.
- In `apps/test-app`, run `typegen` before validating route-related changes.
