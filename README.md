# @config-store

- [@config-store](#config-store)
    - [About](#about)
    - [Documentation](#documentation)
    - [Roadmap](#roadmap)
    - [Development](#development)
        - [Setup](#setup)
        - [Running Tests](#running-tests)
        - [Building](#building)
        - [Versioning and Publishing](#versioning-and-publishing)

⠀

## About

A strict, schema-first config manager designed for long-lived frontend apps. It treats user settings as a versioned data structure rather than a loose JSON blob, ensuring your application state remains consistent as your requirements evolve.

- **Universal Config:** Store user settings, feature flags, or any persistent client-state in a centralized JSON-like structure.
- **Zod-Powered:** The config is defined as a Zod schema, providing strict TypeScript inference across your codebase. Each setting can be anything from a `boolean` to a complex nested object. The Zod schema also provides defaults for each value.
- **Migrations:** As your schema changes, define migration functions to automatically update a user's config to conform to the new schema. This process is transparent to the consuming app.
- **Fail-Safe:** Malformed configs that cannot be migrated are swapped with schema defaults and overwrite the invalid data on the next save.
- **Flexible Adapters:** Ships with a `LocalStorageAdapter` and a robust `AsyncAdapter` (for REST APIs). You can easily define custom adapters for other protocols (e.g., WebSocket, IndexedDB).
- **Concurrency Control:** The `AsyncAdapter` provides three strategies for parallel writes:
    - abort: Cancels previous pending requests (default, relies on AbortController).
    - OOC: Sends all requests but handles `409 Conflict` via versioning (requires backend logic).
    - sequential: Wait for each update to finish before processing the next one. Updates pile up in a queue. Useful for legacy backends, at the cost of UX.
- **Framework-agnostic:** The core can be used with vanilla JS or in any framework.
- **Framework integrations:** Offers the following integrations:
    - **React**: Includes a `useConfig` hook with **selector support** (e.g., `s => s.theme`). This allows a component to rerender only when the relevant individual setting changes. Other changes to the config will not cause rerenders.

⠀

## Documentation

https://config-store.lolma.us

⠀

## Roadmap

- [x] Infrastructure
    - [x] Monorepo
    - [x] Tasks
        - [x] Format
        - [x] Lint
        - [x] Check types
        - [x] Build (with `tsdown`)
        - [x] Unit-test (with `tsx` and `node:test`)
    - [x] Turborepo configuration
    - [x] CI setup
        - [x] ~~Check PR title for conventional commits~~
        - [x] Run PR checks
        - [x] Release npm packages
    - [ ] lefthook for pre-commit checks
    - [x] Use Changesets
        - [x] Configure
        - [x] Switch to per-package changelogs
- [ ] Packages
    - [x] Core
        - [x] Adapters
            - [x] Base
            - [x] Local Storage
            - [x] Async
                - [x] ~~Debouncing~~
                - [x] AbortSignal
                - [x] Concurrency
                    - [x] Abort (default)
                    - [x] Optimistic Concurrency Control
                    - [x] Sequential
        - [ ] Config Manger
            - [x] Schema definition via Zod
            - [x] `addVersion` / Schema History API
            - [x] Migration runner logic
            - [x] Default value fallback
            - [x] Metadata/Version state management
            - [x] Type inference helper (`InferConfig<T>`)
            - [x] Zustand store
            - [x] Retrieving config from the manager
            - [x] Updating config
            - [ ] Error handling
                - [x] Concurrent requests from burst-clicking
                - [x] Concurrent requests from different tabs/devices
                - [x] Saved schema is higher than current latest schema
                - [ ] Include Zod validation error into error message
        - [x] Barrel file `index.ts`
    - [x] React
    - [x] Docs app
    - [ ] Test app
- [ ] Testing
    - [x] Unit tests
- [ ] Documentation
    - [x] Readme
    - [ ] Docs app
        - [x] Implement
        - [ ] Migrate documentation
            - [x] Installation
            - [x] Schema Definition
            - [x] React Quickstart
            - [ ] Adapters
                - [x] LocalStorageAdapter
                - [x] AsyncAdapter
                - [ ] Custom adapter
                - [x] FAQ
            - [ ] Recipes
                - [ ] Debouncing
                - [ ] Loading and Error states
        - [x] Deploy
    - [x] API documentation
        - [x] Document with inline comments
        - [x] Build documentation with TypeDoc

⠀

## Development

This project uses **TurboRepo** and **pnpm**.

⠀

### Setup

```bash
# Install dependencies
pnpm install
```

⠀

### Running Tests

We use the native Node.js test runner.

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test -- --watch
```

⠀

### Building

```bash
# Build all packages
pnpm build
```

⠀

### Versioning and Publishing

This repository uses **Changesets** for version management.

1.  **Create a changeset:** Run this command before commiting your changes to generate a changelog entry:

    ```bash
    pnpm changeset
    ```

    Include the resulting changeset into your commit.

2.  **Version packages:** (Usually handled by CI)

    ```bash
    pnpm changeset version
    pnpm install # update lockfile
    ```

3.  **Publish:**
    ```bash
    pnpm release
    ```
