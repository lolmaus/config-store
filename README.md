# @config-store

- [@config-store](#config-store)
    - [About](#about)
    - [Documentation](#documentation)
    - [Roadmap](#roadmap)
    - [Development](#development)
        - [Setup](#setup)
        - [Development Server](#development-server)
        - [Running Unit Tests](#running-unit-tests)
        - [Running End-To-End Tests](#running-end-to-end-tests)
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
    - [x] lefthook for pre-commit checks
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
        - [x] Config Manger
            - [x] Schema definition via Zod
            - [x] `addVersion` / Schema History API
            - [x] Migration runner logic
            - [x] Default value fallback
            - [x] Metadata/Version state management
            - [x] Type inference helper (`InferConfig<T>`)
            - [x] Zustand store
            - [x] Retrieving config from the manager
            - [x] Updating config
            - [x] Edge case handling
                - [x] Concurrent requests from burst-clicking
                - [x] Concurrent requests from different tabs/devices
                - [x] Saved schema is higher than current latest schema
                - [x] Include Zod validation error into error message
            - [x] Error handling callbacks
                - [x] `onLoadError`
                - [x] `onSaveError`
                - [x] `onMigrationError`
        - [x] Barrel file `index.ts`
    - [x] React
    - [x] Docs app
    - [ ] Test app
- [ ] Testing
    - [x] Unit tests
    - [ ] Integration tests with the test app
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

```sh
# Install dependencies
pnpm install
```

⠀

### Development Server

Start the development environment for the entire monorepo:

```sh
pnpm run dev
```

This launches the following apps in parallel:

1.  **Test App (`apps/test-app`)**: A Vite playground for E2E testing and manual verification.
    - URL: http://localhost:5173
    - **Source Mode:** Reads directly from `packages/*/src`. Changes to the library code trigger instant HMR updates.

2.  **Documentation (`apps/docs`)**: The Astro + Starlight + TypeDoc documentation site.
    - URL: http://localhost:4321
    - **Auto-Restart:** Reads directly from `packages/*/src`. Changes to the library code trigger an automatic restart to regenerate TypeDoc API references.

You can start the `test-app` and the `docs` app individually with:

```sh
pnpm run dev --filter test-app
pnpm run dev --filter docs
```

⠀

### Running Unit Tests

We use the native Node.js test runner for unit tests.

```sh
# Run all unit tests
pnpm run test:unit

# Run tests in watch mode
pnpm run test:unit:watch
```

Due to how these tasks are written, you cannot use `-- filename` with them. To be able to run an individual test file, use a dedicated task:

```sh
pnpm run test:unit:file --filter @config-store/core -- src/manager.test.ts
pnpm run test:unit:file --filter @config-store/react -- src/hooks.test.tsx
```

⠀

### Running End-To-End Tests

Before you can run E2E tests, you need to install Playwright browsers and dependencies:
d

```sh
pnpm run test:e2e:install
```

To run E2E tests, use one of these commands, depending on your needs:

```sh
# Runs the entire test suite once in headless browser
pnpm run test:e2e

# Starts the Playwright UI that lets you choose which tests to run
# and inspect results
pnpm run test:e2e:ui

# Runs the test suite once in headed browser in debug mode
pnpm run test:e2e:debug
```

You can pass arguments to Playwright by adding `--` after the command.

```sh
# Filter by filename
pnpm run test:e2e -- login.spec.ts

# Filter by test case name
pnpm run test:e2e -- -g "validation"
```

Playwright will automatically build and start the `test-app` for the duration of E2E test suite run, if the `test-app` not already running.

For better DX, you might want to start the `test-app` in a separate terminal window:

```dev
pnpm run dev --filter test-app
```

⠀

### Building

To build the libraries (`dist/` folders) and the apps:

```sh
# Build all packages
pnpm build
```

⠀

### Versioning and Publishing

This repository uses **Changesets** for version management.

1.  **Create a changeset:** Run this command before commiting your changes to generate a changelog entry:

    ```sh
    pnpm changeset
    ```

    Include the resulting changeset into your commit.

2.  **Version packages:** (Usually handled by CI)

    ```sh
    pnpm changeset version
    pnpm install # update lockfile
    ```

3.  **Publish:**
    ```sh
    pnpm release
    ```
