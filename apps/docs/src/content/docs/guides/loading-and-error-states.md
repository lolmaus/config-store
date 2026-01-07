---
title: Loading and Error States
---

When using the `AsyncAdapter`, you want to handle loading and error states.

The library provides granular status flags to handle loading screens, error boundaries, and notifications.

⠀

## Loading state

### Using defaults while settings are loading

One of the core features of `@config-store` is strict Zod validation with default values.

When you initialize the `ConfigManager`, the store is **immediately** populated with the default values defined in your Zod schema. This happens _before_ `adapter.read()` returns data.

This means you often **do not need a loading state**. Your UI will render immediately with valid default settings, and then "hydrate" with user preferences once the adapter loads.

```tsx
// Even if load() is pending, this returns `true` (if that is the default in schema)
const isMenuExpanded = useConfig((c) => c.menuExpanded);

return <Sidebar expanded={isMenuExpanded} />;
```

The downside of this approach is that the user **sees a flash of defualt settings** before user's preferences load.

⠀

### Showing loading state while settings are loading

If your application depends heavily on user settings to render the initial layout (e.g., to avoid layout shift), you can check the `hasBeenHydrated` or `isLoadPending` flags.

You can access these flags by passing a selector to `useConfig`:

```tsx
import {useConfig} from './settings/hooks';

export const App = () => {
    // Select the entire state to access status flags
    const isLoaded = useConfig((_c, state) => state.hasBeenHydrated);
    // OR check pending specifically
    const isLoading = useConfig((_c, state) => state.isLoadPending);

    if (isLoading) {
        return <Spinner />;
    }

    return <Layout />;
};
```

⠀

## Showing error state when setting failed to load

If the adapter fails to read (e.g., network timeout), the manager enters an error state. You can detect this locally in a component or globally via callbacks.

⠀

### Local handling (Try-Catch)

The `manager.load()` method returns a `Promise`. If the adapter fails to read, the promise rejects (in addition to setting the internal error state).

You can wrap the call in a standard `try-catch` block to handle initialization errors imperatively. This is common in the application entry point (`main.tsx`) to prevent the app from mounting if critical configuration is missing.

```tsx
// src/main.tsx
async function init() {
    let app: ReactNode = <App />;

    try {
        // Wait for settings to load
        await configManager.load();
    } catch (error) {
        // If it fails, render a specific fatal error screen
        // instead of the main application.
        app = <FatalErrorScreen error={error} />;
    }

    // Render app only on success
    ReactDOM.createRoot(document.getElementById('root')!).render(app);
}

init();
```

⠀

### React-specific handling (Route Loaders)

In modern React architectures (like **TanStack Router** or **React Router 6.4+**), the recommended way to handle async errors is via **Route Loaders** and **Error Boundaries**.

Instead of managing `try-catch` blocks or `useEffect` hooks, you simply return `configManager.load()` in your root route's loader. If the promise rejects, the router automatically catches it and renders the configured Error Component.

Note: If your settings require authentication, you should avoid calling `load()` for anonymous users. This prevents unnecessary network requests that would result in 401 errors. Since the `ConfigManager` is already initialized with default values, you can simply **skip** the loading process if the user is not logged in.

```tsx
// src/routes/__root.tsx
import {createRootRoute} from '@tanstack/react-router';
import {configManager} from '../settings/manager';
import {authStore} from '../auth/store';

export const Route = createRootRoute({
    loader: async () => {
        // 1. Check if user is logged in
        const {isAuthenticated} = authStore.getState();

        // 2. Only fetch settings if authenticated
        if (isAuthenticated) {
            await configManager.load();
        }

        // 3. Otherwise, do nothing. The app will proceed using
        // the default config defined in your Zod schema.
    },

    component: RootLayout,
});
```

⠀

### Global handling

When creating the manager, you can provide an `onLoadError` callback. This is useful for logging to services like Sentry.

```ts
const manager = ConfigManager.create(
    {
        adapter,
        onLoadError: (error) => {
            console.error('Failed to load settings', error);
            Sentry.captureException(error);
            toast.error('Failed to load settings');
        },
    },
    {
        /* ... */
    }
);
```

## Showing error state when setting failed to save

When you call `update()`, the library performs an **Optimistic Update**. The store updates immediately. If the adapter fails to write the change, the store sets `isSaveError` to true.

The `useUpdateConfig` hook returns the status of the _current_ update operation.

```tsx
export const SaveButton = () => {
    const {update, isPending, isError, error} = useUpdateConfig();

    return (
        <div>
            <button disabled={isPending} onClick={() => update({theme: 'dark'})}>
                {isPending ? 'Saving...' : 'Save Theme'}
            </button>

            {isError && (
                <span className="text-red-500">
                    Failed to save: {error instanceof Error ? error.message : 'Unknown error'}
                </span>
            )}
        </div>
    );
};
```

## Showing a toast when setting failed to save

For a better UX, you usually want to show a toast notification if a background save fails, rather than handling `isError` in every single component.

You can configure a global `onSaveError` handler when initializing the manager.

```ts
import {ConfigManager, LocalStorageAdapter} from '@config-store/core';
import {z} from 'zod';
import toast from 'react-hot-toast'; // or your preferred library

export const configManager = ConfigManager.create(
    // Config manager options
    {
        adapter: new LocalStorageAdapter(),
        // Global error handler
        onSaveError: (error) => {
            const message = error instanceof Error ? error.message : 'Unknown error';
            toast.error(`Could not save settings: ${message}`);
        },
        // You can also handle migration errors here
        onMigrationError: ({error}) => {
            toast.error('Failed to migrate settings version');
            console.error(error);
        },
    },

    // Initial version
    {
        version: 1,
        schema: z
            .object({
                /* ... */
            })
            .prefault({}),
    }
);
```
