# @config-store/core

## 1.0.0-alpha.3

### Minor Changes

- 617c98a: - Remove onReadError and onWriteError from adapters.
    - Make the first argument of `ConfigManager.create()` to be an options object of type `ConfigManagerOptions`.
    - Implement `onLoadError`, `onSaveError` and `onMigrationError` callbacks.

### Patch Changes

- f6886a2: Improved messages for Zod-based validation errors.
- 7af4486: Fix the default value of LocalStorageAdapter constructor arg

## 1.0.0-alpha.2

### Patch Changes

- a16aea0: LocalStorageAdapter: make key optional

## 1.0.0-alpha.1

### Minor Changes

- 35501e7: Improve error handling and retries when loading.
    - `ConfigManager`:
        - Added error handling and loading states for loading configuration (see below).
        - Added `ManagerStatus` and `ManagerState` types.
        - Metadata is now stored as part of private `stateStore`.
        - New public API for accessing stores. All properties are getters:
            - `manager.config` — current config, typed as `TCurrent`;
            - `manager.state` — current state, typed as `ManagerState`;
            - `manager.status` — shortcut for `manager.state.status`, typed as `ManagerStatus`;
            - `manager.error` — shortcut for `manager.state.error`, typed as `unknown`;
            - `manager.metadata` — shortcut for `manager.state.metadata`, typed as `ManagerMetadata`;
            - `manager.dataVersion` — shortcut for `manager.state.metadata.dataVersion`, typed as `number`;
            - `manager.schemaVersion` — shortcut for `manager.state.metadata.schemaVersion`, typed as `number`;
            - `manager.isInitial`, typed as `boolean`;
            - `manager.isLoading`, typed as `boolean`;
            - `manager.isSuccess`, typed as `boolean`;
            - `manager.isError`, typed as `boolean`;
            - `manager.hasBeenHydrated` — shortcut for `manager.state.hasBeenHydrated`, typed as `boolean`;
        - Fix: correctly set success and hasBeenHydrated state on save.
        - Fix: correctly set success and hasBeenHydrated state on recovery after ConfigConflictError.
        - Migrate to a single Zustand store, merging configStore and stateStore into one.
        - Make `ConfigManager.create()` require initial version as second argument.
        - In `ManagerState`, split existing `status`, `error`, `isInitial`, `isLoading`, `isSuccess` and `isError` into:
            - load states: `loadStatus`, `loadError`, `isLoadInitial`, `isLoadPending`, `isLoadSuccess`, `isLoadError`;
            - save states: `saveStatus`, `saveError`, `isSaveInitial`, `isSavePending`, `isSaveSuccess`, `isSaveError`.
        - No longer reverts to older state on network error. This was bad UX. Now the manager remains on latest settings version.
        - Renamed `ManagerStatus` to `ManagerRequestStatus`, in order to distinguish from `ManagerState`.
    - `AsyncAdapter`:
        - Added `onReadError` to `AsyncAdapterOptions`.
        - `read` and `write` methods of `AsyncAdapterOptions` are now expected to return `Promise<AdapterEnvelope | null | undefined | void>`.
        - `read` and `write` methods of `AsyncAdapterOptions` always receive `ManagerMetadata`.
    - `LocalStorageAdapter`
        - No longer swallows the error, allowing the manager to handle failures.
        - Improve error handling.

## 1.0.0-alpha.0

## 0.3.0-alpha.0

### Minor Changes

- c91dcc6: Removed react from core dependencies, locked zod peerDependency at ^4.0.0. Updated pnpm to 10.26.0. Fix package.json imports. Make store public on ConfigManager. In save method, any error other than conflict will reject. Fix test scripts. Fix tsconfig and turbo tasks.

## 0.2.0

### Minor Changes

- 26b08da: Removed AdapterWriteResult in favor of AdapterEnvelope. Implemented error handling in ConfigManager. Updated barrel file index.ts. Update Readme to reflect latest changes.
- eeb9a52: Removed debouncing. Removed changes from adapter signature. Added incremental check to configManager.addVersion. Added lastCommitedState to async adapter options. Added tests for complicated cases of scarse PUT requests.
- f055531: Renamed the project to @config-store.
  Renamed `settings` to `config` everywhere. Removed the TData generic type from adapter — adapter is not responsible for the content of the data.
- 41f69ef: ConfigManager WIP: Schema definition with Zod, addVersion, migration logic, default value fallback, metadata management, type inference helper, Zustand store, retrieving config from the manager
- 6be79c3: Make adapters support metadata that includes dataVersion and schemaVersion.

### Patch Changes

- 6be79c3: Extensive README.

## 0.1.0

### Minor Changes

- 42f4123: Initial version of the core package with adapters only
