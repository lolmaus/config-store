---
title: Schema Defintion Rules
---

`@config-store` relies on [Zod](https://zod.dev) schema to provide default values.

This means that the schema must be able to accept an empty initial value (e. g. `null` or `undefined`) and parse it into a default config.

Here's how to achieve that, assuming you store settings in an object.

## Handling undefined initial value

If your adapter receives `undefined` as an empty initial value, then you must attach [.prefault({})](https://zod.dev/api?id=prefaults) to your outmost `z.object()`.

```ts ".prefault({})"
const MySettingsSchema = z.object().prefault({}); // Converts initial `undefined` value to `{}`

MySettingsSchema.parse(undefined); // => {}
```

## Handling null initial value

If your adapter receives `null` as an empty initial value, then you must wrap the entire schema with [.preprocess()](https://zod.dev/api#preprocess), converting `null` into an empty object `{}`.

Also handles `undefined`!

```ts "z.preprocess(" "(config: unknown) => config ?? {}," "null"
const MySettingsSchema = z.preprocess(
    (config: unknown) => config ?? {},
    z.object() // You don't need `.prefault({})` on root level when using `.preprocess()`
);

MySettingsSchema.parse(null); // => {}
```

## Handling default values for properties

You must attach [.default()](https://zod.dev/api?id=defaults) to every primitive property.

```ts /(.default.+),/ "{}"
const MySettingsSchema = z.object({
    menuExpanded: z.boolean().default(true),
    darkTheme: z.boolean().default(false),
});

MySettingsSchema.parse({}); // => {menuExpanded: true, darkTheme: false}
```

## Handling nested objects

You must attach [.prefault({})](https://zod.dev/api?id=prefaults) to every nested object.

```ts ".prefault({})" "{}"
const MySettingsSchema =
    z.object({
        nestedSettings: z.object().prefault({}),
    })
);

MySettingsSchema.parse({}); // => {nestedSettings: {foo: 'bar', baz: 'zomg'}}
```

## Handling everything together

Now you're ready to build your schema:

```ts /(.default.+),/ ".prefault({})" "undefined"
const MySettingsSchema = z
    .object({
        menuExpanded: z.boolean().default(true),
        darkTheme: z.boolean().default(false),

        nestedSettings: z
            .object({
                foo: z.string().default('bar'),
                baz: z.literal(['quux', 'zomg', 'lol']).default('zomg'),
            })
            .prefault({}),
    })
    .prefault({});

MySettingsSchema.parse(undefined); // =>
/**
 * {
 *   menuExpanded: true,
 *   darkTheme: false,
 *   nestedSettings: {
 *     foo: 'bar',
 *     baz: 'zomg'
 *   }
 * }
 */
```
