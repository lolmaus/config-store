---
title: Frequently Asked Questions
---

## 1. Should I use TanStack Query in the adapter?

**Probably not.**

TanStack Query (React Query) is designed for **Server State**. This library manages **Client State**. If you use TanStack Query inside the adapter, you are effectively caching the data twice.

If you know what you're doing, you _can_ bridge them using `queryClient.fetchQuery` inside `adapter.read()` and `queryClient.setQueryData` inside `adapter.write()`.

⠀

## 2. Why does the library depend on Zustand?

The `@config-store/core` package uses `zustand/vanilla` internally as a micro-dependency (<1kb) for the underlying store. The `@config-store/react` package uses `zustand`.

Zustand provides a robust store implementation with selector support, e. g. `useConfig(s => s.theme)`. This prevents unnecessary re-renders that would occur with standard React Context. For example, if a component relies on property A to render, then changes to property B should not cause the component to rerender.

⠀

### 3. What's the hassle with migrations?

Config schemas change over time as your project matures. For example, dark theme was managed via `darkTheme: boolean` setting, but now it's `theme: 'dark' | 'light' | 'system'`.

Without migrations, a user returning after 6 months will experience a crash because their localStorage data doesn't match your new code. To work around the crash, you'll have to reset their settings to defaults.

`@config-store` lets you define a migration, that will change the user's config to the new format without discarding their preferences.

Migrations are applied transparently, keeping your UI code clean and typed strictly to the _latest_ version.

⠀

### 4.4 What happens if I omit a migration?

If a new config version does not define a migration, user settings will be used as-is for this version. This is fine in cases where your schema changes are minor and do not result in different types.

However, if `adapter.read()` returns data that does not match the current Zod schema, **Zod will throw a validation error**. The `ConfigManager` catches this error, logs it, and **falls back to default values** to prevent a White Screen of Death. With proper migrations set up, this should only happen when settings are edited in the database in violation of the frontend schema.

⠀

### 4.5 How do I reset a setting to its default value?

Pass `undefined` to the update hook: `updateConfig({ theme: undefined })`. Zod will apply the `.default()` value defined in your schema.
