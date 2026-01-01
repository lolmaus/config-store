---
title: React Quickstart
---

## 1. Define the manager and the schema

In e. g. `src/settings/manager.ts`, instantiate the adapter and pass it to the `ConfigManager`.

Chain `.addVersion()` to define your schema history.

```ts
import {ConfigManager, LocalStorageAdapter, type InferConfig} from '@config-store/core';
import {z} from 'zod';

// Create your adapter (or import a custom one)
const adapter = new LocalStorageAdapter({key: 'my-app-settings'});

// Initialize the manager with the adapter
export const configManager = ConfigManager

    // Initialize with adapter and schema version 1
    .create(adapter, {
        version: 1,
        schema: z
            .object({
                menuExpanded: z.boolean().default(true),
                darkTheme: z.boolean().default(false),
            })
            .prefault({}),
    })

    // Eventually, add schema version 2 as your settings evolve
    .addVersion({
        version: 2,
        schema: z
            .object({
                menuExpanded: z.boolean().default(true),
                // Changed from boolean 'darkTheme' to 'theme' typed as 'light' | 'dark' | 'high-contrast'
                theme: z.literal(['light', 'dark', 'high-contrast']).default('light'),
            })
            .prefault({}),

        // Migrate uesrs from schema version 1 to 2
        migration: (prev) => {
            // TypeScript automatically infers 'prev' as the previous version 😙👌
            return {
                ...prev,

                // Migrate the theme setting from boolean to string
                theme: prev.darkTheme ? 'dark' : 'light',
            };
        },
    });

// Export the current config type
export type MySettings = InferConfig<typeof configManager>;
```

⠀

## 2. Generate typed hooks

In e. g. `src/settings/hooks.ts`, make versions of hooks `useConfig` and `useUpdateConfig` that are typed with your current config shape:

```ts
import {createHooks} from '@config-store/react';
import type {MySettings} from './manager';

export const {useConfig, useUpdateConfig, useUpdateConfigReducer} = createHooks<MySettings>();
```

⠀

## 3. Wrap your app with the config provider, load the config

Pass your `configManager` instance into the `manager` prop of the provider.

```tsx
import {ConfigProvider} from '@config-store/react';
import {configManager} from './settings/manager';

export const AuthenicatedPageLayout = () => {
    // Fetch settings when the app is initially loaded
    configManager.load();

    return (
        <ConfigProvider value={configManager}>
            <Outlet />
        </ConfigProvider>
    );
};
```

⠀

## 4. Read config

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

## 5. Persist config updates

`@config-store/react` provides _three_ ways of updating the store. Pick the one that suits your case.

⚠️ If you're not using [React Compiler](https://react.dev/learn/react-compiler), make sure to tighten these examples with `useCallback` and `useMemo`.

⠀

### 5.1. Write the entire config into the store

```tsx "clickHandler" {10-14} "config"
import {useUpdateConfig} from 'my-app/settings/hooks';

export const ThemeToggler = () => {
    const config = useConfig();
    const {update} = useUpdateConfig();

    // This is the value we're gonna write to the store
    const [userInput] = useState<'light' | 'dark'>(config.theme);

    const clickHandler = () =>
        update({
            ...config,
            theme: userInput,
        });

    return (
        <div>
            <button onClick={clickHandler}>Switch to Dark Mode</button>
        </div>
    );
};
```

⠀

### 5.2. Update a specific value in the store with a mutator

```tsx /{(clickHandler)}/ {12-18} "config"
import {useUpdateConfig} from 'my-app/settings/hooks';

export const ThemeToggler = () => {
    // Selector selects a specific property on the settings
    const theme = useConfig((c) => c.theme);

    // This is the value we're gonna write to the store
    const [userInput] = useState<'light' | 'dark'>(theme);

    const {update} = useUpdateConfig();

    const clickHandler = () => {
        // Pass a mutator callback into the `update`
        update((config) => ({
            ...config,
            theme: userInput,
        }));
    };

    return (
        <div>
            <button onClick={clickHandler}>Switch to Dark Mode</button>
        </div>
    );
};
```

⠀

### 5.3. Customize the update function with a reducer

`useUpdateConfigReducer` lets you preconfigure the `update` function to receive a narrow value.

In this example, we're setting it up to receive the theme value typed as `'light' | 'dark'`.

This lets us pass the `update` function directly into Select's `onChange`, without having to wrap `update` with a handle callback like in the previous example.

```tsx /(update)}/ {10-14} /(config),/
import {useUpdateConfigReducer} from 'my-app/settings/hooks';

export const ThemeToggler = () => {
    // Selector selects a specific property on the config
    const theme = useConfig((c) => c.theme);

    // This is the value we're gonna write to the store
    const [userInput] = useState<'light' | 'dark'>(config.theme);

    // Preconfigure the update function to receive a theme value
    const {update} = useUpdateConfigReducer<'light' | 'dark'>((config, theme) => ({
        ...config,
        theme,
    }));

    return (
        <label>
            <span>Theme</span>

            <Select
                options={['light', 'dark']}
                selectedOption={theme}
                onChange={update} // No handler wrapper necessary!
            />
        </label>
    );
};
```
