---
title: LocalStorageAdapter
---

The local storage adapter persists the settings in localStorage. It's synchronous and instant.

You can instantiate it and pass directly to the manager:

```ts {3} /const (adapter)/ /(adapter),/
import {ConfigManager, LocalStorageAdapter} from '@config-store/core';

const adapter = new LocalStorageAdapter();

export const configManager = ConfigManager.create(adapter, {
    version: 1,
    schema: z.object().prefault({}),
});
```

## Customizing localStorage key

By default, the settings are saved to the `@lolmaus/config-store` localStorage entry.

To change the key, pass the `key` option:

```ts "{key: 'my-settings'}"
new LocalStorageAdapter({key: 'my-settings'});
```
