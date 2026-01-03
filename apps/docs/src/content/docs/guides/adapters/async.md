---
title: AsyncAdapter
---

`AsyncAdapter` is a flexible way of persisting data over network, e. g. to a REST API.

⠀

## 1. Defining the adapter

Define the adapter in a separate file `src/settings/adapter.ts` using the `create` static method:

```ts "AsyncAdapter.create"
import {AsyncAdapter, AdapterEnvelopeSchema} from '@config-store/core';

export const apiAdapter = AsyncAdapter.create({
    read: async () => {
        const res = await fetch('/api/settings');
        if (!res.ok) throw new Error('Failed to fetch');

        const json = await res.json();

        // AdapterEnvelopeSchema is a Zod schema that parses the payload as `{config, metadata}`.
        // Assuming server returns `{data: {config, metadata}}`
        return AdapterEnvelopeSchema.parse(json?.data);
    },

    write: async (config, _lastCommittedConfig, metadata, signal) => {
        const payload = {
            config,
            metadata, // e.g. {dataVersion: 1, schemaVersion: 1}
        };

        const res = await fetch('/api/settings', {
            method: 'PUT',
            body: JSON.stringify(payload),
            headers: {'Content-Type': 'application/json'},
            signal,
        });

        if (!res.ok) throw new Error('Save Failed');

        // If your backend does not respond to writes with a payload, you can skip this.
        const json = await res.json();

        // AdapterEnvelopeSchema is a Zod schema that parses the payload as `{config, metadata}`.
        // Assuming server returns `{data: {config, metadata}}`
        return AdapterEnvelopeSchema.parse(json?.data);
    },

    onWriteError: (error) => {
        console.error('[@config-store] Async adapter read failed:', error);
    },

    onWriteError: (error) => {
        console.error('[@config-store] Async adapter write failed:', error);
    },
});
```
<<<<<<< Updated upstream
=======

````
>>>>>>> Stashed changes

Then register your adapter with the ConfigManager:

```ts
import {apiAdapter} from './adapter';

export const configManager = ConfigManager.create(adapter, {
    /* Inital verison here */
});
```

⠀

## 2. Handling Concurrency (Race Conditions)

When a user modifies settings rapidly (e.g., dragging a volume slider), multiple save requests are generated. Network latency can cause these requests to arrive out of order.

The `AsyncAdapter` supports three strategies via the `concurrency` option to solve this:

⠀

### 2.1. Abort strategy — default

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

### 2.2. Optimistic Concurrency Control — best solution, requires backend logic

**Best for:** when you can customize backend logic.

Use the `abort` strategy for this approach, no frontend changes are necessary. The main difference happens on the backend side.

Why: HTTP requests may be processed in a different order from the order they have been initiated in. As a result, latest data may be overwritten by obsolete data. To prevent this, [Optimistic Concurrency Control](https://en.wikipedia.org/wiki/Optimistic_concurrency_control) (OCC) should be employed.

With each request, your adapter should send metadata containing a `dataVersion` number. `@config-store` automatically provides the metadata and increments the `dataVesion` on each save.

If requests come in the wrong order, the backend may process a recent request first. When it then processes an older request, the backend must check if the `dataVersion` of the request being processed is larger than `dataVersion` in the database. If it's not, the backend rejects the request with `409 Conflict` HTTP code.

The `AsyncAdapter` will ignore `409 Conflict` responses and drop corresponding save operations.

Ths strategy guarantees that older data does not overwrite newer data.

⠀

### 2.3. Sequential strategy — legacy Fallback

**Best for:** Legacy backends that do not support HTTP request cancellation and do not handle versioning.

The library waits for Request A to finish before sending Request B.

- **Pros:** Safe; works with anything.
- **Cons:** Slow. If the network is laggy, the "Save" indicator may spin for a long time.

```ts
new AsyncAdapter({
    concurrency: 'sequential',

    write: async (config): Promise<void> => {
        // This will not run in parallel with another write
        await fetch('/api/settings', {
            /*...*/
        });
    },
});
```

⠀

## 3. Handling Backend Responses on save

Sometimes, the server modifies the data you sent, e. g. sanitizing it.

The return type of your `write` callback is `AdapterEnvelope | void`, where `AdapterEnvelope` is:

```ts
{
    config: unknown;
    metadata: ManagerMetadata;
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

        // AdapterEnvelopeSchema is a Zod schema that parses the payload as `{config, metadata}`.
        // Assuming server returns `{data: {config, metadata}}`
        return AdapterEnvelopeSchema.parse(json?.data);
    },
});
```
<<<<<<< Updated upstream
=======
````
>>>>>>> Stashed changes
