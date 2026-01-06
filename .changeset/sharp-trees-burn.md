---
'@config-store/core': minor
---

- Remove onReadError and onWriteError from adapters.
- Make the first argument of `ConfigManager.create()` to be an options object of type `ConfigManagerOptions`.
- Implement `onLoadError`, `onSaveError` and `onMigrationError` callbacks.
