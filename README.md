# @config-store

A strict, schema-first config manager designed for long-lived frontend apps. It treats user settings as versioned data structures rather than loose JSON blobs, ensuring your application state remains consistent as your requirements evolve.

- **Universal Config:** Store user settings, feature flags, or any persistent client-state.
- **Zod-Powered:** The config is defined as a Zod schema, providing strict TypeScript inference across your codebase. Each setting can be anything from a `boolean` to a complex nested object. The Zod schema also provides defaults for each value.
- **Atomic Persistence:** The config is stored and retrieved as a single JSON-like data structure.
- **Migrations:** As your schema changes, define migration functions to automatically update a user's config to conform to the new schema. This process is transparent to the consuming app.
- **Fail-Safe:** Malformed configs that cannot be migrated are swapped with schema defaults and overwrite the invalid data on the next save.
- **Flexible Adapters:** Ships with a `LocalStorageAdapter` and a robust `AsyncAdapter` (for REST APIs). You can easily define custom adapters for other protocols (e.g., WebSocket, IndexedDB).
- **Concurrency Control:** The `AsyncAdapter` provides three strategies for parallel writes:
    - `abort`: Cancels previous pending requests (default, relies on AbortController).
    - `optimistic`: Sends all requests but handles `409 Conflict` via versioning (requires backend logic).
    - `sequential`: Wait for each update to finish before processing the next one. Updates pile up in a queue. Useful for legacy backends, at the cost of UX.
- **Framework-agnostic:** The core can be used with vanilla JS or in any framework.
- **Framework integrations:** Offers the following integrations:
    - **React**: Includes a `useConfig` hook with **selector support** (e.g., `s => s.theme`). This allows a component to rerender only when the relevant individual setting changes. Other changes to the config will not cause rerenders.

⠀

- [@config-store](#config-store)
  - [0. Roadmap](#0-roadmap)
  - [1. Installation](#1-installation)
  - [1.1. General installation](#11-general-installation)
  - [1.2. Use with React](#12-use-with-react)
  - [1.3 Use with other frameworks](#13-use-with-other-frameworks)
  - [1.4. Version compatibility](#14-version-compatibility)
  - [2. Quickstart](#2-quickstart)
    - [2.1. Define the manager](#21-define-the-manager)
    - [2.2. Generate typed hooks](#22-generate-typed-hooks)
    - [2.3. Wrap your app with the config provider](#23-wrap-your-app-with-the-config-provider)
    - [2.4. Read config](#24-read-config)
    - [2.5. Persist config updates](#25-persist-config-updates)
  - [3. Defining a custom adapter](#3-defining-a-custom-adapter)
    - [3.1 The AsyncAdapter Helper](#31-the-asyncadapter-helper)
    - [3.2 Handling Concurrency (Race Conditions)](#32-handling-concurrency-race-conditions)
      - [3.2.1 concurrency: abort — default](#321-concurrency-abort--default)
      - [3.2.2 concurrency: optimistic — ideal solution, requires backend logic](#322-concurrency-optimistic--ideal-solution-requires-backend-logic)
      - [3.2.3 concurrency: sequential — legacy Fallback](#323-concurrency-sequential--legacy-fallback)
    - [3.3 Handling Backend Responses on save](#33-handling-backend-responses-on-save)
    - [3.4 Handle loading and error states in the UI](#34-handle-loading-and-error-states-in-the-ui)
  - [4. FAQ](#4-faq)
    - [4.1 Should I use TanStack Query in the adapter?](#41-should-i-use-tanstack-query-in-the-adapter)
    - [4.2 Why does the library depend on Zustand?](#42-why-does-the-library-depend-on-zustand)
    - [4.3 What's the hassle with migrations?](#43-whats-the-hassle-with-migrations)
    - [4.4 What happens if I omit a migration?](#44-what-happens-if-i-omit-a-migration)
    - [4.5 How do I reset a setting to its default value?](#45-how-do-i-reset-a-setting-to-its-default-value)
  - [5. Development](#5-development)
    - [5.1 Setup](#51-setup)
    - [5.2 Running Tests](#52-running-tests)
    - [5.3 Building](#53-building)
    - [5.4 Versioning and Publishing](#54-versioning-and-publishing)

⠀

## 0. Roadmap

- [ ] Infrastructure
    - [x] Monorepo
    - [x] Tasks
        - [x] Format
        - [x] Lint
        - [x] Check types
        - [x] Build (with `tsdown`)
        - [x] Unit-test (with `tsx` and `node:test`)
    - [x] Turborepo configuration
    - [ ] Turborepo remote caching
    - [x] CI setup
        - [x] ~~Check PR title for conventional commits~~
        - [x] Run PR checks
        - [x] Release npm packages
    - [ ] lefthook for pre-commit checks
    - [ ] Use Changesets
        - [x] Configure
        - [ ] Switch to per-package changelogs
- [ ] Packages
    - [x] Core
        - [x] Adapters
            - [x] Base
            - [x] Local Storage
            - [x] Async
                - [x] ~~Debouncing~~
                - [x] AbortSignal
                - [x] Concurrency
                    - [x] Default (relies on AbortSignal)
                    - [x] dataVersion
                    - [x] sequential
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
            - [x] Error handling
                - [x] Concurrent requests from burst-clicking
                - [x] Concurrent requests from different tabs/devices
                - [x] Saved schema is higher than current latest schema
        - [x] Barrel file `index.ts`
    - [ ] React
    - [ ] Docs app
- [ ] Testing
    - [x] Unit tests
- [ ] Documentation
    - [x] Readme
        - [x] Intro, rationalization
        - [x] Roadmap
        - [x] Usage samples
        - [x] Adapter usage
        - [x] FAQ
        - [x] Development
    - [ ] Docs app
    - [ ] API documentation
        - [ ] Document with inline comments
        - [ ] Build documentation with TypeDoc

⠀

## 1. Installation

## 1.1. General installation

1.1.1. Make sure you have [Zod 4](https://zod.dev) installed.

1.1.2. Install the `@config-store/core` package using your preferred npm-based package manager:

```sh
npm i -S @config-store/core
pnpm add @config-store/core
yarn add @config-store/core
bun add @config-store/core
```

⠀

## 1.2. Use with React

Additionally, install `@config-store/react`.

⠀

## 1.3 Use with other frameworks

Support for other frameworks is not planned, but contributions are very welcome.

Meanwhile, you can integrate the `ConfigManger` by hand.

⠀

## 1.4. Version compatibility

If using previous versions of packages, mind version compatibility table:

| Branch           | @config-store/core | @config-store/react |
| ---------------- | ------------------ | ------------------- |
| `gen0` (current) | >= 1.0.0-alpha.0   | >= 1.0.0-alpha.0    |

⠀

## 2. Quickstart

### 2.1. Define the manager

In e. g. `src/settings/manager.ts`, instantiate the adapter and pass it to the `ConfigManager`.

Chain `.addVersion()` to define your schema history.

⚠️ Important: the Zod schema is used as the source of truth for config defaults. It should be able to handle `undefined` as input and produce a valid default config. For this to be possible:

- You must provide [.default()](https://zod.dev/api?id=defaults) values for every property in your schema.
- You must attach [.optional()](https://zod.dev/api?id=optionals), [.nullable()](https://zod.dev/api?id=optionals), [.nullish()](https://zod.dev/api?id=optionals) or [.prefault({})](https://zod.dev/api?id=prefaults) (recommended) to the root `z.object()`.

```ts
import {ConfigManager, LocalStorageAdapter, type InferConfig} from '@config-store/core';
import {z} from 'zod';

// 2.1.1. Create your adapter (or import a custom one)
// LocalStorageAdapter now automatically handles the envelope format
const adapter = new LocalStorageAdapter({key: 'my-app-settings'});

// 2.1.2. Initialize the manager with the adapter
export const configManager = ConfigManager.create(adapter)
    // Define Version 1
    .addVersion({
        version: 1,
        schema: z
            .object({
                menuExpanded: z.boolean().default(true),
                darkTheme: z.boolean().default(false),
            })
            .prefault({}),
    })

    // Define Version 2
    .addVersion({
        version: 2,
        schema: z
            .object({
                menuExpanded: z.boolean().default(true),
                // Changed from boolean 'darkTheme' to 'theme' typed as 'light' | 'dark' | 'high-contrast'
                theme: z.literal(['light', 'dark', 'high-contrast']).default('light'),
            })
            .prefault({}),

        migration: (prev) => {
            // TypeScript automatically infers 'prev' as the previous version 💎
            return {
                menuExpanded: prev.menuExpanded,
                theme: prev.darkTheme ? 'dark' : 'light',
            };
        },
    });

// 2.1.3. Export the current config type
export type Config = InferConfig<typeof configManager>;
```

⠀

### 2.2. Generate typed hooks

In e. g. `src/settings/hooks.ts`, make versions of hooks `useConfig` and `useUpdateConfig` that are typed with your current config shape:

```ts
import {createHooks} from '@config-store/react';
import type {Config} from './manager';

export const {useConfig, useUpdateConfig} = createHooks<Config>();
```

⠀

### 2.3. Wrap your app with the config provider

Pass your `configManager` instance into the `manager` prop of the provider.

```tsx
import {ConfigProvider} from '@config-store/core';
import {configManager} from './settings/manager';

export const App = () => (
    <ConfigProvider value={configManager}>
        <Dashboard />
    </ConfigProvider>
);
```

⠀

### 2.4. Read config

Use the hook `useConfig` to read config:

```tsx
import {useConfig} from 'my-app/settings/hooks';

export const PageWrapper = ({children}) => {
    // Get the entire settings object
    const config = useConfig();

    // Pass a selector to subscribe only to specific changes (renders optimized)
    const theme = useConfig((s) => s.theme);

    return <div data-theme={theme}>{children}</div>;
};
```

⠀

### 2.5. Persist config updates

Use the `useUpdateConfig` hook to update user settings and persist them:

```tsx
import {useUpdateConfig} from 'my-app/settings/hooks';

export const ThemeToggler = () => {
    const {update} = useUpdateConfig();

    // Assuming this will be user input
    const newPartialConfig = {theme: 'dark'};

    return (
        <div>
            <button onClick={() => update(newPartialConfig)}>Switch to Dark Mode</button>
        </div>
    );
};
```

⠀

## 3. Defining a custom adapter

While the `LocalStorageAdapter` covers basic use cases, you will often need to persist settings to a remote API.

⠀

### 3.1 The AsyncAdapter Helper

Writing a robust async adapter from scratch is difficult. You have to handle race conditions (concurrent HTTP requests when dragging a slider or burst-clicking a button), as well as error handling.

We provide a helper class `AsyncAdapter` that handles this heavy lifting for you. It strictly enforces an "Envelope" pattern (`{ config, metadata }`) so you can easily handle server-side versioning (e.g. `dataVersion` or `updatedAt`) alongside your data.

In e. g. `src/settings/adapter.ts`:

```ts
import {AsyncAdapter} from '@config-store/core';

export const apiAdapter = new AsyncAdapter({
    // Choose how to handle concurrent save requests
    concurrency: 'abort',

    // READ must return the envelope: { config, metadata }
    read: async () => {
        const res = await fetch('/api/settings');
        if (!res.ok) throw new Error('Failed to fetch');

        const json = await res.json();

        // Assuming server returns: { data: { config, metadata } }
        return json.data;
    },

    // WRITE receives the opaque metadata blob from the manager
    // You should send it back to the server to handle optimistic locking or versioning
    write: async (config, _lastCommittedConfig, metadata, signal) => {
        const payload = {
            config,
            metadata, // e.g. { dataVersion: 1, schemaVersion: 1 }
        };

        const res = await fetch('/api/settings', {
            method: 'PUT',
            body: JSON.stringify(payload),
            headers: {'Content-Type': 'application/json'},
            signal, // 'signal' is provided if you use concurrency: 'abort'
        });

        if (!res.ok) throw new Error('Save Failed');

        // Optional: Return updated metadata/settings from server response
        const json = await res.json();

        // Assuming server returns: { data: { config, metadata } }
        return json.data;
    },

    onWriteError: (error) => {
        console.error('[ConfigStore] Background save failed:', error);
    },
});
```

Then register your adapter with the ConfigManager:

```ts
import {apiAdapter} from './adapter';

export const configManager = ConfigManager.create(adapter);
```

⠀

### 3.2 Handling Concurrency (Race Conditions)

When a user modifies settings rapidly (e.g., dragging a volume slider), multiple save requests are generated. Network latency can cause these requests to arrive out of order.

The `AsyncAdapter` supports three strategies via the `concurrency` option to solve this:

⠀

#### 3.2.1 concurrency: abort — default

**Best for:** Modern backends and standard APIs.

When a new save starts, the library automatically aborts the previous pending request using the browser's `AbortController`.

- **Pros:** Prevents race conditions; reduces server load; UI feels snappy.
- **Cons:** Backend/Fetch must support `AbortSignal` (Standard `fetch` does).

```ts
new AsyncAdapter({
    concurrency: 'abort', // default

    write: async (config, _lastCommittedConfig, metadata, signal) => {
        // Pass the signal to fetch!
        await fetch('/api/settings', {
            method: 'POST',
            body: JSON.stringify({config, metadata}),
            signal,
        });
    },
});
```

⠀

#### 3.2.2 concurrency: optimistic — ideal solution, requires backend logic

**Best for:** sophisticated backends implementing Optimistic Concurrency Control (OCC).

The library fires requests immediately. By passing the `metadata` (containing version numbers) in your `write` function, your server can reject outdated writes (e.g., returning `409 Conflict`).

The adapter stores metadata separately from the config, allowing you to implement version increments or timestamps without polluting your settings schema.

⠀

#### 3.2.3 concurrency: sequential — legacy Fallback

**Best for:** Legacy backends that do not support HTTP request cancellation and do not handle versioning.

The library waits for Request A to finish before sending Request B.

- **Pros:** Safe; works with anything.
- **Cons:** Slow. If the network is laggy, the "Save" indicator may spin for a long time.

```ts
new AsyncAdapter({
    concurrency: 'sequential',

    write: async (config) => {
        // This will never run in parallel with another write
        await fetch('/api/settings', {
            /*...*/
        });
    },
});
```

⠀

### 3.3 Handling Backend Responses on save

Sometimes, the server modifies the data you sent (sanitization) or updates the metadata (bumping versions).

The return type of `write` function is `AdapterEnvelope | void`, where `AdapterEnvelope` is:

```ts
{
    config: unknown;
    metadata: Meta;
}
```

Return `void`: The library keeps the "Optimistic Update" (the value the user set).

Return `AdapterEnvelope`: The library silently updates the store with the data returned from the server.

```ts
const apiAdapter = new AsyncAdapter({
    write: async (config, _lastCommittedConfig, metadata, signal) => {
        const res = await fetch('/api/settings', {
            /*...*/
        });

        const json = await res.json();

        // The server sanitized the volume and bumped the version.
        // Assuming json contains `{ data: { config, metadata }}`
        return json.data;
    },
});
```

Note: A config store update triggered by the adapter's return value will not trigger a subsequent save loop.

⠀

### 3.4 Handle loading and error states in the UI

```tsx
import {useUpdateConfig} from '@config-store/react';

export const ThemeToggler = () => {
    const {update, isSaving} = useUpdateConfig();

    const toggle = async (newTheme: string) => {
        try {
            // 1. Updates UI immediately (Optimistic)
            // 2. Awaits the adapter's write operation
            await update({theme: newTheme});
            toast.success('Saved!');
        } catch (err) {
            // 3. At this point, settings will automatically rollback
            toast.error('Failed to save theme');
        }
    };

    return (
        <div>
            <button onClick={toggle}>{isSaving ? 'Saving...' : 'Switch to Dark Mode'}</button>
            {error && <span className="error">Save failed!</span>}
        </div>
    );
};
```

## 4. FAQ

### 4.1 Should I use TanStack Query in the adapter?

**Probably not.**

TanStack Query (React Query) is designed for **Server State**. This library manages **Client State**. If you use TanStack Query inside the adapter, you are effectively caching the data twice.

If you know what you're doing, you _can_ bridge them using `queryClient.fetchQuery` inside `adapter.read()` and `queryClient.setQueryData` inside `adapter.write()`.

⠀

### 4.2 Why does the library depend on Zustand?

We use `zustand/vanilla` internally as a micro-dependency (<1kb) to provide a robust implementation of `useSyncExternalStore` and selector support (`useConfig(s => s.theme)`). This prevents unnecessary re-renders that would occur with standard React Context.

⠀

### 4.3 What's the hassle with migrations?

Config schemas change over time as your project matures. For example, dark theme was managed via `darkTheme: boolean` setting, but now it's `theme: 'dark' | 'light' | 'system'`.

Without migrations, a user returning after 6 months will experience a crash because their localStorage data doesn't match your new code.

`@config-store` lets you define a migration, that will change the user's config to the new format without discarding their preferences.

Migrations are applied transparently, keeping your UI code clean and typed strictly to the _latest_ version.

⠀

### 4.4 What happens if I omit a migration?

If `adapter.read()` returns data that does not match the current Zod schema, **Zod will throw a validation error**. The `ConfigManager` catches this error, logs it, and **falls back to default values** to prevent a White Screen of Death.

⠀

### 4.5 How do I reset a setting to its default value?

Pass `undefined` to the update hook: `updateConfig({ theme: undefined })`. Zod will apply the `.default()` value defined in your schema.

⠀

## 5. Development

This project uses **TurboRepo** and **pnpm**.

⠀

### 5.1 Setup

```bash
# Install dependencies
pnpm install
```

⠀

### 5.2 Running Tests

We use the native Node.js test runner.

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test -- --watch
```

⠀

### 5.3 Building

```bash
# Build all packages
pnpm build
```

⠀

### 5.4 Versioning and Publishing

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
