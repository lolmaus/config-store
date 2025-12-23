---
'@config-store/core': minor
---

Improve error handling and retries when loading.

- `ConfigManager`:
    - Added error handling and loading states for loading configuration (see below).
    - Added `ManagerStatus` and `ManagerState` types.
    - Metadata is now stored as part of private `stateStore`.
    - New public API for accessing stores. All properties are getters:
        - `manager.config` — current config, typed as `TCurrent`;
        - `manager.state` — current state, typed as `ManagerState`;
        - `manager.status` — shortcut for `manager.state.status`, typed as `ManagerStatus`;
        - `manager.error` — shortcut for `manager.state.error`, typed as `unknown`;
        - `manager.metadata` — shortcut for `manager.state.metadata`, typed as `Meta`;
        - `manager.dataVersion` — shortcut for `manager.state.metadata.dataVersion`, typed as `number`;
        - `manager.schemaVersion` — shortcut for `manager.state.metadata.schemaVersion`, typed as `number`;
        - `manager.isInitial`, typed as `boolean`;
        - `manager.isLoading`, typed as `boolean`;
        - `manager.isSuccess`, typed as `boolean`;
        - `manager.isError`, typed as `boolean`;
        - `manager.hasBeenHydrated` — shortcut for `manager.state.hasBeenHydrated`, typed as `boolean`;

- `AsyncAdapter`:
    - Added `onReadError` to `AsyncAdapterOptions`.
