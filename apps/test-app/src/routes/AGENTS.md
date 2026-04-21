# AGENTS.md

## Folder purpose

This folder contains route-driven scenarios demonstrating `@config-store` behavior.

## Structure pattern

A scenario commonly consists of:

- a route entry file such as `local-storage-default-key.tsx`
- a matching scenario folder such as `-local-storage-default-key/`
- nested `components/` and `settings/` files used by that scenario

## Scenario symmetry

The local-storage scenarios are intentionally parallel:

- `default-key`
- `custom-key`
- `faulty-migration`
- `successful-migration`

Preserve symmetry across these scenarios unless the task explicitly introduces a meaningful difference.

## Editing rules

- Keep scenario names, route names, and supporting folder names aligned.
- Make scenario-specific differences obvious and intentional.
- Avoid cross-scenario drift caused by accidental partial edits.
- When changing behavior, review the matching Playwright spec name in `tests-e2e/tests/`.

## Validation

- Check mirrored scenario files for unintended drift.
- Review matching e2e specs after scenario changes.
