# @config-store/core

## 0.3.0

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
